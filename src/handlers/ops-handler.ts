import * as vscode from 'vscode';
import { GitService } from '../git';
import { IGitJBViewProvider, WebviewMessage } from './base-handler';

export async function handleOpsMessage(
  data: WebviewMessage,
  gitService: GitService,
  webview: vscode.Webview,
  provider: IGitJBViewProvider
): Promise<boolean> {
  switch (data.type) {
    case 'fetch':
      await gitService.fetch();
      provider.refresh();
      return true;

    case 'pull':
      await gitService.pull();
      provider.refresh();
      return true;

    case 'push':
      await gitService.push();
      provider.refresh();
      return true;

    case 'discardChanges':
      await gitService.discardChanges(data.path);
      provider.refresh();
      return true;

    case 'commitChanges':
      await gitService.commit(data.message, data.files);
      provider.refresh();
      return true;

    case 'commitAndPushChanges': {
      const commitSuccess = await gitService.commit(data.message, data.files);
      if (commitSuccess) {
        await gitService.push(data.force);
      }
      provider.refresh();
      return true;
    }
  }

  return false;
}
