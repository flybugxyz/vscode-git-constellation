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

  public async getLog(branch: string = 'ALL', author: string = 'ALL', search: string = ''): Promise<any | undefined> {
    if (!this._git) {
      console.log('GitService: No git instance available');
      return undefined;
    }
    try {
      console.log(`GitService: Fetching log with parents for branch/filter: ${branch}...`);
      
      const formatStr = '--format=%H%x09%P%x09%D%x09%s%x09%an%x09%ae%x09%at';
      const parseCommits = (rawResult: string) => {
        const lines = rawResult.trim().split('\n');
        return lines.filter(Boolean).map(line => {
          const [hash, parents, refs, message, author, email, date] = line.split('\t');
          return {
            hash,
            parents: parents ? parents.split(' ') : [],
            refs: refs || '',
            message,
            author_name: author,
            author_email: email,
            date
          };
        });
      };

      const args = [
        'log',
        '--max-count=100'
      ];
      if (branch === 'ALL') {
        args.push('--all');
      } else if (branch === 'HEAD') {
        args.push('HEAD');
      } else if (branch) {
        args.push(branch);
      } else {
        args.push('--all');
      }
      
      if (author && author !== 'ALL') {
        args.push(`--author=${author}`);
      }

      if (search) {
        args.push(`--grep=${search}`, '-i');
      }
      
      args.push(formatStr);

      const result = await this._git.raw(args);
      const commits = parseCommits(result);

      if (search && /^[a-fA-F0-9]{4,40}$/.test(search)) {
        try {
          const hashResult = await this._git.raw(['log', '-1', formatStr, search]);
          if (hashResult.trim()) {
            const hashCommits = parseCommits(hashResult);
            if (hashCommits.length > 0 && !commits.some(c => c.hash === hashCommits[0].hash)) {
              commits.unshift(hashCommits[0]);
            }
          }
        } catch {
          // ignore if hash not found
        }
      }

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
      return await this._git.branch(['-a']);
    } catch (err) {
      console.error('Error fetching git branches:', err);
      return undefined;
    }
  }

  public async commit(message: string, files?: string[]) {
    if (!this._git) return false;
    try {
      if (files && files.length > 0) {
        // Stage only the selected files
        await this._git.add(files);
        await this._git.commit(message, files);
      } else {
        await this._git.add('.');
        await this._git.commit(message);
      }
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(`Commit failed: ${err}`);
      return false;
    }
  }

  public async push(force: boolean = false) {
    if (!this._git) return false;
    try {
      const options = force ? ['--force'] : [];
      await this._git.push(undefined, undefined, options);
      vscode.window.showInformationMessage(force ? 'Push (force) succeeded.' : 'Push succeeded.');
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(`Push failed: ${err}`);
      return false;
    }
  }

  public async getCommitFiles(hash: string) {
    if (!this._git) return [];
    try {
      // Get list of files with status (A: Added, M: Modified, D: Deleted, etc.)
      const result = await this._git.raw(['show', '--name-status', '--pretty=format:', hash]);
      return result.trim().split('\n').filter(Boolean).map(line => {
        const [status, path] = line.split(/\s+/);
        return { status, path };
      });
    } catch (err) {
      console.error('Error fetching commit files:', err);
      return [];
    }
  }

  public async getFileContent(hash: string, path: string) {
    if (!this._git) return '';
    try {
      return await this._git.show([`${hash}:${path}`]);
    } catch (err) {
      console.error(`Error fetching file content for ${hash}:${path}:`, err);
      return '';
    }
  }

  public async getParentHash(hash: string) {
    if (!this._git) return undefined;
    try {
      const result = await this._git.raw(['rev-parse', `${hash}^`]);
      return result.trim();
    } catch {
      return undefined;
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

  public async getCommitUrl(hash: string): Promise<string> {
    if (!this._git) return '';
    try {
      const remoteUrl = await this._git.remote(['get-url', 'origin']);
      if (remoteUrl) {
        const trimmed = remoteUrl.trim();
        let httpUrl = trimmed;
        if (trimmed.startsWith('git@')) {
          httpUrl = trimmed
            .replace(':', '/')
            .replace('git@', 'https://');
        }
        if (httpUrl.endsWith('.git')) {
          httpUrl = httpUrl.slice(0, -4);
        }
        if (httpUrl.includes('gitlab.com')) {
          return `${httpUrl}/-/commit/${hash}`;
        }
        return `${httpUrl}/commit/${hash}`;
      }
    } catch (err) {
      console.error('Error getting remote URL:', err);
    }
    return '';
  }

  public async createBranch(name: string, hash: string) {
    if (!this._git) return;
    try {
      await this._git.checkout(['-b', name, hash]);
      vscode.window.showInformationMessage(`Branch '${name}' created at commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create branch: ${err}`);
    }
  }

  public async createTag(name: string, hash: string) {
    if (!this._git) return;
    try {
      await this._git.tag([name, hash]);
      vscode.window.showInformationMessage(`Tag '${name}' created at commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create tag: ${err}`);
    }
  }

  public async createWorktree(path: string, hash: string) {
    if (!this._git) return;
    try {
      await this._git.raw(['worktree', 'add', path, hash]);
      vscode.window.showInformationMessage(`Worktree created at ${path} for commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create worktree: ${err}`);
    }
  }

  public async cherryPick(hash: string) {
    if (!this._git) return;
    try {
      await this._git.raw(['cherry-pick', hash]);
      vscode.window.showInformationMessage(`Cherry-picked commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Cherry-pick failed: ${err}`);
    }
  }

  public async cherryPickWithWorktree(path: string, branchName: string, hash: string) {
    if (!this._git) return;
    try {
      await this._git.raw(['worktree', 'add', '-b', branchName, path, 'HEAD']);
      const wtGit = simpleGit(path);
      await wtGit.raw(['cherry-pick', hash]);
      vscode.window.showInformationMessage(`Worktree created at ${path} on branch ${branchName} and cherry-picked commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Cherry-pick in worktree failed: ${err}`);
    }
  }

  public async revertCommit(hash: string) {
    if (!this._git) return;
    try {
      await this._git.revert(hash, ['--no-edit']);
      vscode.window.showInformationMessage(`Reverted commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Revert failed: ${err}`);
    }
  }

  public async rebase(hash: string) {
    if (!this._git) return;
    try {
      await this._git.rebase([hash]);
      vscode.window.showInformationMessage(`Successfully rebased current branch onto ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Rebase failed: ${err}`);
    }
  }

  public async merge(hash: string) {
    if (!this._git) return;
    try {
      await this._git.merge([hash]);
      vscode.window.showInformationMessage(`Successfully merged commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Merge failed: ${err}`);
    }
  }

  public async getCompareFiles(hash: string) {
    if (!this._git) return [];
    try {
      const result = await this._git.raw(['diff', '--name-status', 'HEAD', hash]);
      return result.trim().split('\n').filter(Boolean).map(line => {
        const [status, path] = line.split(/\s+/);
        return { status, path };
      });
    } catch (err) {
      console.error('Error fetching compare files:', err);
      return [];
    }
  }

  public async getBranchUrl(branchName: string): Promise<string> {
    if (!this._git) return '';
    try {
      const remoteUrl = await this._git.remote(['get-url', 'origin']);
      if (remoteUrl) {
        const trimmed = remoteUrl.trim();
        let httpUrl = trimmed;
        if (trimmed.startsWith('git@')) {
          httpUrl = trimmed
            .replace(':', '/')
            .replace('git@', 'https://');
        }
        if (httpUrl.endsWith('.git')) {
          httpUrl = httpUrl.slice(0, -4);
        }
        const cleanBranch = branchName.replace(/^remotes\/[^\/]+\//, '').replace(/^origin\//, '');
        if (httpUrl.includes('gitlab.com')) {
          return `${httpUrl}/-/tree/${cleanBranch}`;
        }
        return `${httpUrl}/tree/${cleanBranch}`;
      }
    } catch (err) {
      console.error('Error getting branch URL:', err);
    }
    return '';
  }

  public async getTagUrl(tagName: string): Promise<string> {
    if (!this._git) return '';
    try {
      const remoteUrl = await this._git.remote(['get-url', 'origin']);
      if (remoteUrl) {
        const trimmed = remoteUrl.trim();
        let httpUrl = trimmed;
        if (trimmed.startsWith('git@')) {
          httpUrl = trimmed
            .replace(':', '/')
            .replace('git@', 'https://');
        }
        if (httpUrl.endsWith('.git')) {
          httpUrl = httpUrl.slice(0, -4);
        }
        if (httpUrl.includes('gitlab.com')) {
          return `${httpUrl}/-/tags/${tagName}`;
        }
        return `${httpUrl}/releases/tag/${tagName}`;
      }
    } catch (err) {
      console.error('Error getting tag URL:', err);
    }
    return '';
  }

  public async createBranchFrom(newName: string, startPoint: string) {
    if (!this._git) return;
    try {
      await this._git.checkout(['-b', newName, startPoint]);
      vscode.window.showInformationMessage(`Branch '${newName}' created from '${startPoint}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create branch: ${err}`);
    }
  }

  public async pullBranch(branchName: string) {
    if (!this._git) return;
    try {
      const cleanBranch = branchName.replace(/^remotes\/[^\/]+\//, '');
      await this._git.pull('origin', cleanBranch);
      vscode.window.showInformationMessage(`Pulled branch '${cleanBranch}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Pull failed: ${err}`);
    }
  }

  public async pushBranch(branchName: string, remote: string = 'origin') {
    if (!this._git) return;
    try {
      const cleanBranch = branchName.replace(/^remotes\/[^\/]+\//, '');
      await this._git.push(remote, cleanBranch);
      vscode.window.showInformationMessage(`Pushed branch '${cleanBranch}' to remote '${remote}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Push failed: ${err}`);
    }
  }

  public async renameBranch(oldName: string, newName: string) {
    if (!this._git) return;
    try {
      await this._git.branch(['-m', oldName, newName]);
      vscode.window.showInformationMessage(`Renamed branch from '${oldName}' to '${newName}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Rename failed: ${err}`);
    }
  }

  public async deleteBranch(branchName: string, isRemote: boolean) {
    if (!this._git) return;
    try {
      if (isRemote) {
        const parts = branchName.replace(/^remotes\//, '').split('/');
        const remoteName = parts[0];
        const remoteBranch = parts.slice(1).join('/');
        await this._git.push(remoteName, remoteBranch, ['--delete']);
        vscode.window.showInformationMessage(`Deleted remote branch '${remoteBranch}' from remote '${remoteName}'.`);
      } else {
        await this._git.branch(['-D', branchName]);
        vscode.window.showInformationMessage(`Deleted local branch '${branchName}'.`);
      }
    } catch (err) {
      vscode.window.showErrorMessage(`Delete failed: ${err}`);
    }
  }

  public async compareBranches(branchA: string, branchB: string) {
    if (!this._git) return [];
    try {
      const result = await this._git.raw(['diff', '--name-status', branchA, branchB]);
      return result.trim().split('\n').filter(Boolean).map(line => {
        const [status, path] = line.split(/\s+/);
        return { status, path };
      });
    } catch (err) {
      console.error('Error comparing branches:', err);
      return [];
    }
  }

  public async setUpstream(branchName: string, upstreamName: string) {
    if (!this._git) return;
    try {
      await this._git.branch([`--set-upstream-to=${upstreamName}`, branchName]);
      vscode.window.showInformationMessage(`Set upstream of '${branchName}' to '${upstreamName}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to set upstream: ${err}`);
    }
  }

  public async getTagDetails(tagName: string): Promise<string> {
    if (!this._git) return '';
    try {
      return await this._git.show([tagName]);
    } catch (err) {
      console.error('Error showing tag details:', err);
      return '';
    }
  }

  public async deleteTag(tagName: string) {
    if (!this._git) return;
    try {
      await this._git.tag(['-d', tagName]);
      vscode.window.showInformationMessage(`Deleted local tag '${tagName}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to delete tag: ${err}`);
    }
  }

  public async deleteRemoteTag(tagName: string) {
    if (!this._git) return;
    try {
      await this._git.push('origin', tagName, ['--delete']);
      vscode.window.showInformationMessage(`Deleted remote tag '${tagName}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to delete remote tag: ${err}`);
    }
  }

  public async getAuthors(): Promise<string[]> {
    if (!this._git) return [];
    try {
      const result = await this._git.raw(['log', '--format=%an', '-n', '1000']);
      const authors = result.trim().split('\n').filter(Boolean);
      return Array.from(new Set(authors)).sort();
    } catch {
      return [];
    }
  }

  public async getCurrentUser(): Promise<{ name: string, email: string } | null> {
    if (!this._git) return null;
    try {
      const name = await this._git.getConfig('user.name');
      const email = await this._git.getConfig('user.email');
      return { name: name.value || '', email: email.value || '' };
    } catch {
      return null;
    }
  }
}
