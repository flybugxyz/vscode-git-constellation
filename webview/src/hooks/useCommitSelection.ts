import { useState, useCallback } from 'react';

export interface UseCommitSelectionOptions {
  /** Post a message to the VS Code host */
  postMessage: (msg: any) => void;
  /** Whether search/file filters are active (disables squash) */
  hasActiveFilters: () => boolean;
  /** Called when selection is cleared (to reset compare mode, etc.) */
  onSelectionCleared: () => void;
  /** Called when a commit is selected (to exit compare mode) */
  onCommitSelected: () => void;
}

export interface UseCommitSelectionReturn {
  selectedIndex: number;
  selectedIndices: number[];
  setSelectedIndex: (index: number) => void;
  /** Handle clicking a commit row (supports Ctrl/Shift multi-select) */
  handleSelectCommit: (idx: number, hash: string, e?: React.MouseEvent) => void;
  /** Handle right-clicking a commit row (selects if not already in selection) */
  handleRowContextMenu: (
    e: React.MouseEvent,
    commit: { hash: string },
    idx: number,
    openContextMenu: (e: React.MouseEvent, data: any) => void,
  ) => void;
  /** Check if selected indices are contiguous (for squash) */
  checkCanSquash: () => boolean;
  /** Reset all selection state */
  clearSelection: () => void;
  /** Clamp indices to valid range after data update */
  clampIndices: (maxLen: number) => void;
}

export function useCommitSelection(options: UseCommitSelectionOptions): UseCommitSelectionReturn {
  const { postMessage, hasActiveFilters, onSelectionCleared, onCommitSelected } = options;

  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [anchorIndex, setAnchorIndex] = useState<number>(-1);

  const clearSelection = useCallback(() => {
    setSelectedIndex(-1);
    setSelectedIndices([]);
    setAnchorIndex(-1);
    onSelectionCleared();
  }, [onSelectionCleared]);

  const clampIndices = useCallback((maxLen: number) => {
    setSelectedIndices(prev => prev.filter(i => i >= 0 && i < maxLen));
    setSelectedIndex(prev => (prev >= 0 && prev < maxLen) ? prev : -1);
  }, []);

  const handleSelectCommit = useCallback((idx: number, hash: string, e?: React.MouseEvent) => {
    let newSelected: number[] = [];
    let newAnchor = anchorIndex;

    if (e && (e.ctrlKey || e.metaKey)) {
      if (selectedIndices.includes(idx)) {
        newSelected = selectedIndices.filter(i => i !== idx);
      } else {
        newSelected = [...selectedIndices, idx];
      }
      newAnchor = idx;
    } else if (e && e.shiftKey && anchorIndex !== -1) {
      const start = Math.min(anchorIndex, idx);
      const end = Math.max(anchorIndex, idx);
      newSelected = [];
      for (let i = start; i <= end; i++) {
        newSelected.push(i);
      }
    } else {
      newSelected = [idx];
      newAnchor = idx;
    }

    setSelectedIndices(newSelected);
    setAnchorIndex(newAnchor);

    if (newSelected.length > 0) {
      setSelectedIndex(idx);
      onCommitSelected();
      postMessage({ type: 'getDiff', hash });
    } else {
      setSelectedIndex(-1);
      onSelectionCleared();
    }
  }, [anchorIndex, selectedIndices, postMessage, onCommitSelected, onSelectionCleared]);

  const handleRowContextMenu = useCallback((
    e: React.MouseEvent,
    commit: { hash: string },
    idx: number,
    openContextMenu: (e: React.MouseEvent, data: any) => void,
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedIndices.includes(idx)) {
      setSelectedIndices([idx]);
      setAnchorIndex(idx);
      setSelectedIndex(idx);
      onCommitSelected();
      postMessage({ type: 'getDiff', hash: commit.hash });
    }

    openContextMenu(e, { kind: 'commit', commit, index: idx });
  }, [selectedIndices, postMessage, onCommitSelected]);

  const checkCanSquash = useCallback(() => {
    if (selectedIndices.length <= 1) return false;
    const sorted = [...selectedIndices].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        return false;
      }
    }
    if (hasActiveFilters()) {
      return false;
    }
    return true;
  }, [selectedIndices, hasActiveFilters]);

  return {
    selectedIndex,
    selectedIndices,
    setSelectedIndex,
    handleSelectCommit,
    handleRowContextMenu,
    checkCanSquash,
    clearSelection,
    clampIndices,
  };
}
