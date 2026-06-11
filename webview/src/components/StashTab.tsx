import React, { useState, useEffect } from 'react';
import { CommitDetailsSidePane } from '../CommitDetailsSidePane';
import { Stash } from '../types';
import { formatDate } from '../utils';
import { useGitData } from '../GitDataContext';

interface StashTabProps {
  openContextMenu: (e: React.MouseEvent, data: any) => void;
  renderRefs: (refs: string) => React.ReactNode;
}

export function StashTab({
  openContextMenu,
  renderRefs
}: StashTabProps) {
  const {
    gitData,
    vscode,
    checkedFiles,
    selectedCommitFiles,
    setSelectedCommitFiles,
    isCompareMode,
    setIsCompareMode,
    filesExpanded,
    setFilesExpanded,
    detailsExpanded,
    setDetailsExpanded,
  } = useGitData();

  const [selectedStashIndex, setSelectedStashIndex] = useState<number>(-1);
  const [showCreateStash, setShowCreateStash] = useState<boolean>(false);
  const [stashMessage, setStashMessage] = useState<string>('');
  const [stashKeepIndex, setStashKeepIndex] = useState<boolean>(false);
  const [stashIncludeUntracked, setStashIncludeUntracked] = useState<boolean>(true);
  const [isStashGenerating, setIsStashGenerating] = useState<boolean>(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'generateStashMessageResult') {
        setIsStashGenerating(false);
        if (message.message) {
          setStashMessage(message.message);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  const selectedStash = selectedStashIndex >= 0 && gitData?.stashes ? gitData.stashes[selectedStashIndex] : null;

  const handleSelectStash = (idx: number, stash: Stash) => {
    setSelectedStashIndex(idx);
    setIsCompareMode(false);
    vscode.postMessage({ type: 'getStashFiles', hash: stash.hash });
  };

  const handleGenerateStashAI = () => {
    setIsStashGenerating(true);
    const files = checkedFiles.size > 0 
      ? Array.from(checkedFiles) 
      : (gitData?.status?.files || []).map(f => f.path);
    vscode.postMessage({ type: 'generateStashMessage', files });
  };

  const handleCreateStash = () => {
    vscode.postMessage({
      type: 'createStash',
      message: stashMessage,
      keepIndex: stashKeepIndex,
      includeUntracked: stashIncludeUntracked
    });
    setStashMessage('');
    setShowCreateStash(false);
  };

  const handleFileClick = (path: string) => {
    if (selectedCommitFiles && selectedStash) {
      vscode.postMessage({ 
        type: 'openDiff', 
        hash: selectedStash.hash, 
        path,
        isCompare: isCompareMode
      });
    }
  };

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div className="stash-panel">
        <div className="header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              style={{ background: 'none', border: '1px solid var(--vscode-panel-border)', padding: '2px 8px', fontSize: '10px' }}
              onClick={() => setShowCreateStash(!showCreateStash)}
            >
              Stash Changes...
            </button>
            <button
              style={{ background: 'none', border: '1px solid var(--vscode-panel-border)', padding: '2px 8px', fontSize: '10px' }}
              onClick={() => vscode.postMessage({ type: 'clearStashes' })}
              disabled={!gitData?.stashes || gitData.stashes.length === 0}
            >
              Clear All
            </button>
            <span style={{ marginLeft: '20px' }}>{gitData?.stashes?.length || 0} stashes</span>
          </div>
          <div className="header-actions">
            <button 
              className="toolbar-button" 
              title="Refresh Stash List"
              onClick={() => vscode.postMessage({ type: 'ready' })}
            >
              <span className="codicon codicon-refresh"></span>
            </button>
          </div>
        </div>

        {showCreateStash && (
          <div className="stash-form-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--vscode-descriptionForeground)' }}>Stash Description</span>
              <button
                className="ai-generate-button"
                title="Generate Stash Description (AI)"
                onClick={handleGenerateStashAI}
                disabled={isStashGenerating}
              >
                <span className={`codicon ${isStashGenerating ? 'codicon-loading codicon-modifier-spin' : 'codicon-sparkle'}`} style={{ fontSize: '12px' }}></span>
                {isStashGenerating ? 'Generating...' : 'AI Generate'}
              </button>
            </div>
            <textarea
              placeholder="Stash description"
              value={stashMessage}
              onChange={(e) => setStashMessage(e.target.value)}
              style={{ height: '60px', resize: 'none' }}
            />
            <div className="stash-form-options">
              <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '4px' }}>
                <input
                  type="checkbox"
                  checked={stashKeepIndex}
                  onChange={(e) => setStashKeepIndex(e.target.checked)}
                  style={{ marginRight: '6px' }}
                />
                Keep Staged Changes (Keep Index)
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '4px' }}>
                <input
                  type="checkbox"
                  checked={stashIncludeUntracked}
                  onChange={(e) => setStashIncludeUntracked(e.target.checked)}
                  style={{ marginRight: '6px' }}
                />
                Include Untracked Files
              </label>
            </div>
            <div className="stash-form-actions">
              <button onClick={handleCreateStash}>
                Stash
              </button>
              <button className="button-secondary" onClick={() => setShowCreateStash(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="table-container" style={{ flex: 1 }}>
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '150px' }}>Reference</th>
                <th style={{ width: 'auto' }}>Message</th>
                <th style={{ width: '150px' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {gitData?.stashes && gitData.stashes.length > 0 ? (
                gitData.stashes.map((stash, idx) => (
                  <tr
                    key={stash.hash}
                    className={selectedStashIndex === idx ? 'selected' : ''}
                    onClick={() => handleSelectStash(idx, stash)}
                    onContextMenu={(e) => openContextMenu(e, { kind: 'stash', stash })}
                  >
                    <td>{stash.refName}</td>
                    <td>{stash.message.split('\n')[0]}</td>
                    <td>{formatDate(stash.date, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', opacity: 0.6, padding: '20px 0' }}>No stashes found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedStash && (
        <CommitDetailsSidePane
          commit={{
            hash: selectedStash.hash,
            parents: [],
            refs: selectedStash.refName,
            message: selectedStash.message,
            author_name: 'Stash Reference',
            author_email: selectedStash.refName,
            date: selectedStash.date
          } as any}
          files={selectedCommitFiles}
          isCompareMode={isCompareMode}
          filesExpanded={filesExpanded}
          detailsExpanded={detailsExpanded}
          onClose={() => { setSelectedStashIndex(-1); setSelectedCommitFiles(null); setIsCompareMode(false); }}
          onFileClick={handleFileClick}
          onExitCompare={() => {
            setIsCompareMode(false);
            vscode.postMessage({ type: 'getStashFiles', hash: selectedStash.hash });
          }}
          onToggleFiles={() => setFilesExpanded(!filesExpanded)}
          onToggleDetails={() => setDetailsExpanded(!detailsExpanded)}
          renderRefs={renderRefs}
        />
      )}
    </div>
  );
}
