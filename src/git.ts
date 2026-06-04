import { simpleGit, SimpleGit, LogResult, DefaultLogFields } from 'simple-git';
import * as vscode from 'vscode';

export class GitService {
  private _git?: SimpleGit;
  private _workspaceRoot?: string;

  constructor() {
    this._workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (this._workspaceRoot) {
      this._git = simpleGit(this._workspaceRoot);
    }
  }

  public async getLog(): Promise<LogResult<DefaultLogFields> | undefined> {
    if (!this._git) return undefined;
    try {
      return await this._git.log(['--max-count=100', '--graph', '--all', '--format=%H%d%s%an%ae%at']);
    } catch (err) {
      console.error('Error fetching git log:', err);
      return undefined;
    }
  }

  public async getStatus() {
    if (!this._git) return undefined;
    try {
      return await this._git.status();
    } catch (err) {
      console.error('Error fetching git status:', err);
      return undefined;
    }
  }

  public async getBranches() {
    if (!this._git) return undefined;
    try {
      return await this._git.branch();
    } catch (err) {
      console.error('Error fetching git branches:', err);
      return undefined;
    }
  }

  public async commit(message: string) {
    if (!this._git) return;
    try {
      await this._git.add('.');
      return await this._git.commit(message);
    } catch (err) {
      vscode.window.showErrorMessage(`Commit failed: ${err}`);
    }
  }

  public async getDiff(hash?: string) {
    if (!this._git) return '';
    try {
      if (hash) {
        return await this._git.show([hash]);
      } else {
        return await this._git.diff();
      }
    } catch (err) {
      console.error('Error fetching diff:', err);
      return '';
    }
  }
}
