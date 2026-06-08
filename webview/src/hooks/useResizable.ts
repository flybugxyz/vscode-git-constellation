import { useState, useEffect } from 'react';

function readPersistedWidth(key: string, defaultValue: number): number {
  const saved = localStorage.getItem(key);
  return saved ? parseInt(saved, 10) : defaultValue;
}

export interface UseResizableReturn {
  /** Description column width */
  descWidth: number;
  /** Author column width */
  authorWidth: number;
  /** Date column width */
  dateWidth: number;
  /** Commit message box height */
  commitBoxHeight: number;
  /** Start a column resize drag. Call from onMouseDown on a resize handle. */
  startColumnResize: (col: 'desc' | 'author' | 'date', startX: number, startWidth: number) => void;
  /** Start a commit box height resize drag. Call from onMouseDown on the row resize handle. */
  startCommitBoxResize: (startY: number, startHeight: number) => void;
}

export function useResizable(): UseResizableReturn {
  const [descWidth, setDescWidth] = useState<number>(() => readPersistedWidth('git-constellation-desc-width', 450));
  const [authorWidth, setAuthorWidth] = useState<number>(() => readPersistedWidth('git-constellation-author-width', 150));
  const [dateWidth, setDateWidth] = useState<number>(() => readPersistedWidth('git-constellation-date-width', 150));
  const [resizing, setResizing] = useState<{ col: 'desc' | 'author' | 'date'; startX: number; startWidth: number } | null>(null);

  const [commitBoxHeight, setCommitBoxHeight] = useState<number>(() => readPersistedWidth('git-constellation-commit-box-height', 130));
  const [resizingCommitBox, setResizingCommitBox] = useState<{ startY: number; startHeight: number } | null>(null);

  // Column resize effect
  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizing.startX;
      const newWidth = Math.max(50, resizing.startWidth + deltaX);
      if (resizing.col === 'desc') {
        setDescWidth(newWidth);
      } else if (resizing.col === 'author') {
        setAuthorWidth(newWidth);
      } else if (resizing.col === 'date') {
        setDateWidth(newWidth);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const deltaX = e.clientX - resizing.startX;
      const newWidth = Math.max(50, resizing.startWidth + deltaX);
      localStorage.setItem(`git-constellation-${resizing.col}-width`, String(newWidth));
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.classList.add('resizing');

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('resizing');
    };
  }, [resizing]);

  // Commit box resize effect
  useEffect(() => {
    if (!resizingCommitBox) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = resizingCommitBox.startY - e.clientY;
      const newHeight = Math.max(80, Math.min(window.innerHeight - 100, resizingCommitBox.startHeight + deltaY));
      setCommitBoxHeight(newHeight);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const deltaY = resizingCommitBox.startY - e.clientY;
      const newHeight = Math.max(80, Math.min(window.innerHeight - 100, resizingCommitBox.startHeight + deltaY));
      localStorage.setItem('git-constellation-commit-box-height', String(newHeight));
      setResizingCommitBox(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.classList.add('resizing-row');

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('resizing-row');
    };
  }, [resizingCommitBox]);

  return {
    descWidth,
    authorWidth,
    dateWidth,
    commitBoxHeight,
    startColumnResize: (col, startX, startWidth) => setResizing({ col, startX, startWidth }),
    startCommitBoxResize: (startY, startHeight) => setResizingCommitBox({ startY, startHeight }),
  };
}
