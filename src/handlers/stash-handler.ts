import * as vscode from 'vscode';
import { GitService } from '../git';
import { IGitJBViewProvider } from './base-handler';

export async function handleStashMessage(
  data: any,
  gitService: GitService,
  webview: vscode.Webview,
  provider: IGitJBViewProvider
): Promise<boolean> {
  switch (data.type) {
    case 'getStashFiles': {
      const files = await gitService.getStashFiles(data.hash);
      webview.postMessage({ type: 'files', hash: data.hash, files });
      return true;
    }

    case 'applyStash':
      await gitService.applyStash(data.refName);
      provider.refresh();
      return true;

    case 'popStash':
      await gitService.popStash(data.refName);
      provider.refresh();
      return true;

    case 'dropStash':
      await gitService.dropStash(data.refName);
      provider.refresh();
      return true;

    case 'clearStashes': {
      const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to clear all stashes? This operation cannot be undone.`,
        { modal: true },
        'Clear All'
      );
      if (confirm === 'Clear All') {
        await gitService.clearStashes();
        provider.refresh();
      }
      return true;
    }

    case 'createStash':
      await gitService.createStash(data.message, data.keepIndex, data.includeUntracked);
      provider.refresh();
      return true;
  }

  return false;
}
