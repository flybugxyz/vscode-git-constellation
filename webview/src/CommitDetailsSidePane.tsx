import React, { useState } from 'react';
import { FileTree } from './FileTree';
import { Commit } from './types';
import { formatDate } from './utils';

interface CommitDetailsSidePaneProps {
  commit: Commit | null;
  files: { hash: string; files: { status: string; path: string }[] } | null;
  isCompareMode: boolean;
  filesExpanded: boolean;
  detailsExpanded: boolean;
  onClose: () => void;
  onFileClick: (path: string) => void;
  onExitCompare: () => void;
  onToggleFiles: () => void;
  onToggleDetails: () => void;
  renderRefs: (refs: string) => React.ReactNode;
}

export function CommitDetailsSidePane({
  commit,
  files,
  isCompareMode,
  filesExpanded,
  detailsExpanded,
  onClose,
  onFileClick,
  onExitCompare,
  onToggleFiles,
  onToggleDetails,
  renderRefs,
}: CommitDetailsSidePaneProps) {
  return (
    <div className="side-pane">
      <div className="side-pane-title-bar">
        <span>Commit Details</span>
        <span 
          className="codicon codicon-close side-pane-close" 
          title="Close Details"
          onClick={onClose}
        ></span>
      </div>
      <div className="side-pane-header" onClick={onToggleFiles}>
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
                onExitCompare();
              }}>
                <span className="codicon codicon-close" style={{ fontSize: '10px' }}></span>
              </div>
            </div>
          )}
          {files ? (
            <FileTree files={files.files} onFileClick={onFileClick} />
          ) : (
            <div style={{ padding: '10px', fontSize: '11px' }}>Loading files...</div>
          )}
        </div>
      )}
      
      <div className="side-pane-header" onClick={onToggleDetails}>
        <span className={`header-chevron codicon ${detailsExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}></span>
        Commit Details
      </div>
      {detailsExpanded && (
        <div className="commit-details">
          <div className="detail-row" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            <b>{commit?.message}</b>
          </div>
          <div className="detail-row">
            <span className="detail-label">Commit:</span>
            <span className="detail-value">{commit?.hash.substring(0, 8)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Author:</span>
            <span className="detail-value">{commit?.author_name} &lt;{commit?.author_email}&gt;</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Date:</span>
            <span className="detail-value">{formatDate(commit?.date || '', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Labels:</span>
            <span className="detail-value">{renderRefs(commit?.refs || '')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
