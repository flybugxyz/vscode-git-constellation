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
          }, signal, (chunk) => {
            webview.postMessage({ type: 'generateCommitMessageProgress', chunk });
          });

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

    case 'refineSquashMessage': {
      if (commitAbortController) {
        commitAbortController.abort();
      }
      commitAbortController = new AbortController();
      const signal = commitAbortController.signal;

      const config = vscode.workspace.getConfiguration('git-constellation.openai');
      const apiUrl = config.get<string>('apiUrl');
      const apiKey = config.get<string>('apiKey');
      const model = config.get<string>('model');

      if (!apiKey || !apiUrl) {
        const action = await vscode.window.showWarningMessage('OpenAI API Key and URL must be configured to refine commit messages.', 'Open Settings');
        if (action === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'git-constellation.openai');
        }
        webview.postMessage({ type: 'refineSquashMessageResult', error: 'Not configured' });
        return true;
      }

      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Refining squash commit message...",
          cancellable: true
        }, async (progress, token) => {
          token.onCancellationRequested(() => {
            commitAbortController?.abort();
          });

          const systemPrompt = "You are an AI assistant helping a developer write a unified commit message for a squash operation. Combine, clean up, and refine the provided commit messages into a single high-quality commit message that follows the Conventional Commits specification. Output only the refined commit message, with no extra text or explanations.";
          const result = await requestAIApi(apiUrl, apiKey, {
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Here are the commit messages to combine:\n\n${data.defaultMessage}` }
            ]
          }, signal, (chunk) => {
            webview.postMessage({ type: 'refineSquashMessageProgress', chunk });
          });

          if (signal.aborted) return;

          if (result && result.choices && result.choices[0]) {
            const message = result.choices[0].message.content.trim();
            webview.postMessage({ type: 'refineSquashMessageResult', message });
          } else {
            throw new Error("Unexpected response structure");
          }
        });
      } catch (err: any) {
        if (err.message === 'Request aborted') {
          console.log('AI generation request aborted.');
        } else {
          vscode.window.showErrorMessage(`Failed to refine commit message: ${err.message}`);
          webview.postMessage({ type: 'refineSquashMessageResult', error: err.message });
        }
      } finally {
        if (commitAbortController?.signal === signal) {
          commitAbortController = null;
        }
      }
      return true;
    }

    case 'suggestChangelistSplits': {
      if (commitAbortController) {
        commitAbortController.abort();
      }
      commitAbortController = new AbortController();
      const signal = commitAbortController.signal;

      const config = vscode.workspace.getConfiguration('git-constellation.openai');
      const apiUrl = config.get<string>('apiUrl');
      const apiKey = config.get<string>('apiKey');
      const model = config.get<string>('model');

      if (!apiKey || !apiUrl) {
        const action = await vscode.window.showWarningMessage('OpenAI API Key and URL must be configured to suggest splits.', 'Open Settings');
        if (action === 'Open Settings') {
          vscode.commands.executeCommand('workbench.action.openSettings', 'git-constellation.openai');
        }
        webview.postMessage({ type: 'suggestChangelistSplitsResult', error: 'Not configured' });
        return true;
      }

      try {
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: "Analyzing changes for SCM splits...",
          cancellable: true
        }, async (progress, token) => {
          token.onCancellationRequested(() => {
            commitAbortController?.abort();
          });

          const status = await gitService.getStatus();
          const files = status?.files?.map(f => f.path) || [];
          if (files.length === 0) {
            throw new Error("No modified files found in the repository.");
          }

          const diff = await gitService.getDiffForFiles(files);
          if (!diff.trim()) {
            throw new Error("No modified files or diff found in the repository.");
          }

          if (signal.aborted) return;

          const systemPrompt = `You are an expert software developer and architect.
Analyze the provided git diff and group the modified files into separate logical concerns (Changelists).
For example, group bug fixes together, feature additions together, logging improvements together, and configuration changes together.

You must respond ONLY with a JSON object containing the recommended groups. No other text or conversational elements.
Output format:
{
  "changelists": [
    {
      "name": "Changelist Name (e.g. 'Fix: Session Expire Bug')",
      "files": ["src/auth.ts", "src/session.ts"]
    },
    {
      "name": "Changelist Name (e.g. 'Refactor: Logging')",
      "files": ["src/logger.ts"]
    }
  ]
}`;

          const result = await requestAIApi(apiUrl, apiKey, {
            model: model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Here is the git diff:\n\n${diff}` }
            ]
          }, signal);

          if (signal.aborted) return;

          if (result && result.choices && result.choices[0]) {
            const content = result.choices[0].message.content.trim();
            try {
              // Strip code fences if the model output markdown format
              const jsonStr = content.replace(/^```json/, '').replace(/```$/, '').trim();
              const parsed = JSON.parse(jsonStr);
              if (parsed.changelists && Array.isArray(parsed.changelists)) {
                webview.postMessage({ type: 'suggestChangelistSplitsResult', changelists: parsed.changelists });
              } else {
                throw new Error("Missing changelists array in JSON response");
              }
            } catch (e: any) {
              console.error('Failed to parse AI JSON response:', content, e);
              throw new Error(`AI returned invalid JSON: ${e.message}`);
            }
          } else {
            throw new Error("Unexpected response structure");
          }
        });
      } catch (err: any) {
        if (err.message === 'Request aborted') {
          console.log('AI split request aborted.');
        } else {
          vscode.window.showErrorMessage(`Failed to analyze splits: ${err.message}`);
          webview.postMessage({ type: 'suggestChangelistSplitsResult', error: err.message });
        }
      } finally {
        if (commitAbortController?.signal === signal) {
          commitAbortController = null;
        }
      }
      return true;
    }
  }

  return false;
}
