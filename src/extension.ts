import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from './git';

export function activate(context: vscode.ExtensionContext) {
  const gitService = new GitService();
  const provider = new GitJBViewProvider(context.extensionUri, gitService);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(GitJBViewProvider.viewType, provider)
  );

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
          const diff = await this._gitService.getDiff(data.hash);
          this._view?.webview.postMessage({ type: 'diff', diff });
          break;
      }
    });
  }

  public async refresh() {
    if (this._view) {
      const log = await this._gitService.getLog();
      const status = await this._gitService.getStatus();
      const branches = await this._gitService.getBranches();

      this._view.webview.postMessage({
        type: 'update',
        payload: { log, status, branches }
      });
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
