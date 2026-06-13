import React, { useState, useCallback, useEffect } from 'react';
import { FileTree } from './FileTree';
import { GitStatusFile, Changelist } from './types';
import { useGitData } from './GitDataContext';
import { ContextMenu, MenuEntry } from './ContextMenu';

function getStatusChar(f: GitStatusFile): string {
  const ind = f.index;
  const wd = f.working_dir;
  if (ind === '?' || wd === '?') return 'A';
  if (ind === 'D' || wd === 'D') return 'D';
  if (ind === 'A' || wd === 'A') return 'A';
  if (ind === 'R' || wd === 'R') return 'R';
  return 'M';
}

interface LocalChangesPanelProps {
  commitBoxHeight: number;
  onStartResizeCommitBox: (startY: number, startHeight: number) => void;
  isGenerating: boolean;
  setIsGenerating: (g: boolean) => void;
  commitMessage: string;
  setCommitMessage: (msg: string) => void;
  commitActionState?: 'commit' | 'commitAndPush' | null;
  setCommitActionState: (state: 'commit' | 'commitAndPush' | null) => void;
}

export function LocalChangesPanel({
  commitBoxHeight,
  onStartResizeCommitBox,
  isGenerating,
  setIsGenerating,
  commitMessage,
  setCommitMessage,
  commitActionState,
  setCommitActionState
}: LocalChangesPanelProps) {
  const { gitData, vscode, checkedFiles, setCheckedFiles } = useGitData();
  const [forcePush, setForcePush] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // Context Menu States
  const [fileContextMenu, setFileContextMenu] = useState<{ x: number; y: number; filePath: string } | null>(null);
  const [clContextMenu, setClContextMenu] = useState<{ x: number; y: number; changelistId: string; isDefault?: boolean } | null>(null);

  // AI Splits States
  const [isAnalyzingSplits, setIsAnalyzingSplits] = useState(false);
  const [splitSuggestions, setSplitSuggestions] = useState<{ name: string; files: string[] }[] | null>(null);
  const [expandedCls, setExpandedCls] = useState<Set<string>>(new Set(['default']));

  const files = gitData?.status?.files || [];
  const conflictedPaths = new Set(gitData?.status?.conflicted || []);

  const baseChangelists: Changelist[] = gitData?.changelists || [
    { id: 'default', name: 'Default Changelist', filePaths: files.map(f => f.path), isDefault: true }
  ];

  const changelists: Changelist[] = [];
  if (conflictedPaths.size > 0) {
    changelists.push({
      id: 'conflicts',
      name: 'Conflicts',
      filePaths: Array.from(conflictedPaths),
      isConflicts: true
    });
  }
  changelists.push(...baseChangelists);

  // Auto expand all changelists when loaded
  useEffect(() => {
    setExpandedCls(prev => {
      const next = new Set(prev);
      next.add('conflicts');
      if (gitData?.changelists) {
        gitData.changelists.forEach(cl => next.add(cl.id));
      }
      return next;
    });
  }, [gitData?.changelists]);

  // Listen to AI splits result
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'suggestChangelistSplitsResult') {
        setIsAnalyzingSplits(false);
        if (msg.changelists) {
          setSplitSuggestions(msg.changelists);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Cleanup checkedFiles to remove any files that no longer exist or are conflicted
  useEffect(() => {
    if (!gitData?.status?.files) return;
    const existingUnconflicted = new Set(
      gitData.status.files
        .map(f => f.path)
        .filter(path => !conflictedPaths.has(path))
    );
    let changed = false;
    const newChecked = new Set<string>();
    checkedFiles.forEach(path => {
      if (existingUnconflicted.has(path)) {
        newChecked.add(path);
      } else {
        changed = true;
      }
    });
    if (changed) {
      setCheckedFiles(newChecked);
    }
  }, [gitData?.status?.files, gitData?.status?.conflicted, checkedFiles, setCheckedFiles]);

  const handleCheckChange = useCallback((path: string, checked: boolean, filePaths: string[]) => {
    setCheckedFiles(prevChecked => {
      const newChecked = new Set(prevChecked);
      filePaths.forEach(p => {
        if (checked) {
          newChecked.add(p);
        } else {
          newChecked.delete(p);
        }
      });
      return newChecked;
    });
  }, [setCheckedFiles]);

  const onFileClick = (path: string) => {
    const isConflicted = conflictedPaths.has(path);
    if (isConflicted) {
      vscode.postMessage({ type: 'openFile', path });
    } else {
      vscode.postMessage({ type: 'openDiff', hash: '', path });
    }
  };

  const onDiscard = (path: string) => {
    vscode.postMessage({ type: 'discardChanges', path });
  };

  const handleCommit = () => {
    if (!commitMessage.trim() || checkedFiles.size === 0) return;
    setCommitActionState('commit');
    vscode.postMessage({ type: 'commitChanges', message: commitMessage, files: Array.from(checkedFiles) });
    setCommitMessage('');
  };

  const handleCommitAndPush = () => {
    if (!commitMessage.trim() || checkedFiles.size === 0) return;
    setCommitActionState('commitAndPush');
    vscode.postMessage({ type: 'commitAndPushChanges', message: commitMessage, files: Array.from(checkedFiles), force: forcePush });
    setCommitMessage('');
  };

  const handleGenerateAI = () => {
    if (checkedFiles.size === 0) return;
    setIsGenerating(true);
    setCommitMessage('');
    vscode.postMessage({ type: 'generateCommitMessage', files: Array.from(checkedFiles) });
  };

  const handleSuggestSplits = () => {
    setIsAnalyzingSplits(true);
    vscode.postMessage({ type: 'suggestChangelistSplits' });
  };

  const handleCreateGroup = () => {
    vscode.postMessage({ type: 'createChangelistPrompt' });
  };

  const handleCheckChangelistOnly = (clId: string) => {
    const cl = changelists.find(c => c.id === clId);
    if (!cl || cl.isConflicts) return;
    const clFiles = files.filter(f => cl.filePaths.includes(f.path) && !conflictedPaths.has(f.path)).map(f => f.path);
    if (clFiles.length === 0) return;

    const allChecked = clFiles.every(path => checkedFiles.has(path));
    if (allChecked) {
      setCheckedFiles(prev => {
        const next = new Set(prev);
        clFiles.forEach(path => next.delete(path));
        return next;
      });
    } else {
      setCheckedFiles(new Set(clFiles));
    }
  };

  const handleFileMenuAction = (actionStr: string) => {
    setFileContextMenu(null);
    if (actionStr.startsWith('moveTo:')) {
      const parts = actionStr.split(':');
      const targetId = parts[1];
      const filePath = parts.slice(2).join(':');
      vscode.postMessage({
        type: 'moveFilesToChangelist',
        filePaths: [filePath],
        targetChangelistId: targetId
      });
    } else if (actionStr.startsWith('moveToNew:')) {
      const filePath = actionStr.replace('moveToNew:', '');
      vscode.postMessage({
        type: 'moveFilesToNewChangelistPrompt',
        filePaths: [filePath]
      });
    } else if (actionStr.startsWith('discard:')) {
      const filePath = actionStr.replace('discard:', '');
      onDiscard(filePath);
    } else if (actionStr.startsWith('resolve:')) {
      const filePath = actionStr.replace('resolve:', '');
      vscode.postMessage({ type: 'openFile', path: filePath });
    }
  };

  const handleClMenuAction = (actionStr: string) => {
    setClContextMenu(null);
    if (actionStr === 'createCl') {
      handleCreateGroup();
    } else if (actionStr.startsWith('renameCl:')) {
      const clId = actionStr.replace('renameCl:', '');
      vscode.postMessage({ type: 'renameChangelistPrompt', changelistId: clId });
    } else if (actionStr.startsWith('deleteCl:')) {
      const clId = actionStr.replace('deleteCl:', '');
      vscode.postMessage({ type: 'deleteChangelistPrompt', changelistId: clId });
    }
  };

  const getFileContextMenuItems = (filePath: string): MenuEntry[] => {
    const isConflicted = conflictedPaths.has(filePath);

    if (isConflicted) {
      return [
        { label: 'Resolve Conflict...', action: `resolve:${filePath}`, icon: 'git-merge' },
        { type: 'separator' },
        { label: 'Discard Changes', icon: 'discard', action: `discard:${filePath}`, danger: true }
      ];
    }

    const clItems = baseChangelists.map(cl => ({
      label: cl.name,
      action: `moveTo:${cl.id}:${filePath}`,
      icon: cl.isDefault ? 'folder' : 'folder-active'
    }));

    return [
      {
        label: 'Move to Changelist',
        icon: 'chevron-right',
        submenu: [
          { label: 'New Changelist...', action: `moveToNew:${filePath}`, icon: 'add' },
          { type: 'separator' },
          ...clItems
        ]
      },
      { type: 'separator' },
      { label: 'Discard Changes', icon: 'discard', action: `discard:${filePath}`, danger: true }
    ];
  };

  const getClContextMenuItems = (clId: string, isDefault?: boolean): MenuEntry[] => {
    return [
      { label: 'New Changelist...', action: `createCl`, icon: 'add' },
      { label: 'Rename...', action: `renameCl:${clId}`, icon: 'edit', disabled: isDefault },
      { label: 'Delete Changelist', action: `deleteCl:${clId}`, icon: 'trash', danger: true, disabled: isDefault }
    ];
  };

  const currentFileMenu = fileContextMenu;
  const currentClMenu = clContextMenu;
  const currentSplits = splitSuggestions;

  return (
    <div className="local-changes-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Premium Toolbar */}
      <div className="local-changes-toolbar" style={{ 
        display: 'flex', 
        gap: '8px', 
        padding: '6px 12px', 
        borderBottom: '1px solid var(--vscode-panel-border)', 
        background: 'var(--vscode-tab-inactiveBackground)', 
        alignItems: 'center',
        flexShrink: 0
      }}>
        <span style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--vscode-foreground)' }}>Changelists</span>
        <div style={{ flex: 1 }}></div>
        <button 
          className="modal-button modal-button-secondary" 
          title="Suggest Changelist Splits (AI)"
          onClick={handleSuggestSplits}
          disabled={isAnalyzingSplits || files.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '11px', height: '24px' }}
        >
          <span className={`codicon ${isAnalyzingSplits ? 'codicon-loading codicon-modifier-spin' : 'codicon-sparkle'}`}></span>
          <span>{isAnalyzingSplits ? 'Splitting...' : 'Smart Split'}</span>
        </button>
        <button 
          className="modal-button modal-button-secondary" 
          title="New Changelist..."
          onClick={handleCreateGroup}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px', fontSize: '11px', height: '24px' }}
        >
          <span className="codicon codicon-add"></span>
          <span>New Group</span>
        </button>
      </div>

      {/* Changelist Groups and File Trees */}
      <div className="files-list" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
        {files && files.length > 0 ? (
          changelists.map((cl) => {
            const isExpanded = expandedCls.has(cl.id);
            const clFiles = cl.isConflicts
              ? files.filter(f => conflictedPaths.has(f.path))
              : files.filter(f => cl.filePaths.includes(f.path) && !conflictedPaths.has(f.path));
            
            const toggleCl = () => {
              setExpandedCls(prev => {
                const next = new Set(prev);
                if (next.has(cl.id)) next.delete(cl.id);
                else next.add(cl.id);
                return next;
              });
            };

            const handleHeaderContextMenu = (e: React.MouseEvent) => {
              e.preventDefault();
              if (cl.isConflicts) return;
              setClContextMenu({ x: e.clientX, y: e.clientY, changelistId: cl.id, isDefault: cl.isDefault });
            };

            return (
              <div key={cl.id} className="changelist-group" style={{ display: 'flex', flexDirection: 'column' }}>
                <div 
                  className="changelist-header" 
                  onContextMenu={handleHeaderContextMenu}
                  onClick={toggleCl}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '6px 12px',
                    background: 'var(--vscode-list-hoverBackground)',
                    borderBottom: '1px solid var(--vscode-panel-border)',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <span className={`codicon ${isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} style={{ marginRight: '6px', fontSize: '10px' }}></span>
                  {cl.isConflicts ? (
                    <span className="codicon codicon-warning" style={{ marginRight: '6px', color: 'var(--vscode-errorForeground, #ff5555)' }}></span>
                  ) : (
                    <span className="codicon codicon-folder" style={{ marginRight: '6px', color: 'var(--vscode-textLink-foreground)' }}></span>
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cl.name}</span>
                  <span style={{ marginLeft: '6px', opacity: 0.6, fontSize: '10px' }}>({clFiles.length} files)</span>
                  
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                    {!cl.isConflicts && (
                      <span 
                        className="codicon codicon-check-all" 
                        title="Stage/Check Only This Group"
                        style={{ cursor: 'pointer', fontSize: '13px', opacity: 0.7 }}
                        onClick={() => handleCheckChangelistOnly(cl.id)}
                      />
                    )}
                    {!cl.isDefault && !cl.isConflicts && (
                      <>
                        <span 
                          className="codicon codicon-edit" 
                          title="Rename Changelist"
                          style={{ cursor: 'pointer', fontSize: '13px', opacity: 0.7 }}
                          onClick={() => vscode.postMessage({ type: 'renameChangelistPrompt', changelistId: cl.id })}
                        />
                        <span 
                          className="codicon codicon-trash" 
                          title="Delete Changelist"
                          style={{ cursor: 'pointer', fontSize: '13px', opacity: 0.7, color: 'var(--vscode-errorForeground)' }}
                          onClick={() => vscode.postMessage({ type: 'deleteChangelistPrompt', changelistId: cl.id })}
                        />
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ paddingLeft: '8px' }}>
                    {clFiles.length > 0 ? (
                      <FileTree
                        files={clFiles.map((f) => ({
                          path: f.path,
                          status: cl.isConflicts ? 'U' : getStatusChar(f),
                        }))}
                        onFileClick={onFileClick}
                        checkboxes={!cl.isConflicts}
                        checkedPaths={checkedFiles}
                        onCheckChange={handleCheckChange}
                        onDiscard={onDiscard}
                        onFileContextMenu={(filePath, e) => {
                          e.preventDefault();
                          setFileContextMenu({ x: e.clientX, y: e.clientY, filePath });
                        }}
                      />
                    ) : (
                      <p style={{ padding: '8px 16px', fontSize: '11px', opacity: 0.5, margin: 0, fontStyle: 'italic' }}>No changes in this group.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p style={{ padding: '10px', fontSize: '11px', opacity: 0.6 }}>No local changes.</p>
        )}
      </div>

      {/* Commit Box Pane */}
      <div className="commit-box" style={{ height: `${commitBoxHeight}px`, display: 'flex', flexDirection: 'column', position: 'relative', flexShrink: 0 }}>
        <div 
          className="resize-handle-row"
          onMouseDown={(e) => {
            e.preventDefault();
            onStartResizeCommitBox(e.clientY, commitBoxHeight);
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--vscode-descriptionForeground)' }}>Commit Message</span>
          <button
            className="ai-generate-button"
            title="Generate Commit Message (AI)"
            onClick={handleGenerateAI}
            disabled={isGenerating || checkedFiles.size === 0}
          >
            <span className={`codicon ${isGenerating ? 'codicon-loading codicon-modifier-spin' : 'codicon-sparkle'}`} style={{ fontSize: '12px' }}></span>
            {isGenerating ? 'Generating...' : 'AI Generate'}
          </button>
        </div>
        <textarea 
          placeholder="Commit message" 
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          style={{ flex: 1, resize: 'none' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: '8px' }}>
          <button 
            onClick={handleCommit} 
            disabled={!commitMessage.trim() || checkedFiles.size === 0 || commitActionState !== null}
          >
            {commitActionState === 'commit' ? (
              <><span className="codicon codicon-loading codicon-modifier-spin" style={{ marginRight: '4px' }}></span>Committing...</>
            ) : 'Commit'}
          </button>
          <button 
            className="button-secondary"
            onClick={handleCommitAndPush} 
            disabled={!commitMessage.trim() || checkedFiles.size === 0 || commitActionState !== null}
          >
            {commitActionState === 'commitAndPush' ? (
              <><span className="codicon codicon-loading codicon-modifier-spin" style={{ marginRight: '4px' }}></span>Pushing...</>
            ) : 'Commit and Push'}
          </button>
          <label style={{ marginLeft: '4px', display: 'inline-flex', alignItems: 'center', fontSize: '11px', cursor: 'pointer', userSelect: 'none', color: 'var(--vscode-descriptionForeground)' }}>
            <input 
              type="checkbox" 
              checked={forcePush} 
              onChange={(e) => setForcePush(e.target.checked)} 
              style={{ marginRight: '6px' }}
            />
            Force Push
          </label>
        </div>
      </div>

      {/* File Context Menu */}
      {currentFileMenu && (
        <ContextMenu
          x={currentFileMenu.x}
          y={currentFileMenu.y}
          items={getFileContextMenuItems(currentFileMenu.filePath)}
          onAction={handleFileMenuAction}
          onClose={() => setFileContextMenu(null)}
        />
      )}

      {/* Changelist Context Menu */}
      {currentClMenu && (
        <ContextMenu
          x={currentClMenu.x}
          y={currentClMenu.y}
          items={getClContextMenuItems(currentClMenu.changelistId, currentClMenu.isDefault)}
          onAction={handleClMenuAction}
          onClose={() => setClContextMenu(null)}
        />
      )}

      {/* AI Splits Preview Modal */}
      {currentSplits && (
        <div className="modal-overlay" onClick={() => setSplitSuggestions(null)}>
          <div className="modal-container" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', width: '90%' }}>
            <div className="modal-header">
              <div className="modal-header-title">
                <span className="codicon codicon-sparkle"></span>
                <span>Smart Changelist Split Suggestions</span>
              </div>
              <button className="modal-close-button" onClick={() => setSplitSuggestions(null)} title="Close">
                <span className="codicon codicon-close"></span>
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '12px', opacity: 0.8, margin: 0 }}>AI recommends splitting your changes into these logical groups:</p>
              {currentSplits.map((s, idx) => (
                <div key={idx} style={{ 
                  border: '1px solid var(--vscode-panel-border)', 
                  borderRadius: '4px', 
                  padding: '10px',
                  background: 'var(--vscode-editor-background)'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '11px', color: 'var(--vscode-textLink-foreground)', marginBottom: '6px' }}>
                    {s.name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '8px', fontSize: '11px', opacity: 0.8 }}>
                    {s.files.map(f => (
                      <div key={f} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        • {f}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="modal-button modal-button-secondary" onClick={() => setSplitSuggestions(null)}>
                Cancel
              </button>
              <button 
                className="modal-button modal-button-primary" 
                onClick={() => {
                  vscode.postMessage({ type: 'applyChangelistSplits', splits: currentSplits });
                  setSplitSuggestions(null);
                }}
              >
                Apply Splits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
