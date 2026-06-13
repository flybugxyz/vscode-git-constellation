import * as vscode from 'vscode';
import { GitService } from '../git';
import { IGitJBViewProvider, WebviewMessage } from './base-handler';

export async function handleChangelistMessage(
  data: WebviewMessage,
  gitService: GitService,
  webview: vscode.Webview,
  provider: IGitJBViewProvider
): Promise<boolean> {
  const context = provider.context;
  let changelists = context.workspaceState.get<any[]>('changelists') || [];

  switch (data.type) {
    case 'createChangelistPrompt': {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter name for new Changelist',
        placeHolder: 'e.g. Refactor API calls'
      });
      if (name && name.trim()) {
        const trimmedName = name.trim();
        const id = `cl-${Date.now()}`;
        const currentChangelists = context.workspaceState.get<any[]>('changelists') || [];
        currentChangelists.push({ id, name: trimmedName, filePaths: [] });
        await context.workspaceState.update('changelists', [...currentChangelists]);
        provider.refresh();
      }
      return true;
    }

    case 'moveFilesToNewChangelistPrompt': {
      const { filePaths } = data;
      const name = await vscode.window.showInputBox({
        prompt: 'Enter name for new Changelist',
        placeHolder: 'e.g. Refactor API calls'
      });
      if (name && name.trim()) {
        const trimmedName = name.trim();
        const id = `cl-${Date.now()}`;
        const currentChangelists = context.workspaceState.get<any[]>('changelists') || [];
        const targetCl = { id, name: trimmedName, filePaths: [] as string[] };
        currentChangelists.push(targetCl);

        // Remove files from other changelists
        for (const cl of currentChangelists) {
          if (cl.id !== id) {
            cl.filePaths = cl.filePaths.filter((p: string) => !filePaths.includes(p));
          }
        }

        // Add files to target
        for (const path of filePaths) {
          targetCl.filePaths.push(path);
        }

        await context.workspaceState.update('changelists', [...currentChangelists]);
        provider.refresh();
      }
      return true;
    }

    case 'moveFilesToChangelist': {
      const { filePaths, targetChangelistId } = data;
      let targetCl = changelists.find(cl => cl.id === targetChangelistId);
      if (!targetCl) return true;

      // Remove files from other changelists
      for (const cl of changelists) {
        if (cl.id !== targetCl.id) {
          cl.filePaths = cl.filePaths.filter((p: string) => !filePaths.includes(p));
        }
      }

      // Add files to target changelist
      for (const path of filePaths) {
        if (!targetCl.filePaths.includes(path)) {
          targetCl.filePaths.push(path);
        }
      }

      await context.workspaceState.update('changelists', [...changelists]);
      provider.refresh();
      return true;
    }

    case 'renameChangelistPrompt': {
      const { changelistId } = data;
      const cl = changelists.find(c => c.id === changelistId);
      if (!cl) return true;

      const newName = await vscode.window.showInputBox({
        prompt: 'Rename Changelist',
        value: cl.name
      });

      if (newName && newName.trim()) {
        const currentChangelists = context.workspaceState.get<any[]>('changelists') || [];
        const targetCl = currentChangelists.find(c => c.id === changelistId);
        if (targetCl) {
          targetCl.name = newName.trim();
          await context.workspaceState.update('changelists', [...currentChangelists]);
          provider.refresh();
        }
      }
      return true;
    }

    case 'deleteChangelistPrompt': {
      const { changelistId } = data;
      const index = changelists.findIndex(c => c.id === changelistId);
      if (index === -1) return true;
      const cl = changelists[index];
      if (cl.isDefault) {
        vscode.window.showWarningMessage('Cannot delete the Default Changelist.');
        return true;
      }

      const selection = await vscode.window.showWarningMessage(
        `Are you sure you want to delete changelist "${cl.name}"? Files will be moved to the Default Changelist.`,
        { modal: true },
        'Delete'
      );

      if (selection === 'Delete') {
        const currentChangelists = context.workspaceState.get<any[]>('changelists') || [];
        const targetIndex = currentChangelists.findIndex(c => c.id === changelistId);
        if (targetIndex !== -1) {
          const targetCl = currentChangelists[targetIndex];
          // Move files back to default
          let defaultCl = currentChangelists.find(c => c.isDefault);
          if (!defaultCl) {
            defaultCl = { id: 'default', name: 'Default Changelist', filePaths: [], isDefault: true };
            currentChangelists.push(defaultCl);
          }
          for (const path of targetCl.filePaths) {
            if (!defaultCl.filePaths.includes(path)) {
              defaultCl.filePaths.push(path);
            }
          }

          currentChangelists.splice(targetIndex, 1);
          await context.workspaceState.update('changelists', [...currentChangelists]);
          provider.refresh();
        }
      }
      return true;
    }

    case 'applyChangelistSplits': {
      const { splits } = data;
      let defaultCl = changelists.find(c => c.isDefault);
      if (!defaultCl) {
        defaultCl = { id: 'default', name: 'Default Changelist', filePaths: [], isDefault: true };
      }
      
      defaultCl.filePaths = [];
      changelists = [defaultCl];

      for (const split of splits) {
        const id = `cl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        changelists.push({
          id,
          name: split.name,
          filePaths: split.files
        });
      }

      const status = await gitService.getStatus();
      const currentModifiedPaths = new Set(status?.files?.map(f => f.path) || []);
      const assigned = new Set<string>();
      for (const cl of changelists) {
        for (const p of cl.filePaths) {
          assigned.add(p);
        }
      }
      for (const p of currentModifiedPaths) {
        if (!assigned.has(p)) {
          defaultCl.filePaths.push(p);
        }
      }

      await context.workspaceState.update('changelists', [...changelists]);
      provider.refresh();
      return true;
    }
  }

  return false;
}
