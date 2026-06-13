import { GitCoreService } from './git-core';
import { validateHash, validateStashRef } from '../git-validation';
import * as vscode from 'vscode';

export class GitStashService {
  constructor(private core: GitCoreService) {}

  public async getStashes(): Promise<{ hash: string, refName: string, message: string, date: string }[]> {
    const git = this.core.git;
    if (!git) return [];
    try {
      const result = await git.raw(['stash', 'list', '--format=%H%x09%gd%x09%gs%x09%at%x00']);
      const entries = result.split('\0');
      return entries.map(entry => entry.trim()).filter(Boolean).map(entry => {
        const parts = entry.split('\t');
        const hash = parts[0] || '';
        const refName = parts[1] || '';
        const date = parts.length >= 4 ? parts[parts.length - 1] : '';
        const message = parts.length >= 4 ? parts.slice(2, parts.length - 1).join('\t') : '';
        return { hash, refName, message, date };
      });
    } catch (err) {
      console.error('Error fetching stashes:', err);
      return [];
    }
  }

  public async getStashFiles(hash: string) {
    const git = this.core.git;
    if (!git) return [];
    validateHash(hash);
    try {
      const result = await git.raw(['stash', 'show', '--name-status', hash]);
      return result.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.split(/\s+/);
        let status = parts[0];
        let path = parts[1];
        if (status.startsWith('R') && parts.length >= 3) {
          status = 'R';
          path = `${parts[1]} → ${parts[2]}`;
        }
        return { status, path };
      });
    } catch (err) {
      console.error('Error fetching stash files:', err);
      return [];
    }
  }

  public async applyStash(refName: string): Promise<boolean> {
    const git = this.core.git;
    if (!git) return false;
    validateStashRef(refName);
    try {
      await git.raw(['stash', 'apply', refName]);
      vscode.window.showInformationMessage(`Successfully applied stash '${refName}'.`);
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to apply stash: ${err.message || err}`);
      return false;
    }
  }

  public async popStash(refName: string): Promise<boolean> {
    const git = this.core.git;
    if (!git) return false;
    validateStashRef(refName);
    try {
      await git.raw(['stash', 'pop', refName]);
      vscode.window.showInformationMessage(`Successfully popped stash '${refName}'.`);
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to pop stash: ${err.message || err}`);
      return false;
    }
  }

  public async dropStash(refName: string): Promise<boolean> {
    const git = this.core.git;
    if (!git) return false;
    validateStashRef(refName);
    try {
      await git.raw(['stash', 'drop', refName]);
      vscode.window.showInformationMessage(`Successfully dropped stash '${refName}'.`);
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to drop stash: ${err.message || err}`);
      return false;
    }
  }

  public async clearStashes(): Promise<boolean> {
    const git = this.core.git;
    if (!git) return false;
    try {
      await git.raw(['stash', 'clear']);
      vscode.window.showInformationMessage('Successfully cleared all stashes.');
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to clear stashes: ${err.message || err}`);
      return false;
    }
  }

  public async createStash(message: string, keepIndex: boolean, includeUntracked: boolean): Promise<boolean> {
    const git = this.core.git;
    if (!git) return false;
    try {
      const args = ['stash', 'push'];
      if (message.trim()) {
        if (message.trim().startsWith('-')) {
          throw new Error('Stash message cannot start with a hyphen.');
        }
        args.push('-m', message.trim());
      }
      if (keepIndex) {
        args.push('--keep-index');
      }
      if (includeUntracked) {
        args.push('--include-untracked');
      }
      await git.raw(args);
      vscode.window.showInformationMessage('Successfully created stash.');
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to create stash: ${err.message || err}`);
      return false;
    }
  }
}
