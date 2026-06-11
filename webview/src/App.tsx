import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { GitDataProvider, useGitData } from './GitDataContext';
import { useVSCodeMessaging } from './hooks/useVSCodeMessaging';
import { useCommitSelection } from './hooks/useCommitSelection';
import { useContextMenuState } from './hooks/useContextMenuState';
import './styles.css';

function AppContent() {
  const { vscode, searchQuery, fileFilter, setSelectedCommitFiles, setIsCompareMode } = useGitData();
  
  // Attach messaging listeners
  useVSCodeMessaging({});

  const selection = useCommitSelection({
    postMessage: (msg: any) => vscode.postMessage(msg),
    hasActiveFilters: () => !!(searchQuery || fileFilter),
    onSelectionCleared: () => {
      setSelectedCommitFiles(null);
    },
    onCommitSelected: () => {
      setIsCompareMode(false);
    },
  });

  const { menuState, openContextMenu, handleCloseMenu, handleMenuAction } = useContextMenuState(selection);

  return (
    <ErrorBoundary vscode={vscode}>
      <div className="app-container" style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <Sidebar openContextMenu={openContextMenu} />
        <MainContent 
          selection={selection}
          menuState={menuState}
          openContextMenu={openContextMenu}
          handleCloseMenu={handleCloseMenu}
          handleMenuAction={handleMenuAction}
        />
      </div>
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <GitDataProvider>
      <AppContent />
    </GitDataProvider>
  );
}

export default App;
