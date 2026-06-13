import React, { useState, useEffect, useRef } from 'react';

interface RewordModalProps {
  isOpen: boolean;
  hash: string;
  initialMessage: string;
  onClose: () => void;
  onSubmit: (hash: string, message: string) => void;
}

export function RewordModal({
  isOpen,
  hash,
  initialMessage,
  onClose,
  onSubmit,
}: RewordModalProps) {
  const [message, setMessage] = useState(initialMessage);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync state when initialMessage changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setMessage(initialMessage);
      // Auto focus and place cursor at the end of text
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

  if (!isOpen) return null;

  const handleSave = () => {
    onSubmit(hash, message);
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
      <div className="modal-container">
        <div className="modal-header">
          <div className="modal-header-title">
            <span className="codicon codicon-edit"></span>
            <span>Edit Commit Message ({hash.substring(0, 7)})</span>
          </div>
          <button className="modal-close-button" onClick={onClose} title="Close">
            <span className="codicon codicon-close"></span>
          </button>
        </div>
        <div className="modal-body">
          <textarea
            ref={textareaRef}
            className="modal-textarea"
            placeholder="Write your commit message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="modal-help-text">
            <span>Press Ctrl+Enter to save, Esc to cancel</span>
            <span>{message.length} characters</span>
          </div>
        </div>
        <div className="modal-footer">
          <button className="modal-button modal-button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="modal-button modal-button-primary" 
            onClick={handleSave}
            disabled={!message.trim()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
