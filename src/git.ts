import { simpleGit, SimpleGit, LogResult, DefaultLogFields } from 'simple-git';
import * as vscode from 'vscode';

export class GitService {
  private _git?: SimpleGit;
  private _workspaceRoot?: string;

  constructor() {
    this._workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    console.log('GitService initialized with workspace root:', this._workspaceRoot);
    if (this._workspaceRoot) {
      this._git = simpleGit(this._workspaceRoot);
    }
  }

  public async getLog(): Promise<any | undefined> {
    if (!this._git) {
      console.log('GitService: No git instance available');
      return undefined;
    }
    try {
      console.log('GitService: Fetching log with parents...');
      // Use raw log to get custom format including parents (%P) and refs (%D)
      const result = await this._git.raw([
        'log',
        '--max-count=100',
        '--all',
        '--format=%H|%P|%D|%s|%an|%at'
      ]);
      
      const lines = result.trim().split('\n');
      const commits = lines.map(line => {
        const [hash, parents, refs, message, author, date] = line.split('|');
        return {
          hash,
          parents: parents ? parents.split(' ') : [],
          refs: refs || '',
          message,
          author_name: author,
          date
        };
      });

      console.log(`GitService: Found ${commits.length} commits`);
      return { all: commits };
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

  public async checkout(branch: string) {
    if (!this._git) return;
    try {
      await this._git.checkout(branch);
    } catch (err) {
      vscode.window.showErrorMessage(`Checkout failed: ${err}`);
    }
  }
}
