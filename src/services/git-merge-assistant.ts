import * as vscode from 'vscode';
import * as path from 'path';
import { GitService } from '../git';
import { requestAIApi } from '../ai-client';

interface ConflictRange {
  startLine: number; // 0-indexed
  middleLine: number;
  endLine: number;
  mineText: string;
  theirsText: string;
}

export class GitMergeAssistantService implements vscode.CodeLensProvider {
  private disposables: vscode.Disposable[] = [];

  constructor(
    private context: vscode.ExtensionContext,
    private gitService: GitService
  ) {}

  public activate() {
    this.deactivate();

    // Register CodeLens provider for all files
    this.disposables.push(
      vscode.languages.registerCodeLensProvider({ scheme: 'file' }, this)
    );

    // Register Commands
    this.disposables.push(
      vscode.commands.registerCommand('git-constellation.explainConflict', async (filePath: string, conflict: ConflictRange) => {
        await this.explainConflict(filePath, conflict);
      }),
      vscode.commands.registerCommand('git-constellation.semanticMergePreview', async (filePath: string, conflict: ConflictRange) => {
        await this.semanticMergePreview(filePath, conflict);
      }),
      vscode.commands.registerCommand('git-constellation.explainMergeEditorConflict', async () => {
        const result = await this.getConflictRangeFromActiveEditor();
        if (result) {
          await this.explainConflict(result.filePath, result.conflict);
        }
      }),
      vscode.commands.registerCommand('git-constellation.semanticMergeEditorPreview', async () => {
        const result = await this.getConflictRangeFromActiveEditor();
        if (result) {
          await this.semanticMergePreview(result.filePath, result.conflict, result.document);
        }
      })
    );
  }

  public deactivate() {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  // CodeLensProvider implementation
  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const lenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split('\n');

    let i = 0;
    while (i < lines.length) {
      if (lines[i].startsWith('<<<<<<<')) {
        const startLine = i;
        let middleLine = -1;
        let endLine = -1;

        // Find separator and end marker
        let j = i + 1;
        while (j < lines.length) {
          if (lines[j].startsWith('=======')) {
            middleLine = j;
          } else if (lines[j].startsWith('>>>>>>>')) {
            endLine = j;
            break;
          }
          j++;
        }

        if (middleLine !== -1 && endLine !== -1) {
          const range = new vscode.Range(startLine, 0, startLine, 10);
          const mineText = lines.slice(startLine + 1, middleLine).join('\n');
          const theirsText = lines.slice(middleLine + 1, endLine).join('\n');

          const conflictRange: ConflictRange = {
            startLine,
            middleLine,
            endLine,
            mineText,
            theirsText
          };

          lenses.push(
            new vscode.CodeLens(range, {
              title: '$(sparkle) Explain Conflict with AI',
              command: 'git-constellation.explainConflict',
              arguments: [document.uri.fsPath, conflictRange]
            }),
            new vscode.CodeLens(range, {
              title: '$(git-merge) Semantic Merge Preview',
              command: 'git-constellation.semanticMergePreview',
              arguments: [document.uri.fsPath, conflictRange]
            })
          );

          i = endLine; // skip past this conflict
        }
      }
      i++;
    }

    return lenses;
  }

  private async getBaseVersionContent(filePath: string): Promise<string> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) return '';
    const relativePath = path.relative(workspaceRoot, filePath).replace(/\\/g, '/');
    
    // Call git show :1:relativePath
    const git = this.gitService.git; // Access internal simple-git
    if (!git) return '';
    try {
      return await git.show([`:1:${relativePath}`]);
    } catch {
      return '';
    }
  }

  private async explainConflict(filePath: string, conflict: ConflictRange) {
    const config = vscode.workspace.getConfiguration('git-constellation.openai');
    const apiUrl = config.get<string>('apiUrl');
    const apiKey = config.get<string>('apiKey');
    const model = config.get<string>('model');
    const language = config.get<string>('language', 'en');

    if (!apiKey || !apiUrl) {
      const warningMsg = language === 'zh-CN'
        ? '必须配置 OpenAI API Key 和 API URL 才能解释冲突。'
        : 'OpenAI API Key and URL must be configured to explain conflicts.';
      const actionText = language === 'zh-CN' ? '打开设置' : 'Open Settings';
      vscode.window.showWarningMessage(warningMsg, actionText)
        .then(action => {
          if (action === actionText) {
            vscode.commands.executeCommand('workbench.action.openSettings', 'git-constellation.openai');
          }
        });
      return;
    }

    const progressTitle = language === 'zh-CN' ? 'AI 正在分析冲突...' : 'AI is analyzing conflict...';

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: progressTitle,
      cancellable: false
    }, async () => {
      try {
        const baseContent = await this.getBaseVersionContent(filePath);
        
        let systemPrompt = `You are a Git Merge Conflict Specialist.
Analyze the conflict block and explain the semantic changes on both sides (Mine vs Theirs), and recommend a resolution.
Keep your explanation clear, professional, and highlight any potential regression risk.`;

        if (language === 'zh-CN') {
          systemPrompt += `\nOutput your response in Chinese (简体中文).`;
        }

        const userPrompt = language === 'zh-CN'
          ? `文件: ${path.basename(filePath)}
公共祖先 (Base) 内容 (可选):
${baseContent ? baseContent.substring(0, 1500) : '不可用'}

Mine (Ours) 版本:
${conflict.mineText}

Theirs (Ours/Remote) 版本:
${conflict.theirsText}

请解释差异并推荐合并解决方案。`
          : `File: ${path.basename(filePath)}
Common Ancestor (Base) Content (Optional):
${baseContent ? baseContent.substring(0, 1500) : 'Not available'}

Mine (Ours) version:
${conflict.mineText}

Theirs (Ours/Remote) version:
${conflict.theirsText}

Please explain the differences and recommend a merge resolution.`;

        const result = await requestAIApi(apiUrl, apiKey, {
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        });

        if (result && result.choices && result.choices[0]) {
          const explanation = result.choices[0].message.content;
          
          const panelTitle = language === 'zh-CN'
            ? `AI 冲突分析: ${path.basename(filePath)}`
            : `AI Conflict Explanation: ${path.basename(filePath)}`;
          const panelHeader = language === 'zh-CN'
            ? `✨ AI 冲突分析: ${path.basename(filePath)}`
            : `✨ AI Conflict Analysis: ${path.basename(filePath)}`;

          // Open a Webview Panel to show explanation
          const panel = vscode.window.createWebviewPanel(
            'git-constellation-conflict',
            panelTitle,
            vscode.ViewColumn.Two,
            { enableScripts: true }
          );

          panel.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>${panelTitle}</title>
              <style>
                body {
                  font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
                  color: var(--vscode-editor-foreground, #abb2bf);
                  background: var(--vscode-editor-background, #282c34);
                  padding: 20px;
                  line-height: 1.6;
                  font-size: 13px;
                }
                h3 {
                  color: var(--vscode-textLink-foreground, #61afef);
                  border-bottom: 1px solid var(--vscode-panel-border);
                  padding-bottom: 6px;
                }
                pre {
                  background: var(--vscode-textBlockQuote-background, #3e4451);
                  padding: 10px;
                  border-radius: 4px;
                  overflow-x: auto;
                  font-family: var(--vscode-editor-font-family, monospace);
                }
                .highlight {
                  background: rgba(97, 175, 239, 0.15);
                  padding: 2px 4px;
                  border-radius: 3px;
                }
                .markdown {
                  white-space: pre-wrap;
                }
              </style>
            </head>
            <body>
              <h3>${panelHeader}</h3>
              <div class="markdown">${explanation}</div>
            </body>
            </html>
          `;
        } else {
          throw new Error('Invalid response structure');
        }
      } catch (err: any) {
        const errorPrefix = language === 'zh-CN' ? '解释冲突失败' : 'Failed to explain conflict';
        vscode.window.showErrorMessage(`${errorPrefix}: ${err.message}`);
      }
    });
  }

  private async semanticMergePreview(filePath: string, conflict: ConflictRange, targetDoc?: vscode.TextDocument) {
    const config = vscode.workspace.getConfiguration('git-constellation.openai');
    const apiUrl = config.get<string>('apiUrl');
    const apiKey = config.get<string>('apiKey');
    const model = config.get<string>('model');
    const language = config.get<string>('language', 'en');

    if (!apiKey || !apiUrl) {
      const warningMsg = language === 'zh-CN'
        ? '必须配置 OpenAI API Key 和 API URL 才能进行语义合并。'
        : 'OpenAI API Key and URL must be configured for semantic merge.';
      const actionText = language === 'zh-CN' ? '打开设置' : 'Open Settings';
      vscode.window.showWarningMessage(warningMsg, actionText)
        .then(action => {
          if (action === actionText) {
            vscode.commands.executeCommand('workbench.action.openSettings', 'git-constellation.openai');
          }
        });
      return;
    }

    let targetEditor = vscode.window.visibleTextEditors.find(
      e => e.document.uri.scheme === 'file' && e.document.uri.fsPath === filePath
    );

    if (!targetEditor && targetDoc) {
      targetEditor = await vscode.window.showTextDocument(targetDoc);
    }

    if (!targetEditor) {
      const errorMsg = language === 'zh-CN'
        ? '冲突文件不再处于可见状态。'
        : 'Conflict document is no longer visible.';
      vscode.window.showErrorMessage(errorMsg);
      return;
    }

    const progressTitle = language === 'zh-CN'
      ? 'AI 正在生成语义合并解决方案...'
      : 'AI is generating semantic merge resolution...';

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: progressTitle,
      cancellable: false
    }, async () => {
      try {
        const baseContent = await this.getBaseVersionContent(filePath);

        let systemPrompt = `You are a programming merge engine.
Resolve the merge conflict semantically by combining Left (Mine) and Right (Theirs) edits relative to the Base version (Common Ancestor).
Output ONLY the merged code block. Do NOT include markdown code fences, comments, or conversational text. Output the raw merged code.`;

        if (language === 'zh-CN') {
          systemPrompt += `\nIf you write or preserve comments in the code, make sure they are written in Chinese (简体中文).`;
        }

        const userPrompt = language === 'zh-CN'
          ? `公共祖先 (Base) 内容 (可选):
${baseContent ? baseContent.substring(0, 1500) : '不可用'}

Mine (Ours) 版本:
${conflict.mineText}

Theirs (Remote/Theirs) 版本:
${conflict.theirsText}`
          : `Common Ancestor (Base) Content (Optional):
${baseContent ? baseContent.substring(0, 1500) : 'Not available'}

Mine (Ours) version:
${conflict.mineText}

Theirs (Remote/Theirs) version:
${conflict.theirsText}`;

        const result = await requestAIApi(apiUrl, apiKey, {
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        });

        if (result && result.choices && result.choices[0]) {
          const resolvedCode = result.choices[0].message.content.trim();
          
          // Show prompt to apply
          const promptText = language === 'zh-CN'
            ? 'AI 成功解决冲突。预览合并后的代码块：\n\n' + resolvedCode.substring(0, 300) + (resolvedCode.length > 300 ? '...' : '')
            : 'AI resolved conflict successfully. Preview resolved block:\n\n' + resolvedCode.substring(0, 300) + (resolvedCode.length > 300 ? '...' : '');
          const applyButtonText = language === 'zh-CN' ? '应用 AI 解决方案' : 'Apply AI Resolution';

          const selection = await vscode.window.showInformationMessage(
            promptText,
            { modal: true },
            applyButtonText
          );

          if (selection === applyButtonText) {
            // Apply edit to target editor
            const editSuccess = await targetEditor.edit(editBuilder => {
              const range = new vscode.Range(
                conflict.startLine,
                0,
                conflict.endLine,
                targetEditor.document.lineAt(conflict.endLine).text.length
              );
              editBuilder.replace(range, resolvedCode);
            });

            if (editSuccess) {
              const successMsg = language === 'zh-CN'
                ? '成功应用 AI 合并解决方案。'
                : 'Successfully applied AI merge resolution.';
              vscode.window.showInformationMessage(successMsg);
            } else {
              const errorMsg = language === 'zh-CN'
                ? '无法将修改应用到目标编辑器。'
                : 'Failed to apply edit to the target editor.';
              vscode.window.showErrorMessage(errorMsg);
            }
          }
        } else {
          throw new Error('Invalid response structure');
        }
      } catch (err: any) {
        const errorPrefix = language === 'zh-CN' ? '无法合并冲突' : 'Failed to merge conflict';
        vscode.window.showErrorMessage(`${errorPrefix}: ${err.message}`);
      }
    });
  }

  private async getConflictRangeFromActiveEditor(): Promise<{ filePath: string; conflict: ConflictRange; document: vscode.TextDocument } | null> {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      vscode.window.showErrorMessage('No active editor found.');
      return null;
    }

    const filePath = activeEditor.document.uri.fsPath;
    if (!filePath) {
      vscode.window.showErrorMessage('Active document has no file path.');
      return null;
    }

    try {
      // Always load the actual file on disk (using file scheme) to read conflict markers
      const fileUri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(fileUri);
      const text = document.getText();
      const lines = text.split('\n');
      
      let cursorLine = -1;
      if (activeEditor.document.uri.fsPath === filePath) {
        cursorLine = activeEditor.selection.active.line;
      }

      const conflicts: ConflictRange[] = [];

      let i = 0;
      while (i < lines.length) {
        if (lines[i].startsWith('<<<<<<<')) {
          const startLine = i;
          let middleLine = -1;
          let endLine = -1;

          let j = i + 1;
          while (j < lines.length) {
            if (lines[j].startsWith('=======')) {
              middleLine = j;
            } else if (lines[j].startsWith('>>>>>>>')) {
              endLine = j;
              break;
            }
            j++;
          }

          if (middleLine !== -1 && endLine !== -1) {
            const mineText = lines.slice(startLine + 1, middleLine).join('\n');
            const theirsText = lines.slice(middleLine + 1, endLine).join('\n');
            conflicts.push({
              startLine,
              middleLine,
              endLine,
              mineText,
              theirsText
            });
            i = endLine;
          }
        }
        i++;
      }

      if (conflicts.length === 0) {
        vscode.window.showInformationMessage('No active merge conflict markers found in this document.');
        return null;
      }

      // 1. Check if the cursor is inside any conflict block
      let selectedConflict = conflicts[0];
      if (cursorLine !== -1) {
        const conflictUnderCursor = conflicts.find(
          c => cursorLine >= c.startLine && cursorLine <= c.endLine
        );
        if (conflictUnderCursor) {
          selectedConflict = conflictUnderCursor;
        }
      }

      return {
        filePath,
        conflict: selectedConflict,
        document
      };
    } catch (e: any) {
      vscode.window.showErrorMessage(`Failed to parse conflict file: ${e.message}`);
      return null;
    }
  }
}
