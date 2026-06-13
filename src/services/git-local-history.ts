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
}

export class GitLocalHistoryService {
  private indexFile: string;
  public historyDir: string;
  private disposables: vscode.Disposable[] = [];

  constructor(private context: vscode.ExtensionContext) {
    this.historyDir = path.join(this.context.globalStorageUri.fsPath, 'local-history');
    this.indexFile = path.join(this.historyDir, 'history-index.json');
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

    // Check if hash matches the latest snapshot for this file
    const fileEntries = index.filter(e => e.filePath === relativePath).sort((a, b) => b.timestamp - a.timestamp);
    if (fileEntries.length > 0 && fileEntries[0].hash === currentHash) {
      // Content has not changed
      return;
    }

    // Save snapshot file
    const timestamp = Date.now();
    const fileSnapDir = path.join(this.historyDir, relativePath);
    if (!fs.existsSync(fileSnapDir)) {
      fs.mkdirSync(fileSnapDir, { recursive: true });
    }

    const snapFile = path.join(fileSnapDir, `${timestamp}.txt`);
    fs.writeFileSync(snapFile, content, 'utf8');

    // Estimate simple added/removed lines
    let addedLines = 0;
    let removedLines = 0;
    if (fileEntries.length > 0) {
      const prevSnapFile = path.join(this.historyDir, relativePath, `${fileEntries[0].timestamp}.txt`);
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
      removedLines
    });

    // Run cleanup/pruning for this file
    const maxSnapshotsPerFile = 30;
    const maxAgeDays = 14;
    const fileEntriesUpdated = index.filter(e => e.filePath === relativePath).sort((a, b) => b.timestamp - a.timestamp);
    
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
      const delPath = path.join(this.historyDir, del.filePath, `${del.timestamp}.txt`);
      if (fs.existsSync(delPath)) {
        fs.unlinkSync(delPath);
      }
    }

    // Rebuild index without deleted entries
    const otherEntries = index.filter(e => e.filePath !== relativePath);
    index = [...otherEntries, ...keepEntries];

    fs.writeFileSync(this.indexFile, JSON.stringify(index, null, 2), 'utf8');
  }

  public async search(query: string): Promise<any> {
    if (!fs.existsSync(this.indexFile)) {
      return { results: [], message: 'No local history snapshots available.' };
    }

    let index: HistoryIndexEntry[] = [];
    try {
      index = JSON.parse(fs.readFileSync(this.indexFile, 'utf8'));
    } catch {
      return { results: [], error: 'Failed to read history index.' };
    }

    if (index.length === 0) {
      return { results: [], message: 'No local history snapshots found.' };
    }

    // If query is empty, return the most recent snapshots directly
    if (!query || !query.trim()) {
      const sorted = [...index].sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);
      const results = sorted.map(entry => {
        const snapFilePath = path.join(this.historyDir, entry.filePath, `${entry.timestamp}.txt`);
        let codeBlock = '';
        if (fs.existsSync(snapFilePath)) {
          codeBlock = fs.readFileSync(snapFilePath, 'utf8');
        }
        return {
          filePath: entry.filePath,
          timestamp: entry.timestamp,
          codeBlock: codeBlock.substring(0, 1500) + (codeBlock.length > 1500 ? '\n// ... (truncated)' : ''),
          explanation: `Lines changed: +${entry.addedLines} -${entry.removedLines}`
        };
      });
      return { results, message: 'Showing recent local history snapshots.' };
    }

    // Basic query analyzer: extract keywords (alphanumeric only)
    const keywords = query.toLowerCase().match(/[a-z0-9_]{3,}/g) || [];
    
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
      return { entry, score };
    }).filter(c => c.score > 0 || keywords.length === 0)
      .sort((a, b) => b.score - a.score || b.entry.timestamp - a.entry.timestamp)
      .slice(0, 8); // take top 8 candidates

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
      // No AI config, just return basic list of candidates
      return {
        results: candidates.map(c => ({
          filePath: c.entry.filePath,
          timestamp: c.entry.timestamp,
          summary: 'AI is not configured. Showing keyword matching candidate.'
        }))
      };
    }

    // Compile candidate context
    const candidatesContext = candidates.map((c, idx) => {
      const snapFilePath = path.join(this.historyDir, c.entry.filePath, `${c.entry.timestamp}.txt`);
      let contentSample = '';
      if (fs.existsSync(snapFilePath)) {
        const fullContent = fs.readFileSync(snapFilePath, 'utf8');
        contentSample = fullContent.substring(0, 2000); // Send first 2000 chars to avoid token limit
      }
      return `[Candidate #${idx}]
File: ${c.entry.filePath}
Saved At: ${new Date(c.entry.timestamp).toLocaleString()}
Code Sample:
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
          return {
            results: [{
              filePath: match.filePath,
              timestamp: match.timestamp,
              codeBlock: parsed.codeBlock,
              explanation: parsed.explanation
            }]
          };
        } else {
          return { results: [], message: 'AI could not find a matching code block in the snapshots.' };
        }
      } else {
        throw new Error('Unexpected response format from LLM');
      }
    } catch (err: any) {
      console.error('Failed to run AI Local History Search:', err);
      // Fallback: return raw list of candidates
      return {
        results: candidates.map(c => ({
          filePath: c.entry.filePath,
          timestamp: c.entry.timestamp,
          summary: `Keyword match score: ${c.score}. AI Search failed: ${err.message}`
        }))
      };
    }
  }
}
