import React, { useEffect, useState } from 'react';

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

function App() {
  const [gitData, setGitData] = useState<any>(null);

  useEffect(() => {
    // Tell the extension we are ready
    vscode.postMessage({ type: 'ready' });

    // Handle messages from the extension
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

  return (
    <div style={{ padding: '10px', fontFamily: 'var(--vscode-font-family)', color: 'var(--vscode-foreground)' }}>
      <h1>Git JB Log</h1>
      {gitData ? (
        <div>
          <p>Latest Commit: {gitData.log?.all[0]?.message}</p>
          <p>Branch: {gitData.branches?.current}</p>
          <p>Local Changes: {gitData.status?.files.length} files</p>
        </div>
      ) : (
        <p>Loading git data...</p>
      )}
    </div>
  );
}

export default App;
