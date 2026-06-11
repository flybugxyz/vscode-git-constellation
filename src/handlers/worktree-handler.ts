import * as vscode from 'vscode';
import { GitService } from '../git';
import { IGitJBViewProvider, WebviewMessage } from './base-handler';

export async function handleWorktreeMessage(
  data: WebviewMessage,
  gitService: GitService,
  webview: vscode.Webview,
  provider: IGitJBViewProvider
): Promise<boolean> {
  switch (data.type) {
    case 'removeWorktree': {
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to remove worktree '${data.path}'?`,
        { modal: true },
        'Remove'
      );
      if (confirm === 'Remove') {
        const success = await gitService.removeWorktree(data.path, false);
        if (!success) {
          const forceConfirm = await vscode.window.showWarningMessage(
            `Failed to remove worktree '${data.path}'. It might have unstaged changes or submodules. Do you want to force remove it?`,
            { modal: true },
            'Force Remove'
          );
          if (forceConfirm === 'Force Remove') {
            await gitService.removeWorktree(data.path, true);
          }
        }
        provider.refresh();
      }
      return true;
    }

    case 'pruneWorktrees':
      await gitService.pruneWorktrees();
      provider.refresh();
      return true;

    case 'openWorktree':
      try {
        const uri = vscode.Uri.file(data.path);
        await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
      } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to open worktree in new window: ${err.message || err}`);
      }
      return true;
  }

  return false;
}
