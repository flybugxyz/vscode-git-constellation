import React from 'react';
import { LocalChangesPanel } from '../LocalChangesPanel';
import { GitStatusFile } from '../types';

interface LocalChangesTabProps {
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
  commitActionState?: 'commit' | 'commitAndPush' | null;
}

export function LocalChangesTab(props: LocalChangesTabProps) {
  return <LocalChangesPanel {...props} />;
}
export { LocalChangesPanel };
