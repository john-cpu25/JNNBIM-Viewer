import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(webRoot, '../..');
const reviewDir = path.resolve(repoRoot, '../TODO/2_Review');
const inRepoResultsDir = path.resolve(__dirname, 'results');

if (!fs.existsSync(reviewDir)) {
  fs.mkdirSync(reviewDir, { recursive: true });
}
if (!fs.existsSync(inRepoResultsDir)) {
  fs.mkdirSync(inRepoResultsDir, { recursive: true });
}

console.log('================================================================');
console.log('   T14: IFC OPENSHELL IFCCLASH BENCHMARK & SYSTEM COMPARISON    ');
console.log('================================================================\n');

// 1. Run ifcclash via Python script
console.log('1. Executing IfcOpenShell ifcclash (Python 3.12, ifcclash 0.9.0)...');
let ifcData = { touching_collisions: [], strict_penetrations: [] };
try {
  const pyCmd = 'python scripts/run_ifcclash.py';
  const pyOutput = execSync(pyCmd, { cwd: webRoot, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  ifcData = JSON.parse(pyOutput.trim());
  console.log(`   -> ifcclash Touching Collisions (allow_touching=True) : ${ifcData.touching_collisions.length} pairs`);
  console.log(`   -> ifcclash Strict Penetrations (allow_touching=False): ${ifcData.strict_penetrations.length} pairs`);
} catch (err) {
  console.error('Failed to run ifcclash python script:', err);
  process.exit(1);
}

const ifcclashJsonPath = path.join(reviewDir, 'T14.1_ifcclash_raw.json');
fs.writeFileSync(ifcclashJsonPath, JSON.stringify(ifcData.touching_collisions, null, 2), 'utf8');
fs.writeFileSync(path.join(inRepoResultsDir, 'T14.1_ifcclash_raw.json'), JSON.stringify(ifcData.touching_collisions, null, 2), 'utf8');

// 2. Run JNN Clash Integration Spike
console.log('\n2. Executing JNN Clash Engine (ThreeMeshBVH + Sweep-and-Prune)...');
try {
  execSync('node scripts/test-spike-integration.mjs', { cwd: webRoot, stdio: 'inherit' });
} catch (err) {
  console.error('Failed to run JNN integration spike:', err);
  process.exit(1);
}

const jnnJsonPath = path.join(reviewDir, 'T11.4_integration_clash_result.json');
const jnnResult = JSON.parse(fs.readFileSync(jnnJsonPath, 'utf8'));
const allJnnClashes = jnnResult.allClashes || [];

const jnnHardClashes = allJnnClashes.filter((c) => c.type === 'Hard');
const jnnTouchingClashes = allJnnClashes.filter((c) => c.type === 'Clearance' && c.distance <= 0.001);
console.log(`   -> JNN Engine Hard Clashes detected       : ${jnnHardClashes.length}`);
console.log(`   -> JNN Engine Touching/Coincident detected: ${jnnTouchingClashes.length}`);

// 3. Normalized pair comparison helper
const normalizePair = (g1, g2) => [String(g1).trim(), String(g2).trim()].sort().join(' <-> ');

// Helper to filter out virtual architectural space volumes (IfcSpace) dynamically by IFC class metadata
const isSpaceClash = (c) => {
  const clsA = String(c.aClass || c.a_class || '').toUpperCase();
  const clsB = String(c.bClass || c.b_class || '').toUpperCase();
  return clsA.includes('SPACE') || clsB.includes('SPACE');
};

// 3A. Compare Strict Penetrations (True Hard Collisions)
console.log('\n================================================================');
console.log('  MODE A: STRICT PHYSICAL PENETRATIONS (allow_touching = False)  ');
console.log('================================================================');

const ifcPenMap = new Map();
for (const c of ifcData.strict_penetrations) {
  if (isSpaceClash(c)) continue;
  ifcPenMap.set(normalizePair(c.a_guid, c.b_guid), c);
}

const jnnHardMap = new Map();
for (const c of jnnHardClashes) {
  if (isSpaceClash(c)) continue;
  jnnHardMap.set(normalizePair(c.aGuid || c.aId, c.bGuid || c.bId), c);
}

let penMatches = 0;
const penMatchedKeys = [];
const penMissingKeys = [];

for (const [key, c] of ifcPenMap) {
  if (jnnHardMap.has(key)) {
    penMatches++;
    penMatchedKeys.push(key);
  } else {
    penMissingKeys.push({ key, c });
  }
}
const penMatchRate = (penMatches / ifcPenMap.size) * 100;
console.log(`ifcclash Strict Penetrations : ${ifcPenMap.size}`);
console.log(`JNN Detected Intersection     : ${penMatches}`);
console.log(`Strict Penetration Match Rate : ${penMatchRate.toFixed(2)}%`);
if (penMissingKeys.length > 0) {
  console.log('Missing pairs:', penMissingKeys);
}

// 3B. Compare Broad Physical Geometric Contacts (Hard + Touching)
console.log('\n================================================================');
console.log('  MODE B: GEOMETRIC CLASHES & CONTACTS (allow_touching = True)   ');
console.log('================================================================');

const ifcTouchMap = new Map();
for (const c of ifcData.touching_collisions) {
  if (isSpaceClash(c)) continue;
  ifcTouchMap.set(normalizePair(c.a_guid, c.b_guid), c);
}

const jnnCombinedMap = new Map();
for (const c of allJnnClashes) {
  if (isSpaceClash(c)) continue;
  if (c.type === 'Hard' || c.distance <= 0.001) {
    jnnCombinedMap.set(normalizePair(c.aGuid || c.aId, c.bGuid || c.bId), c);
  }
}

const matchedPairs = [];
const jnnOnlyPairs = [];
const ifcOnlyPairs = [];

for (const [pairKey, jnnClash] of jnnCombinedMap.entries()) {
  if (ifcTouchMap.has(pairKey)) {
    matchedPairs.push({ pairKey, jnn: jnnClash, ifc: ifcTouchMap.get(pairKey) });
  } else {
    jnnOnlyPairs.push({ pairKey, jnn: jnnClash });
  }
}

for (const [pairKey, ifcClash] of ifcTouchMap.entries()) {
  if (!jnnCombinedMap.has(pairKey)) {
    ifcOnlyPairs.push({ pairKey, ifc: ifcClash });
  }
}

const combinedMatchRate = (matchedPairs.length / ifcTouchMap.size) * 100;

console.log(`ifcclash Total Pairs (OpenCASCADE BVH) : ${ifcTouchMap.size}`);
console.log(`JNN Physical Contacts (ThreeMeshBVH)   : ${jnnCombinedMap.size}`);
console.log(`Matched Pairs (True Positives)         : ${matchedPairs.length}`);
console.log(`JNN Only Pairs (Beam/Roof Subtleties)  : ${jnnOnlyPairs.length}`);
console.log(`ifcclash Only Pairs (Corner Touching)  : ${ifcOnlyPairs.length}`);
console.log(`CONTACT MATCH RATE                     : ${combinedMatchRate.toFixed(2)}%`);
console.log('================================================================\n');

const summaryResult = {
  timestamp: new Date().toISOString(),
  environment: {
    ifcclashVersion: '0.9.0',
    pythonVersion: '3.12',
    jnnBvhEngine: 'three-mesh-bvh 0.9.16',
    thatOpenVersion: '@thatopen/fragments 3.6.0',
  },
  models: {
    modelA: 'building-arch-2x3.ifc (14 physical elements)',
    modelB: 'building-struct-2x3.ifc (16 physical elements)',
  },
  modeA_StrictPenetrations: {
    ifcCount: ifcPenMap.size,
    matchedCount: penMatches,
    matchRatePercent: penMatchRate,
    matchedPairs: penMatchedKeys,
    missingPairs: penMissingKeys.map((m) => m.key),
  },
  modeB_CombinedContacts: {
    ifcCount: ifcTouchMap.size,
    jnnCount: jnnCombinedMap.size,
    matchedCount: matchedPairs.length,
    jnnOnlyCount: jnnOnlyPairs.length,
    ifcOnlyCount: ifcOnlyPairs.length,
    matchRatePercent: combinedMatchRate,
  },
  matchedPairs: matchedPairs.map((m) => m.pairKey),
  jnnOnlyPairs: jnnOnlyPairs.map((m) => m.pairKey),
  ifcOnlyPairs: ifcOnlyPairs.map((m) => m.pairKey),
  performance: {
    broadphaseCandidates: jnnResult.totalCandidates,
    broadphaseTimeMs: jnnResult.broadphaseTimeMs,
    narrowphaseTimeMs: jnnResult.narrowphaseTimeMs,
    totalTimeMs: jnnResult.totalTimeMs,
  },
};

const summaryJsonPath = path.join(reviewDir, 'T14.1_compare_summary.json');
fs.writeFileSync(summaryJsonPath, JSON.stringify(summaryResult, null, 2), 'utf8');

const inRepoSummaryPath = path.join(inRepoResultsDir, 'T14.1_compare_summary.json');
fs.writeFileSync(inRepoSummaryPath, JSON.stringify(summaryResult, null, 2), 'utf8');

console.log(`Saved comparison summary to:`);
console.log(` - ${summaryJsonPath}`);
console.log(` - ${inRepoSummaryPath}`);
