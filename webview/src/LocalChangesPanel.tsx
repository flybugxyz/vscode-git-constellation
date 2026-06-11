import React, { useState, useCallback } from 'react';
import { FileTree } from './FileTree';
import { GitStatusFile } from './types';
import { useGitData } from './GitDataContext';

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

  const files = gitData?.status?.files || [];

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
    vscode.postMessage({ type: 'openDiff', hash: '', path });
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
    vscode.postMessage({ type: 'generateCommitMessage', files: Array.from(checkedFiles) });
  };

  return (
    <div className="local-changes-container" style={{ flex: 1 }}>
      <div className="files-list">
        {files && files.length > 0 ? (
          <FileTree
            files={files.map((f) => ({
              path: f.path,
              status: getStatusChar(f),
            }))}
            onFileClick={onFileClick}
            checkboxes={true}
            checkedPaths={checkedFiles}
            onCheckChange={handleCheckChange}
            onDiscard={onDiscard}
            rootNodeName="Changed"
            expandedNodes={expandedNodes}
            setExpandedNodes={setExpandedNodes}
          />
        ) : (
          <p style={{ padding: '10px', fontSize: '11px', opacity: 0.6 }}>No local changes.</p>
        )}
      </div>
      <div className="commit-box" style={{ height: `${commitBoxHeight}px`, display: 'flex', flexDirection: 'column', position: 'relative' }}>
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
    </div>
  );
}
