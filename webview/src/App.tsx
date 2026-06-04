import React, { useEffect, useState } from 'react';
import './styles.css';

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

function App() {
  const [gitData, setGitData] = useState<any>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [activeTab, setActiveTab] = useState<'log' | 'local'>('log');
  const [commitMessage, setCommitMessage] = useState('');
  const [diff, setDiff] = useState<string>('');

  useEffect(() => {
    vscode.postMessage({ type: 'ready' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'update':
          setGitData(message.payload);
          break;
        case 'diff':
          setDiff(message.diff);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleCommit = () => {
    if (!commitMessage.trim()) return;
    vscode.postMessage({ type: 'commit', message: commitMessage });
    setCommitMessage('');
  };

  const handleSelectCommit = (idx: number, hash: string) => {
    setSelectedIndex(idx);
    setDiff('Loading diff...');
    vscode.postMessage({ type: 'getDiff', hash });
  };

  const renderDiff = (diffText: string) => {
    return diffText.split('\n').map((line, i) => {
      let className = '';
      if (line.startsWith('+') && !line.startsWith('+++')) className = 'diff-line-added';
      else if (line.startsWith('-') && !line.startsWith('---')) className = 'diff-line-removed';
      else if (line.startsWith('diff') || line.startsWith('@@')) className = 'diff-header';
      
      return <div key={i} className={className}>{line}</div>;
    });
  };

  return (
    <div className="container">
      <div className="tabs">
        <div className={`tab ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>Log</div>
        <div className={`tab ${activeTab === 'local' ? 'active' : ''}`} onClick={() => { setActiveTab('local'); setSelectedIndex(-1); setDiff(''); }}>
          Local Changes {gitData?.status?.files.length > 0 && `(${gitData.status.files.length})`}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
        {activeTab === 'log' ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div className="header">
              {gitData?.branches?.current && <span>Branch: <b>{gitData.branches.current}</b></span>}
              <span style={{ marginLeft: '20px' }}>{gitData?.log?.all.length || 0} commits</span>
            </div>
            <div className="table-container" style={{ flex: selectedIndex >= 0 ? 1 : 2 }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '100px' }}>Graph</th>
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
                      <td>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#4a9eff', margin: 'auto' }}></div>
                      </td>
                      <td title={commit.message}>{commit.message}</td>
                      <td>{commit.author_name}</td>
                      <td>{formatDate(parseInt(commit.date))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selectedIndex >= 0 && (
              <div className="diff-container">
                {renderDiff(diff)}
              </div>
            )}
          </div>
        ) : (
          <div className="local-changes-container">
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
