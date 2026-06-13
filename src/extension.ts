import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from './git';
import { handleCommitMessage } from './handlers/commit-handler';
import { handleBranchMessage } from './handlers/branch-handler';
import { handleStashMessage } from './handlers/stash-handler';
import { handleWorktreeMessage } from './handlers/worktree-handler';
import { handleAIMessage } from './handlers/ai-handler';
import { handleOpsMessage } from './handlers/ops-handler';

export function activate(context: vscode.ExtensionContext) {
  const gitService = new GitService();
  const provider = new GitJBViewProvider(context.extensionUri, gitService);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      GitJBViewProvider.viewType,
      provider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('git-constellation.testOpenAISettings', async () => {
      const config = vscode.workspace.getConfiguration('git-constellation.openai');
      const apiUrl = config.get<string>('apiUrl');
      const apiKey = config.get<string>('apiKey');
      const model = config.get<string>('model');

      if (!apiKey || !apiUrl) {
        vscode.window.showErrorMessage('OpenAI API URL and API Key must be configured.');
        return;
      }

      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Testing OpenAI Configuration...',
        cancellable: false
      }, async () => {
        try {
          // Import dynamic loader from ai-client to avoid duplications
          // @ts-ignore
          const { requestAIApi } = await import('./ai-client');
          const result = await requestAIApi(apiUrl, apiKey, {
            model: model,
            messages: [{ role: 'user', content: 'Say "hello"' }],
            max_tokens: 10
          });
          if (result && result.choices && result.choices[0]) {
            vscode.window.showInformationMessage('OpenAI configuration test successful!');
          } else {
            throw new Error('Unexpected response structure');
          }
        } catch (err: any) {
          vscode.window.showErrorMessage(`OpenAI configuration test failed: ${err.message}`);
        }
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('git-constellation.viewFileHistory', async (uri?: vscode.Uri) => {
      const targetUri = uri || vscode.window.activeTextEditor?.document.uri;
      if (targetUri && targetUri.scheme === 'file') {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspaceRoot) {
          const relativePath = path.relative(workspaceRoot, targetUri.fsPath).replace(/\\/g, '/');
          await vscode.commands.executeCommand('git-constellation.log.focus');
          provider.setFileFilter(relativePath);
        }
      }
    })
  );

  // Register custom content provider for showing historical files
  const contentProvider = new (class implements vscode.TextDocumentContentProvider {
    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
      const [hash, ...pathParts] = uri.path.split('/');
      const filePath = pathParts.join('/');
      return await gitService.getFileContent(hash, filePath);
    }
  })();
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('git-constellation-show', contentProvider));

  // Register custom content provider for showing full commit diffs
  const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
      const hash = uri.path.replace(/\.diff$/, '');
      return await gitService.getDiff(hash);
    }
  })();
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('git-constellation-diff', diffContentProvider));

  // Register custom content provider for showing tag details
  const tagContentProvider = new (class implements vscode.TextDocumentContentProvider {
    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
      const tagName = uri.path.replace(/\.txt$/, '');
      return await gitService.getTagDetails(tagName);
    }
  })();
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider('git-constellation-tag', tagContentProvider));

  // Refresh on git changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/.git/refs/heads/*');
  watcher.onDidChange(() => provider.scheduleRefresh());
  watcher.onDidCreate(() => provider.scheduleRefresh());
  watcher.onDidDelete(() => provider.scheduleRefresh());
  context.subscriptions.push(watcher);

  // Refresh on file save, creation, deletion, rename to keep local changes up to date
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(() => provider.scheduleRefresh()),
    vscode.workspace.onDidCreateFiles(() => provider.scheduleRefresh()),
    vscode.workspace.onDidDeleteFiles(() => provider.scheduleRefresh()),
    vscode.workspace.onDidRenameFiles(() => provider.scheduleRefresh())
  );
}

class GitJBViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'git-constellation.log';
  private _view?: vscode.WebviewView;
  private _currentFilter: string = 'ALL';
  private _currentAuthorFilter: string = 'ALL';
  private _currentSearchFilter: string = '';
  private _currentFileFilter: string = '';
  private _refreshTimer?: NodeJS.Timeout;
  private _pendingTabSelection?: 'log' | 'local' | 'stashes' | 'worktrees';

  public setFileFilter(file: string) {
    this._currentFileFilter = file;
    this._pendingTabSelection = 'log';
    if (this._view) {
      this._view.show?.(true);
      this._view.webview.postMessage({ type: 'selectTab', tab: 'log' });
    }
    this.refresh();
  }

  public scheduleRefresh() {
    if (this._refreshTimer) {
      clearTimeout(this._refreshTimer);
    }
    this._refreshTimer = setTimeout(() => {
      this.refresh();
    }, 100);
  }

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _gitService: GitService
  ) { }

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
      try {
        if (await handleCommitMessage(data, this._gitService, webviewView.webview, this)) return;
        if (await handleBranchMessage(data, this._gitService, webviewView.webview, this)) return;
        if (await handleStashMessage(data, this._gitService, webviewView.webview, this)) return;
        if (await handleWorktreeMessage(data, this._gitService, webviewView.webview, this)) return;
        if (await handleAIMessage(data, this._gitService, webviewView.webview, this)) return;
        if (await handleOpsMessage(data, this._gitService, webviewView.webview, this)) return;

        switch (data.type) {
          case 'ready':
          case 'refresh':
            this.refresh();
            break;
          case 'setActiveRepo':
            this._gitService.setActiveRepo(data.path);
            this.refresh();
            break;
          case 'loadMoreCommits': {
            const skip = data.skip || 0;
            const maxCount = 100;
            try {
              const log = await this._gitService.getLog(
                this._currentFilter,
                this._currentAuthorFilter,
                this._currentSearchFilter,
                this._currentFileFilter,
                skip,
                maxCount
              );
              this._view?.webview.postMessage({
                type: 'appendCommits',
                payload: { log }
              });
            } catch (err) {
              console.error('GitJBViewProvider: Error loading more commits:', err);
            }
            break;
          }
          case 'setFileFilter':
            this._currentFileFilter = data.file;
            this.refresh();
            break;
          case 'setFilter':
            this._currentFilter = data.branch;
            this.refresh();
            break;
          case 'setAuthorFilter':
            console.log('[Host] Received setAuthorFilter with author:', data.author);
            this._currentAuthorFilter = data.author;
            this.refresh();
            break;
          case 'setSearchFilter':
            this._currentSearchFilter = data.search;
            this.refresh();
            break;
        }
      } catch (err) {
        console.error('GitJBViewProvider: Error processing message:', err);
      }
    });
  }

  public async refresh() {
    console.log(`GitJBViewProvider: Refreshing with filter: ${this._currentFilter}, author: ${this._currentAuthorFilter}, search: ${this._currentSearchFilter}, file: ${this._currentFileFilter}...`);
    if (this._view) {
      try {
        const maxCommits = vscode.workspace.getConfiguration('git-constellation').get<number>('maxCommits') ?? 100;
        const [log, status, branches, tags, authors, currentUser, stashes, worktrees, repositories] = await Promise.all([
          this._gitService.getLog(this._currentFilter, this._currentAuthorFilter, this._currentSearchFilter, this._currentFileFilter, 0, maxCommits),
          this._gitService.getStatus(),
          this._gitService.getBranches(),
          this._gitService.getTags(),
          this._gitService.getAuthors(),
          this._gitService.getCurrentUser(),
          this._gitService.getStashes(),
          this._gitService.getWorktrees(),
          this._gitService.getRepositories()
        ]);

        console.log(`GitJBViewProvider: Sending update to webview. Log: ${log?.all?.length || 0} commits`);

        this._view.webview.postMessage({
          type: 'update',
          payload: {
            log,
            status,
            branches,
            tags,
            authors,
            currentUser,
            fileFilter: this._currentFileFilter,
            stashes,
            worktrees,
            repositories,
            activeRepo: this._gitService.activeRepoPath,
            selectTab: this._pendingTabSelection
          }
        });
        this._pendingTabSelection = undefined;
      } catch (err) {
        console.error('GitJBViewProvider: Error during refresh:', err);
      }
    } else {
      console.log('GitJBViewProvider: No view available to refresh');
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const webviewUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'dist-webview'));
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
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} vscode-resource: https: data:; font-src ${webview.cspSource} vscode-resource:; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-eval';">
				<base href="${webviewUri}/">
				<link href="${styleUri}" rel="stylesheet">
				<title>GitConstellation</title>
			</head>
			<body>
				<div id="root"></div>
				<script type="module" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

export function deactivate() { }
