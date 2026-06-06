import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from './git';

export function activate(context: vscode.ExtensionContext) {
  const gitService = new GitService();
  const provider = new GitJBViewProvider(context.extensionUri, gitService);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(GitJBViewProvider.viewType, provider)
  );

  // Register custom content provider for showing historical files
  const contentProvider = new (class implements vscode.TextDocumentContentProvider {
    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
      const [hash, ...pathParts] = uri.path.split('/');
      const filePath = pathParts.join('/');
      return await gitService.getFileContent(hash, filePath);
    }
  })();
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('git-jb-show', contentProvider));

  // Register custom content provider for showing full commit diffs
  const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
      const hash = uri.path.replace(/\.diff$/, '');
      return await gitService.getDiff(hash);
    }
  })();
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('git-jb-diff', diffContentProvider));

  // Register custom content provider for showing tag details
  const tagContentProvider = new (class implements vscode.TextDocumentContentProvider {
    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
      const tagName = uri.path.replace(/\.txt$/, '');
      return await gitService.getTagDetails(tagName);
    }
  })();
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('git-jb-tag', tagContentProvider));

  // Refresh on git changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/.git/refs/heads/*');
  watcher.onDidChange(() => provider.refresh());
  watcher.onDidCreate(() => provider.refresh());
  watcher.onDidDelete(() => provider.refresh());
  context.subscriptions.push(watcher);

  // Refresh on file save, creation, deletion, rename to keep local changes up to date
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => provider.refresh()),
    vscode.workspace.onDidCreateFiles(() => provider.refresh()),
    vscode.workspace.onDidDeleteFiles(() => provider.refresh()),
    vscode.workspace.onDidRenameFiles(() => provider.refresh())
  );
}

class GitJBViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'git-jb.log';
  private _view?: vscode.WebviewView;
  private _currentFilter: string = 'ALL';

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _gitService: GitService
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'ready':
          this._currentFilter = 'ALL';
          this.refresh();
          break;
        case 'commit':
          await this._gitService.commit(data.message, data.files);
          this.refresh();
          break;
        case 'commitAndPush':
          const commitSuccess = await this._gitService.commit(data.message, data.files);
          if (commitSuccess) {
            await this._gitService.push(data.force);
          }
          this.refresh();
          break;
        case 'getDiff':
          const files = await this._gitService.getCommitFiles(data.hash);
          this._view?.webview.postMessage({ type: 'files', hash: data.hash, files });
          break;
        case 'openDiff':
          const { hash, path: filePath, isCompare } = data;
          if (hash) {
            if (isCompare) {
              const leftUri = vscode.Uri.parse(`git-jb-show:HEAD/${filePath}`);
              const rightUri = vscode.Uri.parse(`git-jb-show:${hash}/${filePath}`);
              vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, `${filePath} (HEAD vs ${hash.substring(0, 7)})`);
            } else {
              const parentHash = await this._gitService.getParentHash(hash);
              const leftUri = vscode.Uri.parse(`git-jb-show:${parentHash || ''}/${filePath}`);
              const rightUri = vscode.Uri.parse(`git-jb-show:${hash}/${filePath}`);
              vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, `${filePath} (${hash.substring(0, 7)})`);
            }
          } else {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspaceRoot) {
              const leftUri = vscode.Uri.parse(`git-jb-show:HEAD/${filePath}`);
              const rightUri = vscode.Uri.file(path.join(workspaceRoot, filePath));
              vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, `${filePath} (Local Changes)`);
            }
          }
          break;
        case 'checkout':
          await this._gitService.checkout(data.branch);
          this.refresh();
          break;
        case 'setFilter':
          this._currentFilter = data.branch;
          this.refresh();
          break;
        case 'copySHA':
          await vscode.env.clipboard.writeText(data.hash);
          vscode.window.showInformationMessage('SHA copied to clipboard');
          break;
        case 'copyShortSHA':
          await vscode.env.clipboard.writeText(data.hash.substring(0, 7));
          vscode.window.showInformationMessage('Short SHA copied to clipboard');
          break;
        case 'copyMessage':
          await vscode.env.clipboard.writeText(data.message);
          vscode.window.showInformationMessage('Commit message copied to clipboard');
          break;
        case 'copyURL': {
          const url = await this._gitService.getCommitUrl(data.hash);
          if (url) {
            await vscode.env.clipboard.writeText(url);
            vscode.window.showInformationMessage('Commit URL copied to clipboard');
          } else {
            vscode.window.showErrorMessage('Failed to resolve remote commit URL');
          }
          break;
        }
        case 'openInBrowser': {
          const browserUrl = await this._gitService.getCommitUrl(data.hash);
          if (browserUrl) {
            vscode.env.openExternal(vscode.Uri.parse(browserUrl));
          } else {
            vscode.window.showErrorMessage('Failed to resolve remote commit URL');
          }
          break;
        }
        case 'createBranch': {
          const branchName = await vscode.window.showInputBox({
            prompt: `Create Branch from commit ${data.hash.substring(0, 7)}`,
            placeHolder: 'Enter branch name'
          });
          if (branchName && branchName.trim()) {
            await this._gitService.createBranch(branchName.trim(), data.hash);
            this.refresh();
          }
          break;
        }
        case 'createTag': {
          const tagName = await vscode.window.showInputBox({
            prompt: `Create Tag at commit ${data.hash.substring(0, 7)}`,
            placeHolder: 'Enter tag name'
          });
          if (tagName && tagName.trim()) {
            await this._gitService.createTag(tagName.trim(), data.hash);
            this.refresh();
          }
          break;
        }
        case 'createWorktree': {
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          const defaultPath = workspaceRoot ? path.join(path.dirname(workspaceRoot), `${path.basename(workspaceRoot)}-wt-${data.hash.substring(0, 7)}`) : '';
          const wtPath = await vscode.window.showInputBox({
            prompt: `Create Worktree for commit ${data.hash.substring(0, 7)}`,
            placeHolder: 'Enter local folder path for worktree',
            value: defaultPath
          });
          if (wtPath && wtPath.trim()) {
            await this._gitService.createWorktree(wtPath.trim(), data.hash);
            this.refresh();
          }
          break;
        }
        case 'cherryPick':
          await this._gitService.cherryPick(data.hash);
          this.refresh();
          break;
        case 'cherryPickWithWorktree': {
          const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          const defaultPath = workspaceRoot ? path.join(path.dirname(workspaceRoot), `${path.basename(workspaceRoot)}-wt-cp-${data.hash.substring(0, 7)}`) : '';
          const wtPath = await vscode.window.showInputBox({
            prompt: `Enter worktree folder path`,
            placeHolder: 'Enter local path',
            value: defaultPath
          });
          if (!wtPath || !wtPath.trim()) break;
          const branchName = await vscode.window.showInputBox({
            prompt: `Enter new branch name for the cherry-pick in worktree`,
            placeHolder: 'Enter branch name',
            value: `cherry-pick-${data.hash.substring(0, 7)}`
          });
          if (!branchName || !branchName.trim()) break;
          await this._gitService.cherryPickWithWorktree(wtPath.trim(), branchName.trim(), data.hash);
          this.refresh();
          break;
        }
        case 'revertCommit':
          await this._gitService.revertCommit(data.hash);
          this.refresh();
          break;
        case 'rebase':
          await this._gitService.rebase(data.hash);
          this.refresh();
          break;
        case 'merge':
          await this._gitService.merge(data.hash);
          this.refresh();
          break;
        case 'compare': {
          const compareFiles = await this._gitService.getCompareFiles(data.hash);
          this._view?.webview.postMessage({
            type: 'compareFiles',
            hash: data.hash,
            files: compareFiles
          });
          break;
        }
        case 'viewDiff': {
          const uri = vscode.Uri.parse(`git-jb-diff:${data.hash}.diff`);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: false });
          break;
        }
        case 'checkoutBranch':
          await this._gitService.checkout(data.branch);
          this.refresh();
          break;
        case 'newBranchFrom': {
          const branchName = await vscode.window.showInputBox({
            prompt: `Create New Branch from '${data.branch}'`,
            placeHolder: 'Enter new branch name'
          });
          if (branchName && branchName.trim()) {
            await this._gitService.createBranchFrom(branchName.trim(), data.branch);
            this.refresh();
          }
          break;
        }
        case 'mergeBranch':
          await this._gitService.merge(data.branch);
          this.refresh();
          break;
        case 'rebaseBranch':
          await this._gitService.rebase(data.branch);
          this.refresh();
          break;
        case 'pullBranch':
          await this._gitService.pullBranch(data.branch);
          this.refresh();
          break;
        case 'pushBranch':
          await this._gitService.pushBranch(data.branch);
          this.refresh();
          break;
        case 'pushBranchTo': {
          const remote = await vscode.window.showInputBox({
            prompt: `Push branch '${data.branch}' to remote`,
            value: 'origin',
            placeHolder: 'Enter remote name'
          });
          if (remote && remote.trim()) {
            await this._gitService.pushBranch(data.branch, remote.trim());
            this.refresh();
          }
          break;
        }
        case 'renameBranch': {
          const newName = await vscode.window.showInputBox({
            prompt: `Rename branch '${data.branch}'`,
            value: data.branch,
            placeHolder: 'Enter new branch name'
          });
          if (newName && newName.trim() && newName.trim() !== data.branch) {
            await this._gitService.renameBranch(data.branch, newName.trim());
            this.refresh();
          }
          break;
        }
        case 'deleteBranch': {
          const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete branch '${data.branch}'?`,
            { modal: true },
            'Delete'
          );
          if (confirm === 'Delete') {
            await this._gitService.deleteBranch(data.branch, data.isRemote);
            this.refresh();
          }
          break;
        }
        case 'compareBranch': {
          const compareFiles = await this._gitService.compareBranches('HEAD', data.branch);
          this._view?.webview.postMessage({
            type: 'compareFiles',
            hash: data.branch,
            files: compareFiles
          });
          break;
        }
        case 'compareBranchWith': {
          const branchesResult = await this._gitService.getBranches();
          if (branchesResult) {
            const list = branchesResult.all.filter((b: string) => b !== data.branch);
            const otherBranch = await vscode.window.showQuickPick(list, {
              placeHolder: `Select branch to compare with '${data.branch}'`
            });
            if (otherBranch) {
              const compareFiles = await this._gitService.compareBranches(otherBranch, data.branch);
              this._view?.webview.postMessage({
                type: 'compareFiles',
                hash: `${data.branch} vs ${otherBranch}`,
                files: compareFiles
              });
            }
          }
          break;
        }
        case 'openBranchInBrowser': {
          const url = await this._gitService.getBranchUrl(data.branch);
          if (url) {
            vscode.env.openExternal(vscode.Uri.parse(url));
          } else {
            vscode.window.showErrorMessage('Failed to resolve branch remote URL');
          }
          break;
        }
        case 'setUpstream': {
          const upstream = await vscode.window.showInputBox({
            prompt: `Set Upstream for '${data.branch}'`,
            placeHolder: 'e.g. origin/main'
          });
          if (upstream && upstream.trim()) {
            await this._gitService.setUpstream(data.branch, upstream.trim());
            this.refresh();
          }
          break;
        }
        case 'viewTagDetails': {
          const uri = vscode.Uri.parse(`git-jb-tag:${data.tag}.txt`);
          const doc = await vscode.workspace.openTextDocument(uri);
          await vscode.window.showTextDocument(doc, { preview: false });
          break;
        }
        case 'createBranchFromTag': {
          const branchName = await vscode.window.showInputBox({
            prompt: `Create branch from tag '${data.tag}'`,
            placeHolder: 'Enter branch name'
          });
          if (branchName && branchName.trim()) {
            await this._gitService.createBranchFrom(branchName.trim(), data.tag);
            this.refresh();
          }
          break;
        }
        case 'compareTag': {
          const compareFiles = await this._gitService.compareBranches('HEAD', data.tag);
          this._view?.webview.postMessage({
            type: 'compareFiles',
            hash: data.tag,
            files: compareFiles
          });
          break;
        }
        case 'deleteTag': {
          const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete tag '${data.tag}'?`,
            { modal: true },
            'Delete'
          );
          if (confirm === 'Delete') {
            await this._gitService.deleteTag(data.tag);
            const deleteRemote = await vscode.window.showInformationMessage(
              `Do you also want to delete remote tag '${data.tag}' from origin?`,
              'Yes',
              'No'
            );
            if (deleteRemote === 'Yes') {
              await this._gitService.deleteRemoteTag(data.tag);
            }
            this.refresh();
          }
          break;
        }
        case 'copyTagName':
          await vscode.env.clipboard.writeText(data.tag);
          vscode.window.showInformationMessage('Tag name copied to clipboard');
          break;
        case 'openTagInBrowser': {
          const url = await this._gitService.getTagUrl(data.tag);
          if (url) {
            vscode.env.openExternal(vscode.Uri.parse(url));
          } else {
            vscode.window.showErrorMessage('Failed to resolve tag remote URL');
          }
          break;
        }
      }
    });
  }

  public async refresh() {
    console.log(`GitJBViewProvider: Refreshing with filter: ${this._currentFilter}...`);
    if (this._view) {
      try {
        const log = await this._gitService.getLog(this._currentFilter);
        const status = await this._gitService.getStatus();
        const branches = await this._gitService.getBranches();

        console.log(`GitJBViewProvider: Sending update to webview. Log: ${log?.all.length || 0} commits`);
        
        this._view.webview.postMessage({
          type: 'update',
          payload: { log, status, branches }
        });
      } catch (err) {
        console.error('GitJBViewProvider: Error during refresh:', err);
      }
    } else {
      console.log('GitJBViewProvider: No view available to refresh');
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist-webview', 'assets', 'main.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist-webview', 'assets', 'main.css')
    );

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource} vscode-resource:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-eval';">
				<link href="${styleUri}" rel="stylesheet">
				<title>Git JB Style</title>
			</head>
			<body>
				<div id="root"></div>
				<script type="module" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

export function deactivate() {}
