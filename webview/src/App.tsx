import React, { useEffect, useState } from 'react';
import './styles.css';

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

function App() {
  const [gitData, setGitData] = useState<any>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  useEffect(() => {
    vscode.postMessage({ type: 'ready' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'update':
          setGitData(message.payload);
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

  return (
    <div className="container">
      <div className="header">
        {gitData?.branches?.current && <span>Branch: <b>{gitData.branches.current}</b></span>}
        <span style={{ marginLeft: '20px' }}>{gitData?.log?.all.length || 0} commits</span>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th className="graph-col">Graph</th>
              <th className="message-col">Description</th>
              <th className="author-col">Author</th>
              <th className="date-col">Date</th>
            </tr>
          </thead>
          <tbody>
            {gitData?.log?.all.map((commit: any, idx: number) => (
              <tr 
                key={commit.hash} 
                className={selectedIndex === idx ? 'selected' : ''}
                onClick={() => setSelectedIndex(idx)}
              >
                <td className="graph-col">
                  {/* Graph placeholder */}
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#4a9eff', margin: 'auto' }}></div>
                </td>
                <td className="message-col" title={commit.message}>{commit.message}</td>
                <td className="author-col">{commit.author_name}</td>
                <td className="date-col">{formatDate(parseInt(commit.date))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
