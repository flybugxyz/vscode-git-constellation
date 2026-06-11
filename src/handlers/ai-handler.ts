import * as vscode from 'vscode';
import { GitService } from '../git';
import { IGitJBViewProvider, WebviewMessage } from './base-handler';
import { requestAIApi } from '../ai-client';

let commitAbortController: AbortController | null = null;
let stashAbortController: AbortController | null = null;

export async function handleAIMessage(
  data: WebviewMessage,
  gitService: GitService,
  webview: vscode.Webview,
  provider: IGitJBViewProvider
): Promise<boolean> {
  switch (data.type) {
    case 'generateCommitMessage': {
      // CR-003: Prevent race condition by aborting previous request
      if (commitAbortController) {
        commitAbortController.abort();
      }
      commitAbortController = new AbortController();
      const signal = commitAbortController.signal;

      const config = vscode.workspace.getConfiguration('git-constellation.openai');
      const apiUrl = config.get<string>('apiUrl');
      const apiKey = config.get<string>('apiKey');
      const model = config.get<string>('model');
      const prompt = config.get<string>('prompt');

      if (!apiKey || !apiUrl) {
        const action = await vscode.window.showWarningMessage('OpenAI API Key and URL must be configured to generate commit messages.', 'Open Settings');
        if (action === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'git-constellation.openai');
        }
        webview.postMessage({ type: 'generateCommitMessageResult', error: 'Not configured' });
        return true;
      }

      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Generating commit message...",
          cancellable: true // allow user to cancel as well
        }, async (progress, token) => {
          token.onCancellationRequested(() => {
            commitAbortController?.abort();
          });

          const diff = await gitService.getDiffForFiles(data.files);
          if (!diff.trim()) {
            throw new Error("No diff available for the selected files.");
          }

          if (signal.aborted) return;

          const result = await requestAIApi(apiUrl, apiKey, {
            model: model,
            messages: [
              { role: 'system', content: prompt },
              { role: 'user', content: `Here is the git diff:\n\n${diff}` }
            ]
          }, signal);

          if (signal.aborted) return;

          if (result && result.choices && result.choices[0]) {
            const message = result.choices[0].message.content.trim();
            webview.postMessage({ type: 'generateCommitMessageResult', message });
          } else {
            throw new Error("Unexpected response structure");
          }
        });
      } catch (err: any) {
        if (err.message === 'Request aborted') {
          console.log('AI generation request aborted.');
        } else {
          vscode.window.showErrorMessage(`Failed to generate commit message: ${err.message}`);
          webview.postMessage({ type: 'generateCommitMessageResult', error: err.message });
        }
      } finally {
        if (commitAbortController?.signal === signal) {
          commitAbortController = null;
        }
      }
      return true;
    }

    case 'generateStashMessage': {
      // CR-003: Prevent race condition by aborting previous request
      if (stashAbortController) {
        stashAbortController.abort();
      }
      stashAbortController = new AbortController();
      const signal = stashAbortController.signal;

      const config = vscode.workspace.getConfiguration('git-constellation.openai');
      const apiUrl = config.get<string>('apiUrl');
      const apiKey = config.get<string>('apiKey');
      const model = config.get<string>('model');

      if (!apiKey || !apiUrl) {
        const action = await vscode.window.showWarningMessage('OpenAI API Key and URL must be configured to generate stash descriptions.', 'Open Settings');
        if (action === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'git-constellation.openai');
        }
        webview.postMessage({ type: 'generateStashMessageResult', error: 'Not configured' });
        return true;
      }

      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Generating stash description...",
          cancellable: true
        }, async (progress, token) => {
          token.onCancellationRequested(() => {
            stashAbortController?.abort();
          });

          const files = data.files || [];
          const diff = await gitService.getDiffForFiles(files);
          if (!diff.trim()) {
            throw new Error("No diff available for the selected files.");
          }

          if (signal.aborted) return;

          const systemPrompt = "You are an AI assistant helping a developer write a concise description for a git stash. Based on the provided git diff, generate a one-line summary of the changes being stashed. Keep it under 60 characters and write only the summary. Do not prefix with 'stash' or 'WIP' as the system will label it, just summarize the main purpose of the changes.";
          const result = await requestAIApi(apiUrl, apiKey, {
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Here is the git diff:\n\n${diff}` }
            ]
          }, signal);

          if (signal.aborted) return;

          if (result && result.choices && result.choices[0]) {
            const message = result.choices[0].message.content.trim();
            webview.postMessage({ type: 'generateStashMessageResult', message });
          } else {
            throw new Error("Unexpected response structure");
          }
        });
      } catch (err: any) {
        if (err.message === 'Request aborted') {
          console.log('AI generation request aborted.');
        } else {
          vscode.window.showErrorMessage(`Failed to generate stash message: ${err.message}`);
          webview.postMessage({ type: 'generateStashMessageResult', error: err.message });
        }
      } finally {
        if (stashAbortController?.signal === signal) {
          stashAbortController = null;
        }
      }
      return true;
    }
  }

  return false;
}
