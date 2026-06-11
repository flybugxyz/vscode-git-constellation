import { GitCoreService } from './git-core';
import { validateHash, validateFilePath, validateBranchName } from '../git-validation';
import * as fs from 'fs';
import * as pathModule from 'path';

export class GitDiffService {
  constructor(private core: GitCoreService) {}

  public async getDiffForFiles(files: string[]): Promise<string> {
    const git = this.core.git;
    if (!git || files.length === 0) return '';
    try {
      files.forEach(validateFilePath);
      const statusResult = await git.status();
      const untrackedFiles = new Set<string>(statusResult.not_added);

      const trackedFiles: string[] = [];
      const untrackedList: string[] = [];
      for (const file of files) {
        if (untrackedFiles.has(file)) {
          untrackedList.push(file);
        } else {
          trackedFiles.push(file);
        }
      }

      let diff = '';
      if (trackedFiles.length > 0) {
        try {
          diff += await git.diff(['HEAD', '--', ...trackedFiles]);
        } catch {
          diff += await git.diff(['--', ...trackedFiles]);
        }
      }

      for (const file of untrackedList) {
        try {
          const fullPath = pathModule.resolve(this.core.activeRepoPath || '', file);
          if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            diff += `diff --git a/${file} b/${file}\n`;
            diff += `new file mode 100644\n`;
            diff += `--- /dev/null\n`;
            diff += `+++ b/${file}\n`;
            diff += `@@ -0,0 +1,${lines.length} @@\n`;
            diff += lines.map(line => `+${line}`).join('\n') + '\n';
          }
        } catch (err) {
          console.error(`Error reading untracked file ${file}:`, err);
        }
      }

      if (diff.length > 15000) {
        return diff.substring(0, 15000) + '\n... [Diff truncated due to length]';
      }
      return diff;
    } catch (err) {
      console.error('Error getting diff for files:', err);
      return '';
    }
  }

  public async getCommitFiles(hash: string) {
    const git = this.core.git;
    if (!git) return [];
    validateHash(hash);
    try {
      const result = await git.raw(['show', '--name-status', '--pretty=format:', hash]);
      return result.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.split(/\s+/);
        let status = parts[0];
        let path = parts[1];
        if (status.startsWith('R') && parts.length >= 3) {
          status = 'R';
          path = `${parts[1]} → ${parts[2]}`;
        }
        return { status, path };
      });
    } catch (err) {
      console.error('Error fetching commit files:', err);
      return [];
    }
  }

  public async getFileContent(hash: string, path: string) {
    const git = this.core.git;
    if (!git) return '';
    if (hash === '') return '';
    validateHash(hash);
    validateFilePath(path);
    try {
      return await git.show([`${hash}:${path}`]);
    } catch (err) {
      console.error(`Error fetching file content for ${hash}:${path}:`, err);
      return '';
    }
  }

  public async getParentHash(hash: string) {
    const git = this.core.git;
    if (!git) return undefined;
    validateHash(hash);
    try {
      const result = await git.raw(['rev-parse', `${hash}^`]);
      return result.trim();
    } catch {
      return undefined;
    }
  }

  public async getDiff(hash?: string) {
    const git = this.core.git;
    if (!git) return '';
    if (hash) {
      validateHash(hash);
    }
    try {
      if (hash) {
        return await git.show([hash]);
      } else {
        return await git.diff();
      }
    } catch (err) {
      console.error('Error fetching diff:', err);
      return '';
    }
  }

  public async getCompareFiles(hash: string) {
    const git = this.core.git;
    if (!git) return [];
    validateHash(hash);
    try {
      const result = await git.raw(['diff', '--name-status', 'HEAD', hash]);
      return result.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.split(/\s+/);
        let status = parts[0];
        let path = parts[1];
        if (status.startsWith('R') && parts.length >= 3) {
          status = 'R';
          path = `${parts[1]} → ${parts[2]}`;
        }
        return { status, path };
      });
    } catch (err) {
      console.error('Error fetching compare files:', err);
      return [];
    }
  }

  public async compareBranches(branchA: string, branchB: string) {
    const git = this.core.git;
    if (!git) return [];
    validateBranchName(branchA);
    validateBranchName(branchB);
    try {
      const result = await git.raw(['diff', '--name-status', branchA, branchB]);
      return result.trim().split('\n').filter(Boolean).map(line => {
        const parts = line.split(/\s+/);
        let status = parts[0];
        let path = parts[1];
        if (status.startsWith('R') && parts.length >= 3) {
          status = 'R';
          path = `${parts[1]} → ${parts[2]}`;
        }
        return { status, path };
      });
    } catch (err) {
      console.error('Error comparing branches:', err);
      return [];
    }
  }
}
