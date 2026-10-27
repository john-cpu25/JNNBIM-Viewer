/**
 * Offline dummy shim for Three's TTFLoader to eliminate CDN dependency on opentype.js at runtime.
 */
export class TTFLoader {
  load() {}
  parse() {
    return {};
  }
}
export default {};
