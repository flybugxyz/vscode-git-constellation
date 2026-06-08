import React, { useState } from 'react';
import { FileTree } from './FileTree';
import { GitStatusFile } from './types';

function getStatusChar(f: GitStatusFile): string {
  const ind = f.index;
  const wd = f.working_dir;
  if (ind === '?' || wd === '?') return '?';
  if (ind === 'D' || wd === 'D') return 'D';
  if (ind === 'A' || wd === 'A') return 'A';
  if (ind === 'R' || wd === 'R') return 'R';
  return 'M';
}

interface LocalChangesPanelProps {
  files: GitStatusFile[];
  checkedFiles: Set<string>;
  commitBoxHeight: number;
  onCheckChange: (path: string, checked: boolean, filePaths: string[]) => void;
  onFileClick: (path: string) => void;
  onDiscard: (path: string) => void;
  onCommit: (message: string, files: string[]) => void;
  onCommitAndPush: (message: string, files: string[], force: boolean) => void;
  onGenerateAI: (files: string[]) => void;
  onStartResizeCommitBox: (startY: number, startHeight: number) => void;
  isGenerating: boolean;
  commitMessage: string;
  onCommitMessageChange: (msg: string) => void;
  onGenerateResult: (msg: string) => void;
}

export function LocalChangesPanel({
  files,
  checkedFiles,
  commitBoxHeight,
  onCheckChange,
  onFileClick,
  onDiscard,
  onCommit,
  onCommitAndPush,
  onGenerateAI,
  onStartResizeCommitBox,
  isGenerating,
  commitMessage,
  onCommitMessageChange,
}: LocalChangesPanelProps) {
  const [forcePush, setForcePush] = useState(false);

  const handleCommit = () => {
    if (!commitMessage.trim() || checkedFiles.size === 0) return;
    onCommit(commitMessage, Array.from(checkedFiles));
    onCommitMessageChange('');
  };

  const handleCommitAndPush = () => {
    if (!commitMessage.trim() || checkedFiles.size === 0) return;
    onCommitAndPush(commitMessage, Array.from(checkedFiles), forcePush);
    onCommitMessageChange('');
  };

  const handleGenerateAI = () => {
    if (checkedFiles.size === 0) return;
    onGenerateAI(Array.from(checkedFiles));
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
            onCheckChange={onCheckChange}
            onDiscard={onDiscard}
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
          onChange={(e) => onCommitMessageChange(e.target.value)}
          style={{ flex: 1, resize: 'none' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: '8px' }}>
          <button 
            onClick={handleCommit} 
            disabled={!commitMessage.trim() || checkedFiles.size === 0}
          >
            Commit
          </button>
          <button 
            className="button-secondary"
            onClick={handleCommitAndPush} 
            disabled={!commitMessage.trim() || checkedFiles.size === 0}
          >
            Commit and Push
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
