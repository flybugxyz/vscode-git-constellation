import React, { useState, useEffect, useRef } from 'react';

interface SquashModalProps {
  isOpen: boolean;
  hashes: string[];
  initialMessage: string;
  onClose: () => void;
  onSubmit: (hashes: string[], message: string) => void;
  vscode: { postMessage: (msg: any) => void };
}

export function SquashModal({
  isOpen,
  hashes,
  initialMessage,
  onClose,
  onSubmit,
  vscode,
}: SquashModalProps) {
  const [message, setMessage] = useState(initialMessage);
  const [isGenerating, setIsGenerating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMessage(initialMessage);
      setIsGenerating(false);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            textareaRef.current.value.length,
            textareaRef.current.value.length
          );
        }
      }, 50);
    }
  }, [isOpen, initialMessage]);

  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.type === 'refineSquashMessageProgress') {
        if (msg.chunk) {
          setMessage((prev) => prev + msg.chunk);
        }
      } else if (msg.type === 'refineSquashMessageResult') {
        setIsGenerating(false);
        if (msg.message) {
          setMessage(msg.message);
        }
      } else if (msg.type === 'refineSquashMessageError') {
        setIsGenerating(false);
        // Error is shown by vscode host message
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSubmit(hashes, message);
  };

  const handleRefineWithAI = () => {
    setIsGenerating(true);
    setMessage(''); // Clear text to show streaming
    vscode.postMessage({
      type: 'refineSquashMessage',
      hashes,
      defaultMessage: initialMessage,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-container" style={{ maxWidth: '600px', width: '90%' }}>
        <div className="modal-header">
          <div className="modal-header-title">
            <span className="codicon codicon-arrow-both"></span>
            <span>Squash Commits ({hashes.length} selected)</span>
          </div>
          <button className="modal-close-button" onClick={onClose} title="Close">
            <span className="codicon codicon-close"></span>
          </button>
        </div>
        
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="squash-commits-list" style={{ 
            maxHeight: '120px', 
            overflowY: 'auto', 
            padding: '8px', 
            background: 'var(--vscode-editor-background)', 
            border: '1px solid var(--vscode-panel-border)',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: 'var(--vscode-editor-font-family, monospace)',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ fontWeight: 'bold', color: 'var(--vscode-descriptionForeground)', marginBottom: '4px' }}>
              Commits to be merged:
            </div>
            {hashes.map((hash, i) => (
              <div key={hash} style={{ display: 'flex', gap: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                <span style={{ color: 'var(--vscode-textLink-foreground)', fontWeight: 'bold' }}>{hash.substring(0, 7)}</span>
                <span style={{ opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {i === 0 ? '(Newest) ' : i === hashes.length - 1 ? '(Oldest) ' : ''}
                </span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 'bold', fontSize: '12px' }}>Squash Commit Message</span>
            <button 
              className="modal-button modal-button-secondary"
              onClick={handleRefineWithAI}
              disabled={isGenerating}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                padding: '4px 10px', 
                fontSize: '11px', 
                background: 'var(--vscode-button-secondaryBackground)',
                borderColor: 'var(--vscode-button-border)'
              }}
            >
              <span className={`codicon ${isGenerating ? 'codicon-loading codicon-modifier-spin' : 'codicon-sparkle'}`}></span>
              <span>{isGenerating ? 'Refining with AI...' : 'Refine with AI'}</span>
            </button>
          </div>

          <textarea
            ref={textareaRef}
            className="modal-textarea"
            placeholder="Write squash commit message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ minHeight: '150px' }}
            disabled={isGenerating}
          />
          
          <div className="modal-help-text">
            <span>Press Ctrl+Enter to save, Esc to cancel</span>
            <span>{message.length} characters</span>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-button modal-button-secondary" onClick={onClose} disabled={isGenerating}>
            Cancel
          </button>
          <button 
            className="modal-button modal-button-primary" 
            onClick={handleSave}
            disabled={!message.trim() || isGenerating}
          >
            Squash
          </button>
        </div>
      </div>
    </div>
  );
}
