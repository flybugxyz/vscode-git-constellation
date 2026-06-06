import React, { useEffect, useState } from 'react';
import './styles.css';
import { GitGraph } from './GitGraph';
import { FileTree } from './FileTree';

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

function App() {
  const [gitData, setGitData] = useState<any>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [contextMenu, setContextMenu] = useState<{ visible: boolean, x: number, y: number, commit: any, index: number } | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'log' | 'local'>('log');
  const [commitMessage, setCommitMessage] = useState('');
  const [showBranches, setShowBranches] = useState(false);
  const [selectedCommitFiles, setSelectedCommitFiles] = useState<{hash: string, files: {status: string, path: string}[]} | null>(null);
  const [filterBranch, setFilterBranch] = useState<string>('ALL');
  const [localExpanded, setLocalExpanded] = useState(true);
  const [remoteExpanded, setRemoteExpanded] = useState(false);
  
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [graphWidth, setGraphWidth] = useState(100);

  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());
  const [lastFilesList, setLastFilesList] = useState<string[]>([]);
  const [forcePush, setForcePush] = useState(false);

  useEffect(() => {
    if (!gitData?.status?.files) return;
    const currentPaths = gitData.status.files.map((f: any) => f.path);
    
    // Compare currentPaths with lastFilesList
    const added = currentPaths.filter((p: string) => !lastFilesList.includes(p));
    const removed = lastFilesList.filter((p: string) => !currentPaths.includes(p));
    
    if (added.length > 0 || removed.length > 0) {
      const newChecked = new Set(checkedFiles);
      removed.forEach((p: string) => newChecked.delete(p));
      added.forEach((p: string) => newChecked.add(p));
      
      setCheckedFiles(newChecked);
      setLastFilesList(currentPaths);
    }
  }, [gitData?.status?.files]);

  useEffect(() => {
    vscode.postMessage({ type: 'ready' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'update':
          setGitData(message.payload);
          break;
        case 'files':
          setSelectedCommitFiles({ hash: message.hash, files: message.files });
          break;
        case 'compareFiles':
          setSelectedCommitFiles({ hash: message.hash, files: message.files });
          setIsCompareMode(true);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    const handleWindowClick = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const timestamp = parseInt(dateStr);
    if (isNaN(timestamp)) return dateStr;
    
    try {
      return new Date(timestamp * 1000).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const handleCommit = () => {
    if (!commitMessage.trim() || checkedFiles.size === 0) return;
    vscode.postMessage({ 
      type: 'commit', 
      message: commitMessage, 
      files: Array.from(checkedFiles) 
    });
    setCommitMessage('');
  };

  const handleCommitAndPush = () => {
    if (!commitMessage.trim() || checkedFiles.size === 0) return;
    vscode.postMessage({ 
      type: 'commitAndPush', 
      message: commitMessage, 
      files: Array.from(checkedFiles),
      force: forcePush
    });
    setCommitMessage('');
  };

  const handleCheckChange = (path: string, checked: boolean, filePaths: string[]) => {
    const newChecked = new Set(checkedFiles);
    filePaths.forEach(p => {
      if (checked) {
        newChecked.add(p);
      } else {
        newChecked.delete(p);
      }
    });
    setCheckedFiles(newChecked);
  };

  const handleLocalFileClick = (filePath: string) => {
    vscode.postMessage({ type: 'openDiff', hash: '', path: filePath });
  };

  const handleSelectCommit = (idx: number, hash: string) => {
    setSelectedIndex(idx);
    setIsCompareMode(false);
    vscode.postMessage({ type: 'getDiff', hash });
  };

  const handleFilter = (branch: string) => {
    setFilterBranch(branch);
    setSelectedIndex(-1);
    setSelectedCommitFiles(null);
    vscode.postMessage({ type: 'setFilter', branch });
    setShowBranches(false);
  };

  const handleFileClick = (path: string) => {
    if (selectedCommitFiles) {
      vscode.postMessage({ 
        type: 'openDiff', 
        hash: selectedCommitFiles.hash, 
        path,
        isCompare: isCompareMode
      });
    }
  };

  const handleContextMenu = (e: React.MouseEvent, commit: any, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setShowBranches(false);

    const menuWidth = 220;
    const menuHeight = 450;
    
    let x = e.clientX;
    let y = e.clientY;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }
    if (x < 0) x = 10;
    if (y < 0) y = 10;

    setContextMenu({
      visible: true,
      x,
      y,
      commit,
      index: idx
    });
  };

  const handleContextAction = (action: string) => {
    if (!contextMenu || !contextMenu.commit) return;
    const { commit, index } = contextMenu;
    setContextMenu(null);

    switch (action) {
      case 'copySHA':
        vscode.postMessage({ type: 'copySHA', hash: commit.hash });
        break;
      case 'copyShortSHA':
        vscode.postMessage({ type: 'copyShortSHA', hash: commit.hash });
        break;
      case 'copyMessage':
        vscode.postMessage({ type: 'copyMessage', message: commit.message });
        break;
      case 'copyURL':
        vscode.postMessage({ type: 'copyURL', hash: commit.hash });
        break;
      case 'createBranch':
        vscode.postMessage({ type: 'createBranch', hash: commit.hash });
        break;
      case 'createTag':
        vscode.postMessage({ type: 'createTag', hash: commit.hash });
        break;
      case 'createWorktree':
        vscode.postMessage({ type: 'createWorktree', hash: commit.hash });
        break;
      case 'cherryPick':
        vscode.postMessage({ type: 'cherryPick', hash: commit.hash });
        break;
      case 'cherryPickWithWorktree':
        vscode.postMessage({ type: 'cherryPickWithWorktree', hash: commit.hash });
        break;
      case 'revertCommit':
        vscode.postMessage({ type: 'revertCommit', hash: commit.hash });
        break;
      case 'rebase':
        vscode.postMessage({ type: 'rebase', hash: commit.hash });
        break;
      case 'merge':
        vscode.postMessage({ type: 'merge', hash: commit.hash });
        break;
      case 'compare':
        setSelectedIndex(index);
        vscode.postMessage({ type: 'compare', hash: commit.hash });
        break;
      case 'viewDetails':
        setSelectedIndex(index);
        setActiveTab('log');
        setFilesExpanded(true);
        setDetailsExpanded(true);
        vscode.postMessage({ type: 'getDiff', hash: commit.hash });
        break;
      case 'openInBrowser':
        vscode.postMessage({ type: 'openInBrowser', hash: commit.hash });
        break;
      case 'viewDiff':
        vscode.postMessage({ type: 'viewDiff', hash: commit.hash });
        break;
    }
  };

  const selectedCommit = selectedIndex >= 0 ? gitData?.log?.all[selectedIndex] : null;

  const renderRefs = (refs: string) => {
    if (!refs) return null;
    return refs.split(',').map(r => r.trim()).map(ref => {
      let type = 'branch';
      let label = ref;
      if (ref.startsWith('tag: ')) {
        type = 'tag';
        label = ref.replace('tag: ', '');
      } else if (ref.includes('/')) {
        type = 'remote';
      }
      return <span key={ref} className={`label-pill label-${type}`}>{label}</span>;
    });
  };

  const branches = gitData?.branches?.all || [];
  const localBranches: { name: string; displayName: string }[] = [];
  const remoteBranches: { name: string; displayName: string }[] = [];

  branches.forEach((b: string) => {
    if (b.startsWith('remotes/')) {
      if (!b.endsWith('/HEAD')) {
        remoteBranches.push({
          name: b,
          displayName: b.replace(/^remotes\//, '')
        });
      }
    } else {
      localBranches.push({
        name: b,
        displayName: b
      });
    }
  });

  return (
    <div className="container">
      <div className="tabs">
        <div className={`tab ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>Log</div>
        <div className={`tab ${activeTab === 'local' ? 'active' : ''}`} onClick={() => { setActiveTab('local'); setSelectedIndex(-1); setSelectedCommitFiles(null); }}>
          Local Changes {gitData?.status?.files && gitData.status.files.length > 0 && `(${gitData.status.files.length})`}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {activeTab === 'log' ? (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="header">
                <button 
                  style={{ background: 'none', border: '1px solid var(--vscode-panel-border)', padding: '2px 8px', fontSize: '10px' }}
                  onClick={() => setShowBranches(!showBranches)}
                >
                  {filterBranch.startsWith('remotes/') ? filterBranch.replace(/^remotes\//, '') : filterBranch} ▾
                </button>
                {showBranches && (
                  <div className="branch-popup">
                    <div 
                      className={`branch-item ${filterBranch === 'ALL' ? 'active-filter' : ''}`}
                      onClick={() => handleFilter('ALL')}
                    >
                      {filterBranch === 'ALL' && <span style={{ marginRight: '6px' }}>✓</span>}
                      ALL
                    </div>
                    <div 
                      className={`branch-item ${filterBranch === 'HEAD' ? 'active-filter' : ''}`}
                      onClick={() => handleFilter('HEAD')}
                    >
                      {filterBranch === 'HEAD' && <span style={{ marginRight: '6px' }}>✓</span>}
                      HEAD
                    </div>
                    
                    <div 
                      className="branch-group-header"
                      onClick={() => setLocalExpanded(!localExpanded)}
                    >
                      <span className={`codicon ${localExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} style={{ marginRight: '6px', fontSize: '10px' }}></span>
                      Local Branches ({localBranches.length})
                    </div>
                    {localExpanded && localBranches.map((b) => (
                      <div 
                        key={b.name} 
                        className={`branch-item nested ${b.name === filterBranch ? 'active-filter' : ''} ${b.name === gitData.branches.current ? 'current' : ''}`}
                        onClick={() => handleFilter(b.name)}
                      >
                        {b.name === filterBranch && <span style={{ marginRight: '6px' }}>✓</span>}
                        {b.displayName}
                      </div>
                    ))}

                    <div 
                      className="branch-group-header"
                      onClick={() => setRemoteExpanded(!remoteExpanded)}
                    >
                      <span className={`codicon ${remoteExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} style={{ marginRight: '6px', fontSize: '10px' }}></span>
                      Remote Branches ({remoteBranches.length})
                    </div>
                    {remoteExpanded && remoteBranches.map((b) => (
                      <div 
                        key={b.name} 
                        className={`branch-item nested ${b.name === filterBranch ? 'active-filter' : ''}`}
                        onClick={() => handleFilter(b.name)}
                      >
                        {b.name === filterBranch && <span style={{ marginRight: '6px' }}>✓</span>}
                        {b.displayName}
                      </div>
                    ))}
                  </div>
                )}
                <span style={{ marginLeft: '20px' }}>{gitData?.log?.all.length || 0} commits</span>
              </div>
              <div className="table-container" style={{ flex: 1, position: 'relative' }}>
                {gitData?.log?.all && (
                  <div style={{ position: 'absolute', top: '28px', left: 0, pointerEvents: 'none', zIndex: 5 }}>
                    <GitGraph 
                      commits={gitData.log.all} 
                      rowHeight={24} 
                      onWidthChange={setGraphWidth}
                    />
                  </div>
                )}
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: `${graphWidth}px` }}>Graph</th>
                      <th>Description</th>
                      <th style={{ width: '150px' }}>Author</th>
                      <th style={{ width: '150px' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gitData?.log?.all.map((commit: any, idx: number) => (
                      <tr 
                        key={commit.hash} 
                        className={selectedIndex === idx ? 'selected' : ''}
                        onClick={() => handleSelectCommit(idx, commit.hash)}
                        onContextMenu={(e) => handleContextMenu(e, commit, idx)}
                      >
                        <td style={{ width: `${graphWidth}px` }}></td>
                        <td title={commit.message}>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <div style={{ display: 'flex', flexWrap: 'nowrap', marginRight: '8px' }}>
                              {renderRefs(commit.refs)}
                            </div>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{commit.message}</span>
                          </div>
                        </td>
                        <td>{commit.author_name}</td>
                        <td>{formatDate(commit.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {selectedIndex >= 0 && (
              <div className="side-pane">
                <div className="side-pane-header" onClick={() => setFilesExpanded(!filesExpanded)}>
                  <span className={`header-chevron codicon ${filesExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}></span>
                  Changed Files
                </div>
                {filesExpanded && (
                  <div className="file-tree-wrapper">
                    {isCompareMode && (
                      <div className="compare-banner">
                        <span>Comparing with HEAD</span>
                        <div className="compare-banner-close" onClick={(e) => {
                          e.stopPropagation();
                          setIsCompareMode(false);
                          if (selectedCommit) {
                            vscode.postMessage({ type: 'getDiff', hash: selectedCommit.hash });
                          }
                        }}>
                          <span className="codicon codicon-close" style={{ fontSize: '10px' }}></span>
                        </div>
                      </div>
                    )}
                    {selectedCommitFiles ? (
                      <FileTree files={selectedCommitFiles.files} onFileClick={handleFileClick} />
                    ) : (
                      <div style={{ padding: '10px', fontSize: '11px' }}>Loading files...</div>
                    )}
                  </div>
                )}
                
                <div className="side-pane-header" onClick={() => setDetailsExpanded(!detailsExpanded)}>
                  <span className={`header-chevron codicon ${detailsExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}></span>
                  Commit Details
                </div>
                {detailsExpanded && (
                  <div className="commit-details">
                    <div className="detail-row">
                      <b>{selectedCommit?.message}</b>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Commit:</span>
                      <span className="detail-value">{selectedCommit?.hash.substring(0, 8)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Author:</span>
                      <span className="detail-value">{selectedCommit?.author_name} &lt;{selectedCommit?.author_email}&gt;</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Date:</span>
                      <span className="detail-value">{formatDate(selectedCommit?.date)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Labels:</span>
                      <span className="detail-value">{renderRefs(selectedCommit?.refs)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="local-changes-container" style={{ flex: 1 }}>
            <div className="files-list">
              {gitData?.status?.files && gitData.status.files.length > 0 ? (
                <FileTree
                  files={gitData.status.files.map((f: any) => {
                    const getStatusChar = () => {
                      const ind = f.index;
                      const wd = f.working_dir;
                      if (ind === '?' || wd === '?') return '?';
                      if (ind === 'D' || wd === 'D') return 'D';
                      if (ind === 'A' || wd === 'A') return 'A';
                      if (ind === 'R' || wd === 'R') return 'R';
                      return 'M';
                    };
                    return {
                      path: f.path,
                      status: getStatusChar()
                    };
                  })}
                  onFileClick={handleLocalFileClick}
                  checkboxes={true}
                  checkedPaths={checkedFiles}
                  onCheckChange={handleCheckChange}
                />
              ) : (
                <p style={{ padding: '10px', fontSize: '11px', opacity: 0.6 }}>No local changes.</p>
              )}
            </div>
            <div className="commit-box">
              <textarea 
                placeholder="Commit message" 
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <button 
                  onClick={handleCommit} 
                  disabled={!commitMessage.trim() || checkedFiles.size === 0}
                >
                  Commit
                </button>
                <button 
                  onClick={handleCommitAndPush} 
                  disabled={!commitMessage.trim() || checkedFiles.size === 0}
                  style={{ marginLeft: '8px' }}
                >
                  Commit and Push
                </button>
                <label style={{ marginLeft: '12px', display: 'inline-flex', alignItems: 'center', fontSize: '11px', cursor: 'pointer', userSelect: 'none' }}>
                  <input 
                    type="checkbox" 
                    checked={forcePush} 
                    onChange={(e) => setForcePush(e.target.checked)} 
                    style={{ marginRight: '4px', cursor: 'pointer' }}
                  />
                  Force Push
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
      {contextMenu && contextMenu.visible && (
        <div 
          className="context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={() => handleContextAction('copySHA')}>
            <span className="codicon codicon-copy"></span>
            <span className="context-menu-label">Copy SHA</span>
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('copyShortSHA')}>
            <span className="codicon codicon-copy"></span>
            <span className="context-menu-label">Copy Short SHA</span>
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('copyMessage')}>
            <span className="codicon codicon-copy"></span>
            <span className="context-menu-label">Copy Message</span>
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('copyURL')}>
            <span className="codicon codicon-link"></span>
            <span className="context-menu-label">Copy URL</span>
          </div>
          
          <div className="context-menu-separator"></div>
          
          <div className="context-menu-item" onClick={() => handleContextAction('createBranch')}>
            <span className="codicon codicon-git-branch"></span>
            <span className="context-menu-label">Create Branch...</span>
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('createTag')}>
            <span className="codicon codicon-tag"></span>
            <span className="context-menu-label">Create Tag...</span>
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('createWorktree')}>
            <span className="codicon codicon-worktree"></span>
            <span className="context-menu-label">Create Worktree...</span>
            <span className="pro-badge">Pro</span>
          </div>
          
          <div className="context-menu-separator"></div>
          
          <div className="context-menu-item" onClick={() => handleContextAction('cherryPick')}>
            <span className="codicon codicon-git-merge"></span>
            <span className="context-menu-label">Cherry Pick</span>
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('cherryPickWithWorktree')}>
            <span className="codicon codicon-git-merge"></span>
            <span className="context-menu-label">Cherry Pick (with worktree)</span>
            <span className="pro-badge">Pro</span>
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('revertCommit')}>
            <span className="codicon codicon-discard"></span>
            <span className="context-menu-label">Revert Commit</span>
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('rebase')}>
            <span className="codicon codicon-sync"></span>
            <span className="context-menu-label">Rebase Current Branch onto This</span>
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('merge')}>
            <span className="codicon codicon-merge"></span>
            <span className="context-menu-label">Merge into Current Branch...</span>
          </div>
          
          <div className="context-menu-separator"></div>
          
          <div className="context-menu-item" onClick={() => handleContextAction('compare')}>
            <span className="codicon codicon-git-compare"></span>
            <span className="context-menu-label">Compare with Current Branch</span>
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('viewDetails')}>
            <span className="codicon codicon-inspect"></span>
            <span className="context-menu-label">View Details</span>
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('openInBrowser')}>
            <span className="codicon codicon-link-external"></span>
            <span className="context-menu-label">Open in Browser</span>
          </div>
          <div className="context-menu-item" onClick={() => handleContextAction('viewDiff')}>
            <span className="codicon codicon-diff"></span>
            <span className="context-menu-label">View Diff</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
