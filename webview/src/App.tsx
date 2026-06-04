import React, { useEffect, useState } from 'react';
import './styles.css';
import { GitGraph } from './GitGraph';
import { FileTree } from './FileTree';

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

function App() {
  const [gitData, setGitData] = useState<any>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [activeTab, setActiveTab] = useState<'log' | 'local'>('log');
  const [commitMessage, setCommitMessage] = useState('');
  const [showBranches, setShowBranches] = useState(false);
  const [selectedCommitFiles, setSelectedCommitFiles] = useState<{hash: string, files: {status: string, path: string}[]} | null>(null);
  
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [graphWidth, setGraphWidth] = useState(100);

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
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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
    if (!commitMessage.trim()) return;
    vscode.postMessage({ type: 'commit', message: commitMessage });
    setCommitMessage('');
  };

  const handleSelectCommit = (idx: number, hash: string) => {
    setSelectedIndex(idx);
    vscode.postMessage({ type: 'getDiff', hash });
  };

  const handleCheckout = (branch: string) => {
    vscode.postMessage({ type: 'checkout', branch });
    setShowBranches(false);
  };

  const handleFileClick = (path: string) => {
    if (selectedCommitFiles) {
      vscode.postMessage({ type: 'openDiff', hash: selectedCommitFiles.hash, path });
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

  return (
    <div className="container">
      <div className="tabs">
        <div className={`tab ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>Log</div>
        <div className={`tab ${activeTab === 'local' ? 'active' : ''}`} onClick={() => { setActiveTab('local'); setSelectedIndex(-1); setSelectedCommitFiles(null); }}>
          Local Changes {gitData?.status?.files.length > 0 && `(${gitData.status.files.length})`}
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
                  {gitData?.branches?.current || 'Branches'} ▾
                </button>
                {showBranches && (
                  <div className="branch-popup">
                    {gitData?.branches?.all.map((b: string) => (
                      <div 
                        key={b} 
                        className={`branch-item ${b === gitData.branches.current ? 'current' : ''}`}
                        onClick={() => handleCheckout(b)}
                      >
                        {b}
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
              {gitData?.status?.files.map((file: any) => (
                <div key={file.path} className="file-item">
                  <span style={{ marginRight: '8px', color: file.index === '?' ? '#d16969' : '#e2c08d' }}>
                    {file.working_dir || file.index}
                  </span>
                  {file.path}
                </div>
              ))}
              {gitData?.status?.files.length === 0 && <p>No local changes.</p>}
            </div>
            <div className="commit-box">
              <textarea 
                placeholder="Commit message" 
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
              />
              <button onClick={handleCommit} disabled={!commitMessage.trim()}>Commit</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
