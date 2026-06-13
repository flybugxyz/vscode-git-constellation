import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { requestAIApi } from '../ai-client';

interface HistoryIndexEntry {
  timestamp: number;
  filePath: string; // relative path
  hash: string;
  addedLines: number;
  removedLines: number;
  workspacePath?: string;
}

export class GitLocalHistoryService {
  private indexFile: string;
  public historyDir: string;
  private disposables: vscode.Disposable[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.historyDir = path.join(this.context.globalStorageUri.fsPath, 'local-history');
    this.indexFile = path.join(this.historyDir, 'history-index.json');
  }

  private getSnapshotPath(entry: HistoryIndexEntry): string {
    if (entry.workspacePath) {
      const workspaceHash = crypto.createHash('md5').update(entry.workspacePath).digest('hex');
      return path.join(this.historyDir, workspaceHash, entry.filePath, `${entry.timestamp}.txt`);
    }
    // Legacy path fallback
    return path.join(this.historyDir, entry.filePath, `${entry.timestamp}.txt`);
  }

  private isEntryInActiveWorkspace(entry: HistoryIndexEntry, activeRepoPath?: string): boolean {
    if (entry.workspacePath) {
      const entryWorkspace = path.normalize(entry.workspacePath).replace(/\\/g, '/');
      if (activeRepoPath) {
        const activeRepo = path.normalize(activeRepoPath).replace(/\\/g, '/');
        if (entryWorkspace === activeRepo || entryWorkspace.startsWith(activeRepo + '/') || activeRepo.startsWith(entryWorkspace + '/')) {
          return true;
        }
        return false;
      }
      
      const workspaceFolders = vscode.workspace.workspaceFolders || [];
      return workspaceFolders.some(folder => {
        const folderPath = path.normalize(folder.uri.fsPath).replace(/\\/g, '/');
        return entryWorkspace === folderPath;
      });
    }

    // Legacy entry fallback: default to true if only one workspace folder is open
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    if (workspaceFolders.length === 1) {
      return true;
    }
    if (activeRepoPath) {
      const absolutePath = path.join(activeRepoPath, entry.filePath);
      if (fs.existsSync(absolutePath)) {
        return true;
      }
    }
    return false;
  }

  public getSnapshotPathForFile(filePath: string, timestamp: number): string | undefined {
    let index: HistoryIndexEntry[] = [];
    if (fs.existsSync(this.indexFile)) {
      try {
        index = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
      } catch {
        index = [];
      }
    }
    const entry = index.find(e => e.filePath === filePath && e.timestamp === timestamp);
    if (entry) {
      return this.getSnapshotPath(entry);
    }
    return path.join(this.historyDir, filePath, `${timestamp}.txt`);
  }

  public activate() {
    this.deactivate(); // clear existing listeners
    
    const config = vscode.workspace.getConfiguration('git-constellation.localHistory');
    const enabled = config.get<boolean>('enabled', false);

    if (!enabled) {
      console.log('GitConstellation: Local History is disabled.');
      return;
    }

    console.log('GitConstellation: Local History is enabled. Initializing save listener...');

    // Ensure storage directories exist
    if (!fs.existsSync(this.historyDir)) {
      fs.mkdirSync(this.historyDir, { recursive: true });
    }

    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(async (doc) => {
        try {
          await this.saveSnapshot(doc);
        } catch (err) {
          console.error('Failed to save Local History snapshot:', err);
        }
      })
    );
  }

  public deactivate() {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }

  private async saveSnapshot(doc: vscode.TextDocument) {
    // Basic checks
    if (doc.uri.scheme !== 'file') return;
    
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(doc.uri);
    if (!workspaceFolder) return;

    const filePath = doc.uri.fsPath;
    
    // Ignore files in node_modules, .git, etc.
    const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath).replace(/\\/g, '/');
    if (relativePath.includes('node_modules/') || relativePath.includes('.git/') || relativePath.includes('dist/')) {
      return;
    }

    // Ignore large files (> 500KB)
    const stats = fs.statSync(filePath);
    if (stats.size > 500 * 1024) return;

    const content = doc.getText();
    const currentHash = crypto.createHash('sha256').update(content).digest('hex');

    // Read index
    let index: HistoryIndexEntry[] = [];
    if (fs.existsSync(this.indexFile)) {
      try {
        index = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
      } catch (e) {
        index = [];
      }
    }

    const workspacePath = workspaceFolder.uri.fsPath;

    // Check if hash matches the latest snapshot for this file
    const fileEntries = index
      .filter(e => e.filePath === relativePath && e.workspacePath === workspacePath)
      .sort((a, b) => b.timestamp - a.timestamp);
    if (fileEntries.length > 0 && fileEntries[0].hash === currentHash) {
      // Content has not changed
      return;
    }

    // Save snapshot file
    const timestamp = Date.now();
    const workspaceHash = crypto.createHash('md5').update(workspacePath).digest('hex');
    const fileSnapDir = path.join(this.historyDir, workspaceHash, relativePath);
    if (!fs.existsSync(fileSnapDir)) {
      fs.mkdirSync(fileSnapDir, { recursive: true });
    }

    const snapFile = path.join(fileSnapDir, `${timestamp}.txt`);
    fs.writeFileSync(snapFile, content, 'utf8');

    // Estimate simple added/removed lines
    let addedLines = 0;
    let removedLines = 0;
    if (fileEntries.length > 0) {
      const prevSnapFile = this.getSnapshotPath(fileEntries[0]);
      if (fs.existsSync(prevSnapFile)) {
        const prevContent = fs.readFileSync(prevSnapFile, 'utf8');
        const prevLines = prevContent.split('\n');
        const currLines = content.split('\n');
        addedLines = Math.max(0, currLines.length - prevLines.length); // mock diff size estimation
      }
    }

    // Append to index
    index.push({
      timestamp,
      filePath: relativePath,
      hash: currentHash,
      addedLines,
      removedLines,
      workspacePath
    });

    // Run cleanup/pruning for this file
    const maxSnapshotsPerFile = 30;
    const maxAgeDays = 14;
    const fileEntriesUpdated = index
      .filter(e => e.filePath === relativePath && e.workspacePath === workspacePath)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    const keepEntries: HistoryIndexEntry[] = [];
    const deleteEntries: HistoryIndexEntry[] = [];

    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

    fileEntriesUpdated.forEach((entry, idx) => {
      const isExpired = now - entry.timestamp > maxAgeMs;
      const isOverLimit = idx >= maxSnapshotsPerFile;
      if (isExpired || isOverLimit) {
        deleteEntries.push(entry);
      } else {
        keepEntries.push(entry);
      }
    });

    // Delete physically
    for (const del of deleteEntries) {
      const delPath = this.getSnapshotPath(del);
      if (fs.existsSync(delPath)) {
        fs.unlinkSync(delPath);
      }
    }

    // Rebuild index without deleted entries
    const otherEntries = index.filter(e => !(e.filePath === relativePath && e.workspacePath === workspacePath));
    index = [...otherEntries, ...keepEntries];

    fs.writeFileSync(this.indexFile, JSON.stringify(index, null, 2), 'utf8');
  }

  public async search(query: string, activeRepoPath?: string): Promise<any> {
    if (!fs.existsSync(this.indexFile)) {
      return { results: [], message: 'No local history snapshots available.' };
    }

    let index: HistoryIndexEntry[] = [];
    try {
      index = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
    } catch {
      return { results: [], error: 'Failed to read history index.' };
    }

    // Filter index to only keep entries in active workspace/repository
    index = index.filter(entry => this.isEntryInActiveWorkspace(entry, activeRepoPath));

    if (index.length === 0) {
      return { results: [], message: 'No local history snapshots found.' };
    }

    // If query is empty, return the most recent snapshots directly
    if (!query || !query.trim()) {
      const sorted = [...index].sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);
      const results = sorted.map(entry => {
        const snapFilePath = this.getSnapshotPath(entry);
        let codeBlock = '';
        if (fs.existsSync(snapFilePath)) {
          const currContent = fs.readFileSync(snapFilePath, 'utf8');
          const prevContent = this.getPrevContent(index, entry);
          codeBlock = this.getDiffLines(prevContent, currContent);
        }
        return {
          filePath: entry.filePath,
          timestamp: entry.timestamp,
          codeBlock,
          explanation: `Lines changed: +${entry.addedLines} -${entry.removedLines}`
        };
      });
      return { results, message: 'Showing recent local history snapshots.' };
    }

    // Basic query analyzer: extract keywords (alphanumeric and Chinese characters)
    const keywords = query.toLowerCase().match(/[a-z0-9_]{3,}|[\u4e00-\u9fa5]+/gi) || [];
    
    // Step 1: Filter entries by keyword match (crude scoring)
    const candidates = index.map(entry => {
      let score = 0;
      const fileLower = entry.filePath.toLowerCase();
      // Match keywords in path
      keywords.forEach(kw => {
        if (fileLower.includes(kw)) {
          score += 10;
        }
      });

      // Also match keywords in snapshot code content
      const snapFilePath = this.getSnapshotPath(entry);
      if (fs.existsSync(snapFilePath)) {
        try {
          const content = fs.readFileSync(snapFilePath, 'utf8').toLowerCase();
          keywords.forEach(kw => {
            if (content.includes(kw)) {
              score += 5; // Content match gets +5 points
            }
          });
        } catch (e) {
          // ignore read errors
        }
      }

      return { entry, score };
    }).filter(c => c.score > 0 || keywords.length === 0)
      .sort((a, b) => b.score - a.score || b.entry.timestamp - a.entry.timestamp)
      .slice(0, 15); // take top 15 candidates to allow AI to see a wider history window

    if (candidates.length === 0) {
      // If keyword matching has no candidates, fall back to recent snapshots
      const sorted = [...index].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
      candidates.push(...sorted.map(entry => ({ entry, score: 0 })));
    }

    // Step 2: Rerank / Extract with AI
    const config = vscode.workspace.getConfiguration('git-constellation.openai');
    const apiUrl = config.get<string>('apiUrl');
    const apiKey = config.get<string>('apiKey');
    const model = config.get<string>('model');

    if (!apiKey || !apiUrl) {
      // No AI config, just return basic list of candidates with diffs
      return {
        results: candidates.map(c => {
          const snapFilePath = this.getSnapshotPath(c.entry);
          let diffBlock = '';
          if (fs.existsSync(snapFilePath)) {
            const currContent = fs.readFileSync(snapFilePath, 'utf8');
            const prevContent = this.getPrevContent(index, c.entry);
            diffBlock = this.getDiffLines(prevContent, currContent);
          }
          return {
            filePath: c.entry.filePath,
            timestamp: c.entry.timestamp,
            codeBlock: diffBlock,
            explanation: 'AI is not configured. Showing keyword matching candidate.'
          };
        })
      };
    }

    // Compile candidate context
    const candidatesContext = candidates.map((c, idx) => {
      const snapFilePath = this.getSnapshotPath(c.entry);
      let contentSample = '';
      if (fs.existsSync(snapFilePath)) {
        const currContent = fs.readFileSync(snapFilePath, 'utf8');
        const prevContent = this.getPrevContent(index, c.entry);
        contentSample = this.getDiffLines(prevContent, currContent);
        if (contentSample.length > 3000) {
          contentSample = contentSample.substring(0, 3000) + '\n// ... (truncated)';
        }
      }
      return `[Candidate #${idx}]
File: ${c.entry.filePath}
Saved At: ${new Date(c.entry.timestamp).toLocaleString()}
Changes:
${contentSample}
------------------------------------`;
    }).join('\n\n');

    const systemPrompt = `You are a helpful programming assistant.
The user wants to find a specific code block in their local history search.
You are given a list of candidate file snapshots from their local history.
Compare the user's natural language query with the contents of the candidates, identify the best match, and retrieve the exact code or explanation.

Respond in structured JSON format:
{
  "found": true/false,
  "matchIndex": number (index of matching candidate, -1 if none),
  "codeBlock": "the extracted block of code or function found",
  "explanation": "short explanation of what was found, when it was saved, and why it matches"
}`;

    try {
      const result = await requestAIApi(apiUrl, apiKey, {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `User Query: "${query}"\n\nHere are the history candidates:\n\n${candidatesContext}` }
        ]
      });

      if (result && result.choices && result.choices[0]) {
        const responseText = result.choices[0].message.content.trim();
        const jsonStr = responseText.replace(/^```json/, '').replace(/```$/, '').trim();
        const parsed = JSON.parse(jsonStr);

        if (parsed.found && parsed.matchIndex !== undefined && parsed.matchIndex >= 0) {
          const match = candidates[parsed.matchIndex].entry;
          const snapFilePath = this.getSnapshotPath(match);
          let diffBlock = '';
          if (fs.existsSync(snapFilePath)) {
            const currContent = fs.readFileSync(snapFilePath, 'utf8');
            const prevContent = this.getPrevContent(index, match);
            diffBlock = this.getDiffLines(prevContent, currContent);
          }
          return {
            results: [{
              filePath: match.filePath,
              timestamp: match.timestamp,
              codeBlock: diffBlock || parsed.codeBlock,
              explanation: parsed.explanation
            }]
          };
        } else {
          // Fallback: return raw list of candidates with diffs
          const results = candidates.map(c => {
            const snapFilePath = this.getSnapshotPath(c.entry);
            let diffBlock = '';
            if (fs.existsSync(snapFilePath)) {
              const currContent = fs.readFileSync(snapFilePath, 'utf8');
              const prevContent = this.getPrevContent(index, c.entry);
              diffBlock = this.getDiffLines(prevContent, currContent);
            }
            return {
              filePath: c.entry.filePath,
              timestamp: c.entry.timestamp,
              codeBlock: diffBlock,
              explanation: 'AI did not find a precise match. Showing keyword match candidate.'
            };
          });
          return { results, message: 'AI did not find a precise match. Showing keyword match candidates instead.' };
        }
      } else {
        throw new Error('Unexpected response format from LLM');
      }
    } catch (err: any) {
      console.error('Failed to run AI Local History Search:', err);
      // Fallback: return raw list of candidates with diffs
      return {
        results: candidates.map(c => {
          const snapFilePath = this.getSnapshotPath(c.entry);
          let diffBlock = '';
          if (fs.existsSync(snapFilePath)) {
            const currContent = fs.readFileSync(snapFilePath, 'utf8');
            const prevContent = this.getPrevContent(index, c.entry);
            diffBlock = this.getDiffLines(prevContent, currContent);
          }
          return {
            filePath: c.entry.filePath,
            timestamp: c.entry.timestamp,
            codeBlock: diffBlock,
            explanation: `Keyword match score: ${c.score}. AI Search failed: ${err.message}`
          };
        })
      };
    }
  }

  private getPrevContent(index: HistoryIndexEntry[], entry: HistoryIndexEntry): string {
    const fileEntries = index
      .filter(e => e.filePath === entry.filePath && e.workspacePath === entry.workspacePath && e.timestamp < entry.timestamp)
      .sort((a, b) => b.timestamp - a.timestamp);
    if (fileEntries.length > 0) {
      const prevSnapFile = this.getSnapshotPath(fileEntries[0]);
      if (fs.existsSync(prevSnapFile)) {
        return fs.readFileSync(prevSnapFile, 'utf8');
      }
    }
    return '';
  }

  private getDiffLines(prevContent: string, currContent: string): string {
    const prevLines = prevContent ? prevContent.split('\n') : [];
    const currLines = currContent ? currContent.split('\n') : [];
    
    let start = 0;
    while (start < prevLines.length && start < currLines.length && prevLines[start] === currLines[start]) {
      start++;
    }
    
    let endPrev = prevLines.length - 1;
    let endCurr = currLines.length - 1;
    while (endPrev >= start && endCurr >= start && prevLines[endPrev] === currLines[endCurr]) {
      endPrev--;
      endCurr--;
    }
    
    const middlePrev = prevLines.slice(start, endPrev + 1);
    const middleCurr = currLines.slice(start, endCurr + 1);
    
    if (middlePrev.length === 0 && middleCurr.length === 0) {
      return '// No changes';
    }
    
    const dp: number[][] = Array(middlePrev.length + 1).fill(0).map(() => Array(middleCurr.length + 1).fill(0));
    for (let i = 1; i <= middlePrev.length; i++) {
      for (let j = 1; j <= middleCurr.length; j++) {
        if (middlePrev[i - 1] === middleCurr[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1;
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
      }
    }
    
    const diffMiddle: string[] = [];
    let i = middlePrev.length;
    let j = middleCurr.length;
    
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && middlePrev[i - 1] === middleCurr[j - 1]) {
        diffMiddle.unshift('  ' + middlePrev[i - 1]);
        i--;
        j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        diffMiddle.unshift('+ ' + middleCurr[j - 1]);
        j--;
      } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
        diffMiddle.unshift('- ' + middlePrev[i - 1]);
        i--;
      }
    }
    
    const contextSize = 3;
    const result: string[] = [];
    
    if (start > 0) {
      result.push('@@ ... @@');
      const startContext = prevLines.slice(Math.max(0, start - contextSize), start).map(l => '  ' + l);
      result.push(...startContext);
    }
    
    result.push(...diffMiddle);
    
    if (endPrev < prevLines.length - 1) {
      const endContext = prevLines.slice(endPrev + 1, Math.min(prevLines.length, endPrev + 1 + contextSize)).map(l => '  ' + l);
      result.push(...endContext);
      result.push('@@ ... @@');
    }
    
    return result.join('\n');
  }
}
