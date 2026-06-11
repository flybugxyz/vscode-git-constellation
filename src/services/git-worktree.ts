import { GitCoreService } from './git-core';
import { validateFilePath, validateHash, validateBranchName } from '../git-validation';
import { simpleGit } from 'simple-git';
import * as vscode from 'vscode';

export class GitWorktreeService {
  constructor(private core: GitCoreService) {}

  public async getWorktrees(): Promise<{ path: string; commit: string; branch: string; isMain: boolean }[]> {
    const git = this.core.git;
    if (!git) return [];
    try {
      const result = await git.raw(['worktree', 'list', '--porcelain']);
      const worktrees: { path: string; commit: string; branch: string; isMain: boolean }[] = [];
      const blocks = result.trim().split('\n\n');
      for (const block of blocks) {
        if (!block.trim()) continue;
        const lines = block.split('\n');
        let wtPath = '';
        let commit = '';
        let branch = '';
        for (const line of lines) {
          if (line.startsWith('worktree ')) {
            wtPath = line.substring(9).trim();
          } else if (line.startsWith('HEAD ')) {
            commit = line.substring(5).trim();
          } else if (line.startsWith('commit ')) {
            commit = line.substring(7).trim();
          } else if (line.startsWith('branch ')) {
            const rawBranch = line.substring(7).trim();
            branch = rawBranch.startsWith('refs/heads/') ? rawBranch.substring(11) : rawBranch;
          } else if (line.startsWith('detached')) {
            branch = '(detached)';
          }
        }
        if (wtPath) {
          worktrees.push({
            path: wtPath,
            commit,
            branch,
            isMain: false
          });
        }
      }
      if (worktrees.length > 0) {
        worktrees[0].isMain = true;
      }
      return worktrees;
    } catch (err) {
      console.error('Error fetching git worktrees:', err);
      return [];
    }
  }

  public async createWorktree(path: string, hash: string) {
    const git = this.core.git;
    if (!git) return;
    validateFilePath(path);
    validateHash(hash);
    try {
      await git.raw(['worktree', 'add', path, hash]);
      vscode.window.showInformationMessage(`Worktree created at ${path} for commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create worktree: ${err}`);
    }
  }

  public async cherryPickWithWorktree(path: string, branchName: string, hash: string) {
    const git = this.core.git;
    if (!git) return;
    validateFilePath(path);
    validateBranchName(branchName);
    validateHash(hash);
    try {
      await git.raw(['worktree', 'add', '-b', branchName, path, 'HEAD']);
      const wtGit = simpleGit(path);
      await wtGit.raw(['cherry-pick', hash]);
      vscode.window.showInformationMessage(`Worktree created at ${path} on branch ${branchName} and cherry-picked commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Cherry-pick in worktree failed: ${err}`);
    }
  }

  public async removeWorktree(path: string, force: boolean = false): Promise<boolean> {
    const git = this.core.git;
    if (!git) return false;
    validateFilePath(path);
    try {
      const args = ['worktree', 'remove'];
      if (force) {
        args.push('--force');
      }
      args.push(path);
      await git.raw(args);
      vscode.window.showInformationMessage(`Successfully removed worktree '${path}'.`);
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to remove worktree: ${err.message || err}`);
      return false;
    }
  }

  public async pruneWorktrees(): Promise<boolean> {
    const git = this.core.git;
    if (!git) return false;
    try {
      await git.raw(['worktree', 'prune']);
      vscode.window.showInformationMessage('Successfully pruned worktrees.');
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to prune worktrees: ${err.message || err}`);
      return false;
    }
  }
}
