import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as pathModule from 'path';

export interface RepositoryInfo {
  name: string;
  path: string;
  isMain: boolean;
}

export class GitCoreService {
  private _workspaceRoot?: string;
  private _activeRepoPath?: string;
  private _gitInstances: Map<string, SimpleGit> = new Map();

  constructor() {
    this._workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (this._workspaceRoot) {
      this._activeRepoPath = this._workspaceRoot;
      this._gitInstances.set(this._workspaceRoot, this.initSimpleGit(this._workspaceRoot));
    }
  }

  private initSimpleGit(path: string): SimpleGit {
    return simpleGit({
      baseDir: path,
      binary: 'git',
      maxConcurrentProcesses: 6,
      timeout: {
        block: 15000 // 15 seconds timeout to prevent hanging the UI
      },
      unsafe: {
        allowUnsafeSshCommand: true
      }
    }).env({
      ...process.env,
      GIT_TERMINAL_PROMPT: '0',
      GIT_SSH_COMMAND: 'ssh -o BatchMode=yes'
    });
  }

  public get workspaceRoot(): string | undefined {
    return this._workspaceRoot;
  }

  public get activeRepoPath(): string | undefined {
    return this._activeRepoPath;
  }

  public setActiveRepo(path: string) {
    this._activeRepoPath = path;
  }

  public get git(): SimpleGit | undefined {
    if (!this._activeRepoPath) return undefined;
    if (!this._gitInstances.has(this._activeRepoPath)) {
      this._gitInstances.set(this._activeRepoPath, this.initSimpleGit(this._activeRepoPath));
    }
    return this._gitInstances.get(this._activeRepoPath);
  }

  public async getRepositories(): Promise<RepositoryInfo[]> {
    if (!this._workspaceRoot) return [];
    
    const repos: RepositoryInfo[] = [{
      name: pathModule.basename(this._workspaceRoot),
      path: this._workspaceRoot,
      isMain: true
    }];

    try {
      const mainGit = this._gitInstances.get(this._workspaceRoot) || this.initSimpleGit(this._workspaceRoot);
      const submodulesOutput = await mainGit.raw(['submodule', 'status']);
      if (submodulesOutput && submodulesOutput.trim()) {
        const lines = submodulesOutput.trim().split('\n');
        for (const line of lines) {
          const match = line.match(/^[\s\+\-U][a-fA-F0-9]{40}\s+(.+?)(?:\s+\(.*?\))?$/);
          if (match && match[1]) {
            const subPath = match[1];
            const fullPath = pathModule.join(this._workspaceRoot, subPath);
            const resolvedPath = pathModule.resolve(fullPath);
            
            // CR-004 Security: Prevent Directory Traversal
            if (!resolvedPath.startsWith(this._workspaceRoot)) {
              console.warn(`GitCoreService: Submodule path is outside workspace root: ${resolvedPath}`);
              continue;
            }
            if (fs.existsSync(resolvedPath)) {
               repos.push({
                 name: pathModule.basename(resolvedPath),
                 path: resolvedPath,
                 isMain: false
               });
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching submodules:', err);
    }
    
    return repos;
  }

  public async getHttpRemoteUrl(): Promise<string | undefined> {
    const git = this.git;
    if (!git) return undefined;
    try {
      const remoteUrl = await git.remote(['get-url', 'origin']);
      if (remoteUrl) return this.parseRemoteUrlToHttp(remoteUrl.trim());
    } catch {
      try {
        const remotes = await git.remote([]);
        if (remotes && remotes.trim()) {
          const firstRemote = remotes.trim().split('\n')[0].trim();
          const remoteUrl = await git.remote(['get-url', firstRemote]);
          if (remoteUrl) return this.parseRemoteUrlToHttp(remoteUrl.trim());
        }
      } catch {}
    }
    return undefined;
  }

  private parseRemoteUrlToHttp(url: string): string | undefined {
    let cleanUrl = url.trim();
    if (cleanUrl.endsWith('.git')) {
      cleanUrl = cleanUrl.substring(0, cleanUrl.length - 4);
    }
    const sshMatch = cleanUrl.match(/^git@([^:]+):(.+)$/);
    if (sshMatch) {
      return `https://${sshMatch[1]}/${sshMatch[2]}`;
    }
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      return cleanUrl;
    }
    return undefined;
  }

  public async getCommitUrl(hash: string): Promise<string | undefined> {
    const baseUrl = await this.getHttpRemoteUrl();
    if (!baseUrl) return undefined;
    return `${baseUrl}/commit/${hash}`;
  }

  public async getBranchUrl(branch: string): Promise<string | undefined> {
    const baseUrl = await this.getHttpRemoteUrl();
    if (!baseUrl) return undefined;
    return `${baseUrl}/tree/${branch}`;
  }

  public async getTagUrl(tag: string): Promise<string | undefined> {
    const baseUrl = await this.getHttpRemoteUrl();
    if (!baseUrl) return undefined;
    if (baseUrl.includes('gitlab.com')) {
      return `${baseUrl}/-/tags/${tag}`;
    }
    return `${baseUrl}/releases/tag/${tag}`;
  }
}

