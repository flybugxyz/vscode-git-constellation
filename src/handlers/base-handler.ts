import * as vscode from 'vscode';
import { GitService } from '../git';

export interface IGitJBViewProvider {
  refresh(): Promise<void>;
  scheduleRefresh(): void;
  setFileFilter(file: string): void;
}

export interface WebviewMessage {
  type: string;
  [key: string]: any;
}
