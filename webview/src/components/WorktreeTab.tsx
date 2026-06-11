import React from 'react';
import { useGitData } from '../GitDataContext';

export function WorktreeTab() {
  const { gitData, vscode } = useGitData();
  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      <div className="stash-panel">
        <div className="header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              style={{ background: 'none', border: '1px solid var(--vscode-panel-border)', padding: '2px 8px', fontSize: '10px' }}
              onClick={() => vscode.postMessage({ type: 'pruneWorktrees' })}
            >
              Prune Worktrees
            </button>
            <span style={{ marginLeft: '20px' }}>{gitData?.worktrees?.length || 0} worktrees</span>
          </div>
          <div className="header-actions">
            <button 
              className="toolbar-button" 
              title="Refresh Worktree List"
              onClick={() => vscode.postMessage({ type: 'ready' })}
            >
              <span className="codicon codicon-refresh"></span>
            </button>
          </div>
        </div>

        <div className="table-container" style={{ flex: 1 }}>
          <table style={{ tableLayout: 'fixed', width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 'auto' }}>Path</th>
                <th style={{ width: '180px' }}>Branch</th>
                <th style={{ width: '100px' }}>Commit</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {gitData?.worktrees && gitData.worktrees.length > 0 ? (
                gitData.worktrees.map((wt) => (
                  <tr key={wt.path}>
                    <td style={{ borderRight: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={wt.path}>
                      {wt.isMain && (
                        <span className="label-pill label-branch" style={{ cursor: 'default', margin: '0 6px 0 0', padding: '1px 4px', fontSize: '9px' }}>Main</span>
                      )}
                      {wt.path}
                    </td>
                    <td>{wt.branch}</td>
                    <td>{wt.commit ? wt.commit.substring(0, 7) : ''}</td>
                    <td style={{ textAlign: 'center', padding: '0 4px', borderRight: 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', height: '100%' }}>
                        <button
                          className="toolbar-button"
                          title="Open in New Window"
                          onClick={() => vscode.postMessage({ type: 'openWorktree', path: wt.path })}
                          style={{ padding: '2px', background: 'transparent', border: 'none', display: 'inline-flex' }}
                        >
                          <span className="codicon codicon-open-in-window" style={{ fontSize: '14px' }}></span>
                        </button>
                        {!wt.isMain && (
                          <button
                            className="toolbar-button"
                            title="Remove Worktree"
                            onClick={() => vscode.postMessage({ type: 'removeWorktree', path: wt.path })}
                            style={{ padding: '2px', background: 'transparent', border: 'none', display: 'inline-flex', color: 'var(--vscode-errorForeground)' }}
                          >
                            <span className="codicon codicon-trash" style={{ fontSize: '14px' }}></span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', opacity: 0.6, padding: '20px 0' }}>No worktrees found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
