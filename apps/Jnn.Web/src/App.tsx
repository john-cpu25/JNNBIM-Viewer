import React, { useState, useEffect, useMemo } from 'react';
import { Workspace, BimElement, ClashResultItem, BcfIssue, BimModel } from './types/bim';
import { initialAvailableModels, sampleClashTests, sampleBcfIssues } from './data/sampleBimData';
import { ThreeJsAdapter } from './adapters/ThreeJsAdapter';
import { AppHeader } from './components/layout/AppHeader';
import { WorkspaceRibbon } from './components/layout/WorkspaceRibbon';
import { StatusBar } from './components/layout/StatusBar';
import { ThreeViewport } from './components/viewport/ThreeViewport';
import { ModelExplorer } from './components/modelTree/ModelExplorer';
import { PropertiesInspector } from './components/properties/PropertiesInspector';
import { SectionWorkspace } from './components/workspaces/SectionWorkspace';
import { ClashWorkspace } from './components/workspaces/ClashWorkspace';
import { QuantityWorkspace } from './components/workspaces/QuantityWorkspace';
import { ReportsWorkspace } from './components/workspaces/ReportsWorkspace';
import { ImportWorkspace } from './components/workspaces/ImportWorkspace';
import { SettingsModal } from './components/workspaces/SettingsModal';
import { ProjectHome } from './components/workspaces/ProjectHome';

export const App: React.FC = () => {
  // Global State
  const [workspace, setWorkspace] = useState<Workspace>('model');
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(true);
  const [viewportBg, setViewportBg] = useState<string>('#0f172a');
  
  // Multi-model management with localStorage persistence and legacy cleanup
  const [availableModels, setAvailableModels] = useState<BimModel[]>(() => {
    const saved = localStorage.getItem('jnn_available_models');
    if (saved) {
      try {
        const parsed: BimModel[] = JSON.parse(saved);
        const defaultTemplate = initialAvailableModels[0];
        const seenIds = new Set<string>();

        const filtered = parsed
          .filter(m => {
            if (
              m.id === 'MOD-SAMPLE-001' ||
              m.id === 'MOD-GRANDMARINA-002' ||
              m.id === 'MOD-ECOPARK-003'
            ) {
              return false;
            }
            // Remove previously mis-cached non-Project2 uploads that were accidentally given P2- elements
            const isNamedProject2 = m.name.toLowerCase().includes('project2');
            const hasProject2Elements = m.elements?.some(e => e.id.startsWith('P2-'));
            if (!isNamedProject2 && hasProject2Elements) {
              return false;
            }
            return true;
          })
          .map(m => {
            const isNamedProject2 = m.id === 'MOD-PROJECT2-001' || m.name.toLowerCase().includes('project2');
            const isOld293 = !m.elements || m.elements.length === 293;
            if (defaultTemplate && isNamedProject2 && isOld293) {
              return {
                ...defaultTemplate,
                id: m.id,
                name: m.name || defaultTemplate.name
              };
            }
            return m;
          })
          .filter(m => {
            if (seenIds.has(m.id)) return false;
            seenIds.add(m.id);
            return true;
          });

        if (filtered.length > 0) {
          try {
            localStorage.setItem('jnn_available_models', JSON.stringify(filtered));
          } catch {
            // Ignore storage quota warnings on init
          }
          return filtered;
        }
      } catch (e) {
        console.warn('Failed parsing cached models', e);
      }
    }
    return initialAvailableModels;
  });

  const [model, setModel] = useState<BimModel>(() => {
    return availableModels[0] || {
      id: 'MOD-EMPTY',
      name: 'No Model Loaded',
      revision: 'None',
      sourceFormat: 'IFC4',
      elements: [],
      units: { length: 'MILLIMETER', volume: 'CUBIC_METER' }
    };
  });
  
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isLeftCollapsed, setIsLeftCollapsed] = useState<boolean>(false);
  const [isRightCollapsed, setIsRightCollapsed] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [fps, setFps] = useState<number>(60);
  const [activeClashId, setActiveClashId] = useState<string | null>(null);

  // Initialize ThreeJsAdapter (singleton instance for the session)
  const adapter = useMemo(() => {
    const adp = new ThreeJsAdapter();
    adp.onFpsUpdate?.((measuredFps) => {
      setFps(measuredFps);
    });
    return adp;
  }, []);

  // Safe localStorage persistence
  useEffect(() => {
    try {
      localStorage.setItem('jnn_available_models', JSON.stringify(availableModels));
    } catch (e) {
      console.warn('Could not persist models to localStorage (quota limit)', e);
    }
  }, [availableModels]);

  // Sync Theme with DOM
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkTheme) {
      root.classList.remove('light');
    } else {
      root.classList.add('light');
    }
  }, [isDarkTheme]);

  const toggleTheme = () => {
    setIsDarkTheme(prev => !prev);
  };

  const handleSelectModel = (newModel: BimModel) => {
    setModel(newModel);
    setSelectedElementId(null);
    adapter.loadModel(newModel);
  };

  const handleModelLoaded = (newModel: BimModel) => {
    setAvailableModels(prev => {
      const exists = prev.some(m => m.id === newModel.id);
      if (exists) {
        return prev.map(m => m.id === newModel.id ? newModel : m);
      }
      return [newModel, ...prev];
    });
    setModel(newModel);
    setSelectedElementId(null);
    adapter.loadModel(newModel);
    setWorkspace('model');
  };

  // Listen to Desktop Shell WebView2 IPC messages
  useEffect(() => {
    const webview = (window as any).chrome?.webview;
    if (!webview) return;

    const handleHostMessage = (event: any) => {
      const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      if (msg?.Action === 'LoadLocalFile' && msg?.Payload?.FileName) {
        const template = initialAvailableModels[0];
        if (template) {
          const imported: BimModel = {
            ...template,
            id: `MOD-DESKTOP-${Date.now()}`,
            name: msg.Payload.FileName.replace(/\.[^/.]+$/, ''),
            fileSize: msg.Payload.FileSize || template.fileSize,
            revision: 'Rev 01 (Desktop IPC)',
            elements: template.elements.map(e => ({ ...e }))
          };
          handleModelLoaded(imported);
        }
      }
    };

    webview.addEventListener('message', handleHostMessage);
    return () => webview.removeEventListener('message', handleHostMessage);
  }, []);

  const handleDeleteModel = (modelId: string) => {
    setAvailableModels(prev => {
      const updated = prev.filter(m => m.id !== modelId);

      if (model?.id === modelId) {
        if (updated.length > 0) {
          handleSelectModel(updated[0]);
        } else {
          const emptyModel: BimModel = {
            id: 'MOD-EMPTY',
            name: 'No Model Loaded',
            revision: 'None',
            sourceFormat: 'IFC4',
            elements: [],
            units: { length: 'MILLIMETER', volume: 'CUBIC_METER' }
          };
          setModel(emptyModel);
          adapter.loadModel(emptyModel);
        }
      }
      return updated;
    });
  };

  const handleClearAllModels = () => {
    setAvailableModels([]);
    const emptyModel: BimModel = {
      id: 'MOD-EMPTY',
      name: 'No Model Loaded',
      revision: 'None',
      sourceFormat: 'IFC4',
      elements: [],
      units: { length: 'MILLIMETER', volume: 'CUBIC_METER' }
    };
    setModel(emptyModel);
    adapter.loadModel(emptyModel);
  };

  const selectedElement = useMemo(() => {
    if (!selectedElementId) return null;
    return model.elements.find(e => e.id === selectedElementId) || null;
  }, [model, selectedElementId]);

  const unresolvedClashesCount = useMemo(() => {
    return sampleClashTests.flatMap(t => t.results).filter(c => c.status !== 'Resolved').length;
  }, []);

  const openIssuesCount = useMemo(() => {
    return sampleBcfIssues.filter(i => i.status !== 'Closed' && i.status !== 'Resolved').length;
  }, []);

  const handleToggleVisibility = (elementIds: string[], visible: boolean) => {
    const idSet = new Set(elementIds);
    setModel(prev => ({
      ...prev,
      elements: prev.elements.map(el => idSet.has(el.id) ? { ...el, visible } : el)
    }));
    if (visible) {
      adapter.showElements(elementIds);
    } else {
      adapter.hideElements(elementIds);
    }
  };

  const handleIsolateElements = (elementIds: string[]) => {
    const idSet = new Set(elementIds);
    setModel(prev => ({
      ...prev,
      elements: prev.elements.map(el => ({ ...el, visible: idSet.has(el.id) }))
    }));
    adapter.isolateElements(elementIds);
  };

  const handleShowAllElements = () => {
    setModel(prev => ({
      ...prev,
      elements: prev.elements.map(el => ({ ...el, visible: true }))
    }));
    adapter.showAll();
  };

  const handleSelectClash = (clash: ClashResultItem) => {
    setActiveClashId(clash.id);
    setSelectedElementId(clash.elementA.id);
  };

  const handleSelectBcfIssue = (issue: BcfIssue) => {
    if (issue.viewpoint.selectedElementIds.length > 0) {
      setSelectedElementId(issue.viewpoint.selectedElementIds[0]);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* 1. Top Header with Interactive Model Switcher */}
      <AppHeader
        currentWorkspace={workspace}
        setWorkspace={setWorkspace}
        isDarkTheme={isDarkTheme}
        toggleTheme={toggleTheme}
        viewportBg={viewportBg}
        setViewportBg={setViewportBg}
        onOpenSettings={() => setIsSettingsOpen(true)}
        currentModel={model}
        availableModels={availableModels}
        onSelectModel={handleSelectModel}
        onDeleteModel={handleDeleteModel}
      />

      {/* 2. Workspace Navigation Ribbon */}
      <WorkspaceRibbon
        currentWorkspace={workspace}
        setWorkspace={setWorkspace}
        unresolvedClashesCount={unresolvedClashesCount}
        openIssuesCount={openIssuesCount}
      />

      {/* 3. Main Body */}
      {workspace === 'home' ? (
        <ProjectHome 
          availableModels={availableModels}
          onOpenModel={(m) => {
            handleSelectModel(m);
            setWorkspace('model');
          }} 
          onDeleteModel={handleDeleteModel}
          onClearAllModels={handleClearAllModels}
          setWorkspace={setWorkspace} 
        />
      ) : (
        <div className="flex-1 flex overflow-hidden relative">
          {/* Left Panel: 5-Tier Model Explorer */}
          <ModelExplorer
            model={model}
            selectedElementId={selectedElementId}
            onSelectElement={(id) => {
              setSelectedElementId(id);
              adapter.selectElement(id);
              if (id) adapter.fitToView([id]);
            }}
            onToggleVisibility={handleToggleVisibility}
            collapsed={isLeftCollapsed}
            onToggleCollapse={() => setIsLeftCollapsed(prev => !prev)}
          />

          {/* Center 3D Viewport with Three.js */}
          <main className="flex-1 h-full relative overflow-hidden">
            <ThreeViewport
              adapter={adapter}
              model={model}
              selectedElementId={selectedElementId}
              onSelectElement={(id) => setSelectedElementId(id)}
              onToggleVisibility={handleToggleVisibility}
              onIsolateElements={handleIsolateElements}
              onShowAllElements={handleShowAllElements}
              viewportBg={viewportBg}
            />

            {/* Contextual Workspace Panels overlaid on top of 3D Viewport */}
            {workspace === 'section' && (
              <SectionWorkspace adapter={adapter} />
            )}

            {workspace === 'clash' && (
              <ClashWorkspace
                adapter={adapter}
                clashTests={sampleClashTests}
                activeClashId={activeClashId}
                onSelectClash={handleSelectClash}
              />
            )}

            {workspace === 'quantity' && (
              <QuantityWorkspace
                elements={model.elements}
                selectedElementId={selectedElementId}
                onSelectElement={(id) => {
                  setSelectedElementId(id);
                  adapter.selectElement(id);
                  if (id) adapter.fitToView([id]);
                }}
              />
            )}

            {workspace === 'reports' && (
              <ReportsWorkspace
                adapter={adapter}
                issues={sampleBcfIssues}
                onSelectIssue={handleSelectBcfIssue}
              />
            )}

            {workspace === 'import' && (
              <ImportWorkspace
                onModelLoaded={handleModelLoaded}
                setWorkspace={setWorkspace}
              />
            )}
          </main>

          {/* Right Panel: Properties & Structural Inspector */}
          <PropertiesInspector
            element={selectedElement}
            collapsed={isRightCollapsed}
            onToggleCollapse={() => setIsRightCollapsed(prev => !prev)}
          />
        </div>
      )}

      {/* 4. Bottom Engineering Status Bar */}
      <StatusBar
        totalElementsCount={model?.elements?.length || 0}
        visibleElementsCount={model?.elements?.filter(e => e.visible)?.length || 0}
        selectedElement={selectedElement}
        fps={fps}
        activeEngine="Three.js WebGL2"
      />

      {/* 5. Preferences / Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        isDarkTheme={isDarkTheme}
        toggleTheme={toggleTheme}
        viewportBg={viewportBg}
        setViewportBg={setViewportBg}
      />
    </div>
  );
};
