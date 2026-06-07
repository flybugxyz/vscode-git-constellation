import React, { useRef, useLayoutEffect, useState } from 'react';
import { Commit } from './types';
import { formatDate } from './utils';

interface CommitHoverPopupProps {
  commit: Commit;
  x: number;
  y: number;
}

export const CommitHoverPopup: React.FC<CommitHoverPopupProps> = ({ commit, x, y }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Position the tooltip slightly offset to the bottom-right of the cursor
    let left = x + 15;
    let top = y + 15;

    // Check right edge boundary
    if (left + width > window.innerWidth) {
      left = x - width - 10;
    }
    // Check bottom edge boundary
    if (top + height > window.innerHeight) {
      top = y - height - 10;
    }

    // Ensure we don't go off screen at the top/left
    left = Math.max(10, left);
    top = Math.max(10, top);

    setCoords({ left, top });
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="commit-hover-popup"
      style={{
        left: `${coords.left}px`,
        top: `${coords.top}px`,
      }}
    >
      <div className="hover-popup-header">
        <span className="hover-popup-hash" title="Full SHA">{commit.hash}</span>
      </div>
      <div className="hover-popup-message">{commit.message}</div>
      <div className="hover-popup-meta">
        <div className="hover-popup-meta-row">
          <span className="hover-popup-meta-label">Author:</span>
          <span className="hover-popup-meta-value">{commit.author_name} &lt;{commit.author_email}&gt;</span>
        </div>
        <div className="hover-popup-meta-row">
          <span className="hover-popup-meta-label">Date:</span>
          <span className="hover-popup-meta-value">{formatDate(commit.date)}</span>
        </div>
        {commit.refs && (
          <div className="hover-popup-meta-row" style={{ marginTop: '4px' }}>
            <span className="hover-popup-meta-label">Refs:</span>
            <span className="hover-popup-meta-value">
              {commit.refs.split(',').map((ref: string) => ref.trim()).join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
