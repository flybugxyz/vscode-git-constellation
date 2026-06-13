import React from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { MainContent } from './components/MainContent';
import { RewordModal } from './components/RewordModal';
import { SquashModal } from './components/SquashModal';
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

  const { 
    menuState, 
    openContextMenu, 
    handleCloseMenu, 
    handleMenuAction, 
    rewordModal, 
    setRewordModal,
    squashModal,
    setSquashModal
  } = useContextMenuState(selection);

  return (
    <ErrorBoundary vscode={vscode}>
      <div className="app-container" style={{ display: 'flex', flexDirection: 'row', height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <Sidebar openContextMenu={openContextMenu} menuState={menuState} />
        <MainContent 
          selection={selection}
          menuState={menuState}
          openContextMenu={openContextMenu}
          handleCloseMenu={handleCloseMenu}
          handleMenuAction={handleMenuAction}
        />
      </div>
      <RewordModal
        isOpen={!!rewordModal}
        hash={rewordModal?.hash || ''}
        initialMessage={rewordModal?.currentMessage || ''}
        onClose={() => setRewordModal(null)}
        onSubmit={(hash, message) => {
          vscode.postMessage({ type: 'rewordCommitSubmit', hash, message });
          setRewordModal(null);
        }}
      />
      <SquashModal
        isOpen={!!squashModal}
        hashes={squashModal?.hashes || []}
        initialMessage={squashModal?.defaultMessage || ''}
        onClose={() => setSquashModal(null)}
        onSubmit={(hashes, message) => {
          vscode.postMessage({ type: 'squashCommitsSubmit', hashes, message });
          setSquashModal(null);
        }}
        vscode={vscode}
      />
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
