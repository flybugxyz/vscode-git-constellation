import { simpleGit, SimpleGit } from 'simple-git';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as pathModule from 'path';

export function validateBranchName(name: string): void {
  if (!name || name.startsWith('-') || !/^[a-zA-Z0-9._/-]+$/.test(name)) {
    throw new Error(`Invalid branch/ref name: "${name}"`);
  }
}

export function validateHash(hash: string): void {
  if (hash === 'HEAD') return;
  if (!hash || !/^[a-fA-F0-9]{4,40}$/.test(hash)) {
    throw new Error(`Invalid commit hash: "${hash}"`);
  }
}

export function validateFilePath(path: string): void {
  if (!path || path.startsWith('-')) {
    throw new Error(`Invalid file path: "${path}"`);
  }
}

export function validateStashRef(ref: string): void {
  if (!ref || !/^stash@\{\d+\}$/.test(ref)) {
    throw new Error(`Invalid stash reference: "${ref}"`);
  }
}

export interface RepositoryInfo {
  name: string;
  path: string;
  isMain: boolean;
}

export class GitService {
  private _workspaceRoot?: string;
  private _activeRepoPath?: string;
  private _gitInstances: Map<string, SimpleGit> = new Map();
  private _repositories: RepositoryInfo[] = [];

  constructor() {
    this._workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    console.log('GitService initialized with workspace root:', this._workspaceRoot);
    if (this._workspaceRoot) {
      this._activeRepoPath = this._workspaceRoot;
      this._gitInstances.set(this._workspaceRoot, simpleGit(this._workspaceRoot));
    }
  }

  public get activeRepoPath(): string | undefined {
    return this._activeRepoPath;
  }

  public setActiveRepo(path: string) {
    this._activeRepoPath = path;
  }

  private get _git(): SimpleGit | undefined {
    if (!this._activeRepoPath) return undefined;
    if (!this._gitInstances.has(this._activeRepoPath)) {
      this._gitInstances.set(this._activeRepoPath, simpleGit(this._activeRepoPath));
    }
    return this._gitInstances.get(this._activeRepoPath);
  }

  public async getRepositories(): Promise<RepositoryInfo[]> {
    if (!this._workspaceRoot) return [];
    
    // Always return main repo first
    const repos: RepositoryInfo[] = [{
      name: pathModule.basename(this._workspaceRoot),
      path: this._workspaceRoot,
      isMain: true
    }];

    try {
      const mainGit = this._gitInstances.get(this._workspaceRoot) || simpleGit(this._workspaceRoot);
      const submodulesOutput = await mainGit.raw(['submodule', 'status']);
      if (submodulesOutput && submodulesOutput.trim()) {
        const lines = submodulesOutput.trim().split('\n');
        for (const line of lines) {
          const match = line.match(/^[\s\+\-U][a-fA-F0-9]{40}\s+(.+?)(?:\s+\(.*?\))?$/);
          if (match && match[1]) {
            const subPath = match[1];
            const fullPath = pathModule.join(this._workspaceRoot, subPath);
            if (fs.existsSync(fullPath)) {
               repos.push({
                 name: pathModule.basename(fullPath),
                 path: fullPath,
                 isMain: false
               });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching submodules:', err);
    }
    
    this._repositories = repos;
    return repos;
  }

  public async getLog(branch: string = 'ALL', author: string = 'ALL', search: string = '', filePath: string = '', skip: number = 0, maxCount: number = 100): Promise<any | undefined> {
    if (!this._git) {
      console.log('GitService: No git instance available');
      return undefined;
    }
    try {
      console.log(`GitService: Fetching log with parents for branch/filter: ${branch}...`);
      
      if (branch !== 'ALL' && branch !== 'HEAD' && branch !== '') {
        validateBranchName(branch);
      }
      if (author && author !== 'ALL') {
        if (author.startsWith('-')) {
          throw new Error(`Invalid author: "${author}"`);
        }
      }
      if (search) {
        if (search.startsWith('-')) {
          throw new Error(`Invalid search query: "${search}"`);
        }
      }
      if (filePath) {
        validateFilePath(filePath);
      }

      const formatStr = '--format=%H%x09%P%x09%D%x09%B%x09%an%x09%ae%x09%at%x00';
      const parseCommits = (rawResult: string) => {
        const entries = rawResult.split('\0');
        return entries.map(entry => entry.trim()).filter(Boolean).map(entry => {
          const parts = entry.split('\t');
          const hash = parts[0] || '';
          const parents = parts[1] || '';
          const refs = parts[2] || '';
          const date = parts.length >= 7 ? parts[parts.length - 1] : '';
          const email = parts.length >= 7 ? parts[parts.length - 2] : '';
          const author = parts.length >= 7 ? parts[parts.length - 3] : '';
          const message = parts.length >= 7 ? parts.slice(3, parts.length - 3).join('\t') : '';
          return {
            hash,
            parents: parents ? parents.split(' ') : [],
            refs: refs || '',
            message: message || '',
            author_name: author || '',
            author_email: email || '',
            date: date || ''
          };
        });
      };

      const args = [
        'log'
      ];
      if (skip > 0) {
        args.push(`--skip=${skip}`);
      }
      if (maxCount > 0) {
        args.push(`--max-count=${maxCount}`);
      }
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

      if (filePath) {
        args.push('--', filePath);
      }

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
    if (files) {
      files.forEach(validateFilePath);
    }
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

  public async pull() {
    if (!this._git) return false;
    try {
      await this._git.pull();
      vscode.window.showInformationMessage('Pull succeeded.');
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(`Pull failed: ${err}`);
      return false;
    }
  }

  public async fetch() {
    if (!this._git) return false;
    try {
      await this._git.fetch();
      vscode.window.showInformationMessage('Fetch succeeded.');
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(`Fetch failed: ${err}`);
      return false;
    }
  }

  public async discardChanges(filePath: string) {
    if (!this._git) return false;
    validateFilePath(filePath);
    try {
      // 1. Unstage any changes
      try {
        await this._git.reset(['HEAD', '--', filePath]);
      } catch (e) {
        // ignore reset failure if not in index
      }
      
      // 2. Discard tracked changes
      try {
        await this._git.checkout(['--', filePath]);
      } catch (e) {
        // ignore checkout failure if untracked
      }
      
      // 3. Clean untracked files/folders
      try {
        await this._git.clean('fd', ['--', filePath]);
      } catch (e) {
        // ignore clean failure
      }
      
      vscode.window.showInformationMessage(`Discarded changes in '${filePath}'.`);
      return true;
    } catch (err) {
      vscode.window.showErrorMessage(`Discard failed: ${err}`);
      return false;
    }
  }

  public async getDiffForFiles(files: string[]): Promise<string> {
    if (!this._git || files.length === 0) return '';
    try {
      files.forEach(validateFilePath);
      const statusResult = await this._git.status();
      const untrackedFiles = new Set<string>(statusResult.not_added);

      const trackedFiles: string[] = [];
      const untrackedList: string[] = [];
      for (const file of files) {
        if (untrackedFiles.has(file)) {
          untrackedList.push(file);
        } else {
          trackedFiles.push(file);
        }
      }

      let diff = '';
      if (trackedFiles.length > 0) {
        try {
          diff += await this._git.diff(['HEAD', '--', ...trackedFiles]);
        } catch {
          diff += await this._git.diff(['--', ...trackedFiles]);
        }
      }

      for (const file of untrackedList) {
        try {
          const fullPath = pathModule.resolve(this._activeRepoPath || '', file);
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            diff += `diff --git a/${file} b/${file}\n`;
            diff += `new file mode 100644\n`;
            diff += `--- /dev/null\n`;
            diff += `+++ b/${file}\n`;
            diff += `@@ -0,0 +1,${lines.length} @@\n`;
            diff += lines.map(line => `+${line}`).join('\n') + '\n';
          }
        } catch (err) {
          console.error(`Error reading untracked file ${file}:`, err);
        }
      }

      if (diff.length > 15000) {
        return diff.substring(0, 15000) + '\n... [Diff truncated due to length]';
      }
      return diff;
    } catch (err) {
      console.error('Error getting diff for files:', err);
      return '';
    }
  }

  public async getCommitFiles(hash: string) {
    if (!this._git) return [];
    validateHash(hash);
    try {
      const result = await this._git.raw(['show', '--name-status', '--pretty=format:', hash]);
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
      console.error('Error fetching commit files:', err);
      return [];
    }
  }

  public async getFileContent(hash: string, path: string) {
    if (!this._git) return '';
    if (hash === '') return '';
    validateHash(hash);
    validateFilePath(path);
    try {
      return await this._git.show([`${hash}:${path}`]);
    } catch (err) {
      console.error(`Error fetching file content for ${hash}:${path}:`, err);
      return '';
    }
  }

  public async getParentHash(hash: string) {
    if (!this._git) return undefined;
    validateHash(hash);
    try {
      const result = await this._git.raw(['rev-parse', `${hash}^`]);
      return result.trim();
    } catch {
      return undefined;
    }
  }

  public async getDiff(hash?: string) {
    if (!this._git) return '';
    if (hash) {
      validateHash(hash);
    }
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
    validateBranchName(branch);
    try {
      await this._git.checkout(branch);
    } catch (err) {
      vscode.window.showErrorMessage(`Checkout failed: ${err}`);
    }
  }

  private async getHttpRemoteUrl(): Promise<string | null> {
    if (!this._git) return null;
    try {
      const remoteUrl = await this._git.remote(['get-url', 'origin']);
      if (!remoteUrl) return null;
      let httpUrl = remoteUrl.trim();
      if (httpUrl.startsWith('git@')) {
        httpUrl = httpUrl.replace(':', '/').replace('git@', 'https://');
      }
      if (httpUrl.endsWith('.git')) {
        httpUrl = httpUrl.slice(0, -4);
      }
      return httpUrl;
    } catch (err) {
      console.error('Error getting remote URL:', err);
      return null;
    }
  }

  public async getCommitUrl(hash: string): Promise<string> {
    validateHash(hash);
    const httpUrl = await this.getHttpRemoteUrl();
    if (httpUrl) {
      if (httpUrl.includes('gitlab.com')) {
        return `${httpUrl}/-/commit/${hash}`;
      }
      return `${httpUrl}/commit/${hash}`;
    }
    return '';
  }

  public async createBranch(name: string, hash: string) {
    if (!this._git) return;
    validateBranchName(name);
    validateHash(hash);
    try {
      await this._git.checkout(['-b', name, hash]);
      vscode.window.showInformationMessage(`Branch '${name}' created at commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create branch: ${err}`);
    }
  }

  public async createTag(name: string, hash: string) {
    if (!this._git) return;
    validateBranchName(name);
    validateHash(hash);
    try {
      await this._git.tag([name, hash]);
      vscode.window.showInformationMessage(`Tag '${name}' created at commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create tag: ${err}`);
    }
  }

  public async createWorktree(path: string, hash: string) {
    if (!this._git) return;
    validateFilePath(path);
    validateHash(hash);
    try {
      await this._git.raw(['worktree', 'add', path, hash]);
      vscode.window.showInformationMessage(`Worktree created at ${path} for commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create worktree: ${err}`);
    }
  }

  public async cherryPick(hash: string) {
    if (!this._git) return;
    validateHash(hash);
    try {
      await this._git.raw(['cherry-pick', hash]);
      vscode.window.showInformationMessage(`Cherry-picked commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Cherry-pick failed: ${err}`);
    }
  }

  public async cherryPickWithWorktree(path: string, branchName: string, hash: string) {
    if (!this._git) return;
    validateFilePath(path);
    validateBranchName(branchName);
    validateHash(hash);
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
    validateHash(hash);
    try {
      await this._git.revert(hash, ['--no-edit']);
      vscode.window.showInformationMessage(`Reverted commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Revert failed: ${err}`);
    }
  }

  public async rebase(hash: string) {
    if (!this._git) return;
    validateBranchName(hash);
    try {
      await this._git.rebase([hash]);
      vscode.window.showInformationMessage(`Successfully rebased current branch onto ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Rebase failed: ${err}`);
    }
  }

  public async merge(hash: string) {
    if (!this._git) return;
    validateBranchName(hash);
    try {
      await this._git.merge([hash]);
      vscode.window.showInformationMessage(`Successfully merged commit ${hash.substring(0, 7)}.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Merge failed: ${err}`);
    }
  }

  public async getCompareFiles(hash: string) {
    if (!this._git) return [];
    validateHash(hash);
    try {
      const result = await this._git.raw(['diff', '--name-status', 'HEAD', hash]);
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
      console.error('Error fetching compare files:', err);
      return [];
    }
  }

  public async getBranchUrl(branchName: string): Promise<string> {
    validateBranchName(branchName);
    const httpUrl = await this.getHttpRemoteUrl();
    if (httpUrl) {
      const cleanBranch = branchName.replace(/^remotes\/[^\/]+\//, '').replace(/^origin\//, '');
      if (httpUrl.includes('gitlab.com')) {
        return `${httpUrl}/-/tree/${cleanBranch}`;
      }
      return `${httpUrl}/tree/${cleanBranch}`;
    }
    return '';
  }

  public async getTagUrl(tagName: string): Promise<string> {
    validateBranchName(tagName);
    const httpUrl = await this.getHttpRemoteUrl();
    if (httpUrl) {
      if (httpUrl.includes('gitlab.com')) {
        return `${httpUrl}/-/tags/${tagName}`;
      }
      return `${httpUrl}/releases/tag/${tagName}`;
    }
    return '';
  }

  public async createBranchFrom(newName: string, startPoint: string) {
    if (!this._git) return;
    validateBranchName(newName);
    validateBranchName(startPoint);
    try {
      await this._git.checkout(['-b', newName, startPoint]);
      vscode.window.showInformationMessage(`Branch '${newName}' created from '${startPoint}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to create branch: ${err}`);
    }
  }

  public async pullBranch(branchName: string) {
    if (!this._git) return;
    validateBranchName(branchName);
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
    validateBranchName(branchName);
    validateBranchName(remote);
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
    validateBranchName(oldName);
    validateBranchName(newName);
    try {
      await this._git.branch(['-m', oldName, newName]);
      vscode.window.showInformationMessage(`Renamed branch from '${oldName}' to '${newName}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Rename failed: ${err}`);
    }
  }

  public async deleteBranch(branchName: string, isRemote: boolean) {
    if (!this._git) return;
    validateBranchName(branchName);
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
    validateBranchName(branchA);
    validateBranchName(branchB);
    try {
      const result = await this._git.raw(['diff', '--name-status', branchA, branchB]);
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
      console.error('Error comparing branches:', err);
      return [];
    }
  }

  public async setUpstream(branchName: string, upstreamName: string) {
    if (!this._git) return;
    validateBranchName(branchName);
    validateBranchName(upstreamName);
    try {
      await this._git.branch([`--set-upstream-to=${upstreamName}`, branchName]);
      vscode.window.showInformationMessage(`Set upstream of '${branchName}' to '${upstreamName}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to set upstream: ${err}`);
    }
  }

  public async getTagDetails(tagName: string): Promise<string> {
    validateBranchName(tagName);
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
    validateBranchName(tagName);
    try {
      await this._git.tag(['-d', tagName]);
      vscode.window.showInformationMessage(`Deleted local tag '${tagName}'.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to delete tag: ${err}`);
    }
  }

  public async deleteRemoteTag(tagName: string) {
    if (!this._git) return;
    validateBranchName(tagName);
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

  public async getTags(): Promise<string[]> {
    if (!this._git) return [];
    try {
      const result = await this._git.raw(['tag']);
      return result.trim().split('\n').filter(Boolean);
    } catch (err) {
      console.error('Error fetching git tags:', err);
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

  public async cherryPickMultiple(hashes: string[]) {
    if (!this._git || hashes.length === 0) return;
    hashes.forEach(validateHash);
    try {
      await this._git.raw(['cherry-pick', ...hashes]);
      vscode.window.showInformationMessage(`Successfully cherry-picked ${hashes.length} commits.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Cherry-pick failed: ${err}`);
    }
  }

  public async validateSquash(hashes: string[]): Promise<{ valid: boolean; reason?: string }> {
    if (!this._git || hashes.length <= 1) {
      return { valid: false, reason: 'Please select at least 2 commits to squash.' };
    }
    hashes.forEach(validateHash);
    try {
      // 1. Get current branch to make sure we're not detached
      const branchInfo = await this._git.branch(['-a']);
      if (branchInfo.detached) {
        return { valid: false, reason: 'Squashing is not supported in detached HEAD state.' };
      }

      // 2. Fetch the commits reachable from HEAD (up to 1000 commits is safe and fast)
      const rawLog = await this._git.raw(['log', '--format=%H', '-n', '1000', 'HEAD']);
      const branchHashes = rawLog.trim().split('\n').filter(Boolean);

      // Find the index of each requested hash in the branch's history
      const indices: number[] = [];
      for (const hash of hashes) {
        const index = branchHashes.findIndex(h => h === hash);
        if (index === -1) {
          return { valid: false, reason: `Commit ${hash.substring(0, 7)} is not in the history of the current branch.` };
        }
        indices.push(index);
      }

      // Sort indices ascending (meaning from youngest to oldest in history)
      indices.sort((a, b) => a - b);

      // Verify contiguity
      for (let i = 1; i < indices.length; i++) {
        if (indices[i] !== indices[i - 1] + 1) {
          return { valid: false, reason: 'Selected commits must be contiguous in branch history.' };
        }
      }

      return { valid: true };
    } catch (err: any) {
      return { valid: false, reason: `Validation failed: ${err.message || err}` };
    }
  }

  public async squashCommits(hashes: string[], commitMessage: string): Promise<boolean> {
    if (!this._git || hashes.length <= 1) return false;
    hashes.forEach(validateHash);
    
    let originalBranch = '';
    let originalHead = '';
    
    try {
      const branchInfo = await this._git.branch();
      originalBranch = branchInfo.current;
      originalHead = (await this._git.revparse(['HEAD'])).trim();
      
      if (!originalBranch || branchInfo.detached) {
        throw new Error('Not on a valid branch or branch is detached.');
      }

      // Find the index of each requested hash in the branch's history to sort them
      const rawLog = await this._git.raw(['log', '--format=%H', '-n', '1000', 'HEAD']);
      const branchHashes = rawLog.trim().split('\n').filter(Boolean);
      
      const sortedByHistory = hashes
         .map(h => ({ hash: h, index: branchHashes.indexOf(h) }))
         .filter(item => item.index !== -1)
         .sort((a, b) => a.index - b.index); // youngest (smallest index) to oldest (largest index)
      
      if (sortedByHistory.length !== hashes.length) {
        throw new Error('Some commits are not on the current branch.');
      }

      const youngest = sortedByHistory[0].hash;
      const oldest = sortedByHistory[sortedByHistory.length - 1].hash;

      // Get the parent of the oldest commit
      let oldestParent = '';
      try {
        oldestParent = (await this._git.raw(['rev-parse', `${oldest}^`])).trim();
      } catch (err) {
        throw new Error(`Cannot find parent of oldest commit ${oldest.substring(0, 7)}. Squashing the root commit is not supported.`);
      }

      const isYoungestHead = youngest === originalHead;

      if (isYoungestHead) {
        console.log('Squashing Case A: Youngest is HEAD. Soft resetting to:', oldestParent);
        await this._git.reset(['--soft', oldestParent]);
        await this._git.commit(commitMessage);
        vscode.window.showInformationMessage('Successfully squashed commits.');
        return true;
      } else {
        console.log('Squashing Case B: Youngest is not HEAD. Creating temp branch at:', youngest);
        const tempBranchName = `temp-squash-${Date.now()}`;
        
        await this._git.checkout(['-b', tempBranchName, youngest]);
        await this._git.reset(['--soft', oldestParent]);
        await this._git.commit(commitMessage);
        
        console.log(`Cherry-picking range: ${youngest}..${originalBranch}`);
        try {
          await this._git.raw(['cherry-pick', `${youngest}..${originalBranch}`]);
        } catch (cpErr) {
          await this._git.raw(['cherry-pick', '--abort']);
          throw cpErr;
        }
        
        await this._git.checkout(originalBranch);
        await this._git.reset(['--hard', tempBranchName]);
        await this._git.raw(['branch', '-D', tempBranchName]);
        
        vscode.window.showInformationMessage('Successfully squashed commits.');
        return true;
      }
    } catch (err: any) {
      console.error('Squash failed. Rolling back...', err);
      if (originalBranch) {
        try {
          try {
            await this._git.raw(['cherry-pick', '--abort']);
          } catch (e) {
            // ignore
          }
          await this._git.checkout(originalBranch);
          if (originalHead) {
            await this._git.reset(['--hard', originalHead]);
          }
        } catch (rollbackErr) {
          console.error('Failed to rollback squash:', rollbackErr);
        }
      }
      vscode.window.showErrorMessage(`Squash commits failed: ${err.message || err}`);
      return false;
    }
  }

  public async isWorkingTreeClean(): Promise<boolean> {
    if (!this._git) return false;
    try {
      const status = await this._git.status();
      const hasChanges = status.files.some(f => {
        // '?' in both index and working_dir is untracked
        const isUntracked = f.index === '?' && f.working_dir === '?';
        return !isUntracked;
      });
      return !hasChanges;
    } catch (err) {
      console.error('Error checking git status cleanliness:', err);
      return false;
    }
  }

  public async rewordCommit(hash: string, newMessage: string): Promise<boolean> {
    if (!this._git) return false;
    validateHash(hash);

    let originalBranch = '';
    let originalHead = '';

    try {
      // 1. Verify working tree is clean (excluding untracked files)
      const clean = await this.isWorkingTreeClean();
      if (!clean) {
        throw new Error('Your working tree has unstaged or staged changes. Please commit or stash them first.');
      }

      // 2. Get current branch details
      const branchInfo = await this._git.branch();
      originalBranch = branchInfo.current;
      originalHead = (await this._git.revparse(['HEAD'])).trim();

      if (!originalBranch || branchInfo.detached) {
        throw new Error('Not on a valid branch or branch is detached.');
      }

      // 3. Verify target commit is in current branch history
      const rawLog = await this._git.raw(['log', '--format=%H', '-n', '1000', 'HEAD']);
      const branchHashes = rawLog.trim().split('\n').filter(Boolean);
      const commitIndex = branchHashes.indexOf(hash);
      if (commitIndex === -1) {
        throw new Error(`Commit ${hash.substring(0, 7)} is not in the history of the current branch.`);
      }

      // 4. Get parent of target commit
      let parent = '';
      try {
        parent = (await this._git.raw(['rev-parse', `${hash}^`])).trim();
      } catch (err) {
        throw new Error(`Cannot find parent of commit ${hash.substring(0, 7)}. Rewording the root commit is not supported.`);
      }

      const isHead = hash === originalHead;

      if (isHead) {
        console.log('Rewording HEAD commit...');
        await this._git.raw(['commit', '--amend', '-m', newMessage]);
        vscode.window.showInformationMessage('Successfully updated commit message.');
        return true;
      } else {
        console.log('Rewording older commit. Creating temp branch at:', hash);
        const tempBranchName = `temp-reword-${Date.now()}`;
        
        await this._git.checkout(['-b', tempBranchName, hash]);
        await this._git.raw(['commit', '--amend', '-m', newMessage]);
        
        console.log(`Cherry-picking range: ${hash}..${originalBranch}`);
        try {
          await this._git.raw(['cherry-pick', `${hash}..${originalBranch}`]);
        } catch (cpErr) {
          await this._git.raw(['cherry-pick', '--abort']);
          throw cpErr;
        }
        
        await this._git.checkout(originalBranch);
        await this._git.reset(['--hard', tempBranchName]);
        await this._git.raw(['branch', '-D', tempBranchName]);
        
        vscode.window.showInformationMessage('Successfully updated commit message.');
        return true;
      }
    } catch (err: any) {
      console.error('Reword failed. Rolling back...', err);
      if (originalBranch) {
        try {
          try {
            await this._git.raw(['cherry-pick', '--abort']);
          } catch (e) {
            // ignore
          }
          await this._git.checkout(originalBranch);
          if (originalHead) {
            await this._git.reset(['--hard', originalHead]);
          }
        } catch (rollbackErr) {
          console.error('Failed to rollback reword:', rollbackErr);
        }
      }
      vscode.window.showErrorMessage(`Edit commit message failed: ${err.message || err}`);
      return false;
    }
  }

  public async getCommitMessages(hashes: string[]): Promise<string[]> {
    if (!this._git) return [];
    hashes.forEach(validateHash);
    const messages: string[] = [];
    for (const hash of hashes) {
      try {
        const msg = await this._git.raw(['log', '-1', '--format=%B', hash]);
        messages.push(msg.trim());
      } catch {
        messages.push('');
      }
    }
    return messages;
  }

  public async getStashes(): Promise<{ hash: string, refName: string, message: string, date: string }[]> {
    if (!this._git) return [];
    try {
      const result = await this._git.raw(['stash', 'list', '--format=%H%x09%gd%x09%gB%x09%at%x00']);
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
    if (!this._git) return [];
    validateHash(hash);
    try {
      const result = await this._git.raw(['stash', 'show', '--name-status', hash]);
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
    if (!this._git) return false;
    validateStashRef(refName);
    try {
      await this._git.raw(['stash', 'apply', refName]);
      vscode.window.showInformationMessage(`Successfully applied stash '${refName}'.`);
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to apply stash: ${err.message || err}`);
      return false;
    }
  }

  public async popStash(refName: string): Promise<boolean> {
    if (!this._git) return false;
    validateStashRef(refName);
    try {
      await this._git.raw(['stash', 'pop', refName]);
      vscode.window.showInformationMessage(`Successfully popped stash '${refName}'.`);
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to pop stash: ${err.message || err}`);
      return false;
    }
  }

  public async dropStash(refName: string): Promise<boolean> {
    if (!this._git) return false;
    validateStashRef(refName);
    try {
      await this._git.raw(['stash', 'drop', refName]);
      vscode.window.showInformationMessage(`Successfully dropped stash '${refName}'.`);
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to drop stash: ${err.message || err}`);
      return false;
    }
  }

  public async clearStashes(): Promise<boolean> {
    if (!this._git) return false;
    try {
      await this._git.raw(['stash', 'clear']);
      vscode.window.showInformationMessage('Successfully cleared all stashes.');
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to clear stashes: ${err.message || err}`);
      return false;
    }
  }

  public async createStash(message: string, keepIndex: boolean, includeUntracked: boolean): Promise<boolean> {
    if (!this._git) return false;
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
      await this._git.raw(args);
      vscode.window.showInformationMessage('Successfully created stash.');
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to create stash: ${err.message || err}`);
      return false;
    }
  }

  public async getWorktrees(): Promise<{ path: string; commit: string; branch: string; isMain: boolean }[]> {
    if (!this._git) return [];
    try {
      const result = await this._git.raw(['worktree', 'list', '--porcelain']);
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

  public async removeWorktree(path: string, force: boolean = false): Promise<boolean> {
    if (!this._git) return false;
    validateFilePath(path);
    try {
      const args = ['worktree', 'remove'];
      if (force) {
        args.push('--force');
      }
      args.push(path);
      await this._git.raw(args);
      vscode.window.showInformationMessage(`Successfully removed worktree '${path}'.`);
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to remove worktree: ${err.message || err}`);
      return false;
    }
  }

  public async pruneWorktrees(): Promise<boolean> {
    if (!this._git) return false;
    try {
      await this._git.raw(['worktree', 'prune']);
      vscode.window.showInformationMessage('Successfully pruned worktrees.');
      return true;
    } catch (err: any) {
      vscode.window.showErrorMessage(`Failed to prune worktrees: ${err.message || err}`);
      return false;
    }
  }
}



