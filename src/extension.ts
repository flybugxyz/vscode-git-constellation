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

  // Refresh on git changes
  const watcher = vscode.workspace.createFileSystemWatcher('**/.git/refs/heads/*');
  watcher.onDidChange(() => provider.refresh());
  watcher.onDidCreate(() => provider.refresh());
  watcher.onDidDelete(() => provider.refresh());
  context.subscriptions.push(watcher);
}

class GitJBViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'git-jb.log';
  private _view?: vscode.WebviewView;

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
          this.refresh();
          break;
        case 'commit':
          await this._gitService.commit(data.message);
          this.refresh();
          break;
        case 'getDiff':
          const files = await this._gitService.getCommitFiles(data.hash);
          this._view?.webview.postMessage({ type: 'files', hash: data.hash, files });
          break;
        case 'openDiff':
          const { hash, path } = data;
          const parentHash = await this._gitService.getParentHash(hash);
          
          const leftUri = vscode.Uri.parse(`git-jb-show:${parentHash || ''}/${path}`);
          const rightUri = vscode.Uri.parse(`git-jb-show:${hash}/${path}`);
          
          vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, `${path} (${hash.substring(0, 7)})`);
          break;
        case 'checkout':
          await this._gitService.checkout(data.branch);
          this.refresh();
          break;
      }
    });
  }

  public async refresh() {
    console.log('GitJBViewProvider: Refreshing...');
    if (this._view) {
      try {
        const log = await this._gitService.getLog();
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
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src ${webview.cspSource}; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-eval';">
				<link href="${styleUri}" rel="stylesheet">
				<title>Git JB</title>
			</head>
			<body>
				<div id="root"></div>
				<script type="module" src="${scriptUri}"></script>
			</body>
			</html>`;
  }
}

export function deactivate() {}
