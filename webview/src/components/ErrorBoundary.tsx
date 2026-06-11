import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  vscode: { postMessage: (msg: any) => void };
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in GitConstellation webview:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    this.props.vscode.postMessage({ type: 'ready' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '24px',
          color: 'var(--vscode-errorForeground)',
          background: 'var(--vscode-editor-background)',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--vscode-font-family)',
          fontSize: '13px'
        }}>
          <span className="codicon codicon-error" style={{ fontSize: '36px', marginBottom: '12px' }}></span>
          <h3 style={{ margin: '0 0 8px 0' }}>An error occurred in GitConstellation</h3>
          <p style={{ margin: '0 0 16px 0', opacity: 0.8, maxWidth: '400px', textAlign: 'center', wordBreak: 'break-word' }}>
            {this.state.error?.message || 'Unknown rendering error'}
          </p>
          <button 
            onClick={this.handleReload}
            style={{
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '2px',
              cursor: 'pointer'
            }}
          >
            Reload UI
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
