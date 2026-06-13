import React, { useState, useEffect } from 'react';
import { useGitData } from '../GitDataContext';

interface SearchResult {
  filePath: string;
  timestamp: number;
  codeBlock?: string;
  explanation?: string;
  summary?: string;
}

export function LocalHistoryTab() {
  const { gitData, vscode, activeTab } = useGitData();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isEnabled = !!gitData?.localHistoryEnabled;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'searchLocalHistoryResult') {
        setIsSearching(false);
        if (msg.error) {
          setError(msg.error);
          setResults([]);
        } else {
          setResults(msg.results || []);
          setMessage(msg.message || '');
          setError('');
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Fetch recent snapshots on mount, tab active, or query cleared
  useEffect(() => {
    if (isEnabled && activeTab === 'history' && query.trim() === '') {
      setIsSearching(true);
      setResults([]);
      setMessage('');
      setError('');
      vscode.postMessage({ type: 'searchLocalHistory', query: '' });
    }
  }, [isEnabled, activeTab, query, vscode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isSearching) return;
    setIsSearching(true);
    setResults([]);
    setMessage('');
    setError('');
    vscode.postMessage({ type: 'searchLocalHistory', query });
  };

  const handleEnable = () => {
    vscode.postMessage({ type: 'openSettings', setting: 'git-constellation.localHistory.enabled' });
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    vscode.postMessage({ type: 'copyMessage', message: 'Code copied to clipboard!' }); // re-use copy message toast
  };

  const handleRestore = (filePath: string, timestamp: number) => {
    vscode.postMessage({ type: 'restoreLocalHistoryFilePrompt', filePath, timestamp });
  };

  if (!isEnabled) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%', overflowY: 'auto' }}>
        <div style={{
          border: '1px solid var(--vscode-notificationsWarning-border, #e5c07b)',
          background: 'var(--vscode-notificationsWarning-background, #3e3729)',
          color: 'var(--vscode-notificationsWarning-foreground, #abb2bf)',
          padding: '16px',
          borderRadius: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', fontSize: '13px' }}>
            <span className="codicon codicon-warning" style={{ fontSize: '16px', color: 'var(--vscode-statusBarItem-warningBackground, #e5c07b)' }}></span>
            <span>Local History Tracking is Disabled</span>
          </div>
          <p style={{ margin: 0, fontSize: '12px', lineHeight: '1.5', opacity: 0.9 }}>
            Local History AI Searcher tracks your file saves locally to enable natural-language code retrieval.
            This works offline and runs locally, but may consume additional background performance and disk space for snapshot files.
          </p>
          <div>
            <button 
              className="modal-button modal-button-primary" 
              onClick={handleEnable}
              style={{ padding: '4px 12px', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <span className="codicon codicon-settings-gear"></span>
              <span>Enable in Settings</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Search Header */}
      <form onSubmit={handleSearch} style={{ 
        display: 'flex', 
        gap: '8px', 
        padding: '12px', 
        borderBottom: '1px solid var(--vscode-panel-border)', 
        alignItems: 'center',
        flexShrink: 0
      }}>
        <input
          type="text"
          placeholder="Search deleted code (e.g. 'auth helper function from yesterday afternoon')"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={isSearching}
          style={{
            flex: 1,
            padding: '6px 10px',
            fontSize: '12px',
            border: '1px solid var(--vscode-input-border)',
            background: 'var(--vscode-input-background)',
            color: 'var(--vscode-input-foreground)',
            borderRadius: '4px'
          }}
        />
        <button
          type="submit"
          disabled={!query.trim() || isSearching}
          className="modal-button modal-button-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '28px', padding: '0 12px' }}
        >
          <span className={`codicon ${isSearching ? 'codicon-loading codicon-modifier-spin' : 'codicon-sparkle'}`}></span>
          <span>{isSearching ? 'Searching...' : 'Search with AI'}</span>
        </button>
      </form>

      {/* Results Box */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {isSearching && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px', opacity: 0.6 }}>
            <span className="codicon codicon-loading codicon-modifier-spin" style={{ fontSize: '24px' }}></span>
            <span style={{ fontSize: '12px' }}>AI is parsing and analyzing file snapshots...</span>
          </div>
        )}

        {!isSearching && results.length === 0 && !message && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.4, gap: '8px' }}>
            <span className="codicon codicon-search" style={{ fontSize: '32px' }}></span>
            <span style={{ fontSize: '11px' }}>Enter a query above to search local history snapshots using AI.</span>
          </div>
        )}

        {error && (
          <div style={{ color: 'var(--vscode-errorForeground)', fontSize: '12px', padding: '8px' }}>
            ❌ Error: {error}
          </div>
        )}

        {message && !error && results.length === 0 && (
          <div style={{ fontSize: '12px', opacity: 0.6, padding: '8px' }}>
            ℹ️ {message}
          </div>
        )}

        {!isSearching && results.map((res, index) => (
          <div key={index} style={{
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: '6px',
            background: 'var(--vscode-editor-background)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '6px 12px',
              background: 'var(--vscode-tab-inactiveBackground)',
              borderBottom: '1px solid var(--vscode-panel-border)',
              fontSize: '11px'
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span className="codicon codicon-file-code" style={{ color: 'var(--vscode-textLink-foreground)' }}></span>
                <span style={{ fontWeight: 'bold' }}>{res.filePath}</span>
                <span style={{ opacity: 0.6 }}>({new Date(res.timestamp).toLocaleString()})</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {res.codeBlock && (
                  <button 
                    className="modal-button modal-button-secondary" 
                    onClick={() => handleCopy(res.codeBlock!)}
                    style={{ padding: '2px 8px', fontSize: '10px', height: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span className="codicon codicon-copy"></span>
                    <span>Copy Code</span>
                  </button>
                )}
                <button 
                  className="modal-button modal-button-primary" 
                  onClick={() => handleRestore(res.filePath, res.timestamp)}
                  style={{ padding: '2px 8px', fontSize: '10px', height: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <span className="codicon codicon-history"></span>
                  <span>Restore File</span>
                </button>
              </div>
            </div>
            
            {res.explanation && (
              <div style={{
                padding: '8px 12px',
                fontSize: '11px',
                background: 'var(--vscode-editor-background)',
                borderBottom: '1px solid var(--vscode-panel-border)',
                fontStyle: 'italic',
                opacity: 0.8
              }}>
                💡 {res.explanation}
              </div>
            )}

            {res.codeBlock ? (
              <pre style={{
                margin: 0,
                padding: '12px',
                overflowX: 'auto',
                fontSize: '11px',
                fontFamily: 'var(--vscode-editor-font-family, monospace)',
                background: 'var(--vscode-editor-background)',
                color: 'var(--vscode-editor-foreground)'
              }}>
                <code>{res.codeBlock}</code>
              </pre>
            ) : res.summary ? (
              <div style={{ padding: '12px', fontSize: '11px', opacity: 0.8 }}>
                {res.summary}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
