import React from 'react';
import { LocalChangesPanel } from '../LocalChangesPanel';

interface LocalChangesTabProps {
  commitBoxHeight: number;
  onStartResizeCommitBox: (startY: number, startHeight: number) => void;
  isGenerating: boolean;
  setIsGenerating: (g: boolean) => void;
  commitMessage: string;
  setCommitMessage: (msg: string) => void;
  commitActionState?: 'commit' | 'commitAndPush' | null;
  setCommitActionState: (state: 'commit' | 'commitAndPush' | null) => void;
}

export function LocalChangesTab(props: LocalChangesTabProps) {
  return <LocalChangesPanel {...props} />;
}
export { LocalChangesPanel };
