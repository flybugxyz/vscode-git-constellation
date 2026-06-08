import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateBranchName, validateHash, validateFilePath, GitService } from '../git';
import * as fs from 'fs';

// Mock vscode module
vi.mock('vscode', () => {
  return {
    workspace: {
      workspaceFolders: [
        {
          uri: {
            fsPath: '/mock/workspace/root'
          }
        }
      ]
    },
    window: {
      showErrorMessage: vi.fn(),
      showInformationMessage: vi.fn()
    }
  };
});

// Mock simple-git module
const mockSimpleGitInstance = {
  remote: vi.fn(),
  status: vi.fn(),
  diff: vi.fn(),
  raw: vi.fn(),
  branch: vi.fn(),
  revparse: vi.fn(),
  checkout: vi.fn(),
  reset: vi.fn(),
  clean: vi.fn(),
  fetch: vi.fn()
};

vi.mock('simple-git', () => {
  return {
    simpleGit: vi.fn(() => mockSimpleGitInstance)
  };
});

// Mock fs module
vi.mock('fs', async (importOriginal) => {
  const original = await importOriginal<typeof import('fs')>();
  return {
    ...original,
    existsSync: vi.fn(),
    statSync: vi.fn(),
    readFileSync: vi.fn()
  };
});

describe('GitService Input Validation', () => {
  describe('validateBranchName', () => {
    it('should allow valid branch and ref names', () => {
      expect(() => validateBranchName('main')).not.toThrow();
      expect(() => validateBranchName('feature/add-tests')).not.toThrow();
      expect(() => validateBranchName('bugfix_123')).not.toThrow();
      expect(() => validateBranchName('remotes/origin/main')).not.toThrow();
      expect(() => validateBranchName('HEAD')).not.toThrow();
    });

    it('should throw on invalid branch names containing spaces, flags, or shell characters', () => {
      expect(() => validateBranchName('main branch')).toThrow();
      expect(() => validateBranchName('--upload-pack=malicious')).toThrow();
      expect(() => validateBranchName('-f')).toThrow();
      expect(() => validateBranchName('feature;rm -rf')).toThrow();
    });
  });

  describe('validateHash', () => {
    it('should allow valid commit hashes', () => {
      expect(() => validateHash('1a2b3c4d')).not.toThrow();
      expect(() => validateHash('abcde12345')).not.toThrow();
      expect(() => validateHash('a0f03948e9c8b7a6e5d4c3b2a190')).not.toThrow();
    });

    it('should throw on invalid commit hashes', () => {
      expect(() => validateHash('')).toThrow();
      expect(() => validateHash('notahash')).toThrow();
      expect(() => validateHash('1234;rm')).toThrow();
      expect(() => validateHash('--foo')).toThrow();
    });
  });

  describe('validateFilePath', () => {
    it('should allow valid file paths', () => {
      expect(() => validateFilePath('src/git.ts')).not.toThrow();
      expect(() => validateFilePath('README.md')).not.toThrow();
      expect(() => validateFilePath('package.json')).not.toThrow();
    });

    it('should throw on file paths starting with dashes (flag injection prevention)', () => {
      expect(() => validateFilePath('--staged')).toThrow();
      expect(() => validateFilePath('-rf')).toThrow();
    });
  });
});

describe('GitService URL Parsing and Git Commands', () => {
  let gitService: GitService;

  beforeEach(() => {
    vi.clearAllMocks();
    // Spy and suppress console logs/errors during tests to keep output clean
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Instantiate GitService
    gitService = new GitService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getHttpRemoteUrl', () => {
    it('should correctly parse SSH remote URLs to HTTPS', async () => {
      mockSimpleGitInstance.remote.mockResolvedValue('git@github.com:flybugxyz/vscode-git-constellation.git\n');
      
      const commitUrl = await gitService.getCommitUrl('1a2b3c4d');
      expect(commitUrl).toBe('https://github.com/flybugxyz/vscode-git-constellation/commit/1a2b3c4d');
    });

    it('should correctly parse HTTPS remote URLs', async () => {
      mockSimpleGitInstance.remote.mockResolvedValue('https://github.com/flybugxyz/vscode-git-constellation.git');
      
      const branchUrl = await gitService.getBranchUrl('feature/refactor');
      expect(branchUrl).toBe('https://github.com/flybugxyz/vscode-git-constellation/tree/feature/refactor');
    });

    it('should correctly format GitLab URLs', async () => {
      mockSimpleGitInstance.remote.mockResolvedValue('git@gitlab.com:user/project.git');
      
      const tagUrl = await gitService.getTagUrl('v1.0.0');
      expect(tagUrl).toBe('https://gitlab.com/user/project/-/tags/v1.0.0');
    });
  });

  describe('Status renamed path parsing', () => {
    it('should parse renamed files status in getCommitFiles', async () => {
      mockSimpleGitInstance.raw.mockResolvedValue('R100\told-file.ts\tnew-file.ts\nM\tother-file.ts');
      
      const files = await gitService.getCommitFiles('abcde12');
      expect(files).toEqual([
        { status: 'R', path: 'old-file.ts → new-file.ts' },
        { status: 'M', path: 'other-file.ts' }
      ]);
    });

    it('should parse renamed files status in compareBranches', async () => {
      mockSimpleGitInstance.raw.mockResolvedValue('R098\tsrc/old.ts\tsrc/new.ts');
      
      const files = await gitService.compareBranches('branchA', 'branchB');
      expect(files).toEqual([
        { status: 'R', path: 'src/old.ts → src/new.ts' }
      ]);
    });
  });

  describe('getDiffForFiles without index mutation', () => {
    it('should generate inline diffs for untracked files and call git diff for tracked files', async () => {
      // Mock status to return one tracked modified file and one untracked file
      mockSimpleGitInstance.status.mockResolvedValue({
        not_added: ['untracked.txt']
      } as any);

      mockSimpleGitInstance.diff.mockResolvedValue('--- a/tracked.txt\n+++ b/tracked.txt\n@@ -1 +1 @@\n-old\n+new\n');

      // Mock fs read file for the untracked file
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({ isFile: () => true } as any);
      vi.mocked(fs.readFileSync).mockReturnValue('hello world');

      const diff = await gitService.getDiffForFiles(['tracked.txt', 'untracked.txt']);
      
      expect(mockSimpleGitInstance.diff).toHaveBeenCalledWith(['HEAD', '--', 'tracked.txt']);
      expect(diff).toContain('tracked.txt');
      expect(diff).toContain('diff --git a/untracked.txt b/untracked.txt');
      expect(diff).toContain('+hello world');
    });
  });

  describe('rewordCommit', () => {
    it('should reject when working tree is dirty', async () => {
      mockSimpleGitInstance.status.mockResolvedValue({
        files: [{ index: 'M', working_dir: ' ' }]
      } as any);

      const success = await gitService.rewordCommit('abc123de', 'New message');
      expect(success).toBe(false);
    });

    it('should reword HEAD commit successfully', async () => {
      mockSimpleGitInstance.status.mockResolvedValue({ files: [] } as any);
      mockSimpleGitInstance.branch.mockResolvedValue({ current: 'main', detached: false } as any);
      mockSimpleGitInstance.revparse.mockResolvedValue('abc123de');

      mockSimpleGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'log') {
          return 'abc123de\nparent123\n';
        }
        if (args[0] === 'rev-parse' && args[1] === 'abc123de^') {
          return 'parent123';
        }
        return '';
      });

      const success = await gitService.rewordCommit('abc123de', 'New message');
      expect(success).toBe(true);
      expect(mockSimpleGitInstance.raw).toHaveBeenCalledWith(['commit', '--amend', '-m', 'New message']);
    });

    it('should reword an older commit and cherry-pick subsequent commits', async () => {
      mockSimpleGitInstance.status.mockResolvedValue({ files: [] } as any);
      mockSimpleGitInstance.branch.mockResolvedValue({ current: 'main', detached: false } as any);
      mockSimpleGitInstance.revparse.mockResolvedValue('deadbeef');

      mockSimpleGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'log') {
          return 'deadbeef\nface1234\ncafe5678\n';
        }
        if (args[0] === 'rev-parse' && args[1] === 'face1234^') {
          return 'cafe5678';
        }
        return '';
      });

      const success = await gitService.rewordCommit('face1234', 'New message');
      expect(success).toBe(true);
      expect(mockSimpleGitInstance.checkout).toHaveBeenCalledWith(expect.arrayContaining(['-b', expect.any(String), 'face1234']));
      expect(mockSimpleGitInstance.raw).toHaveBeenCalledWith(['commit', '--amend', '-m', 'New message']);
      expect(mockSimpleGitInstance.raw).toHaveBeenCalledWith(['cherry-pick', 'face1234..main']);
    });

    it('should rollback on cherry-pick failure', async () => {
      mockSimpleGitInstance.status.mockResolvedValue({ files: [] } as any);
      mockSimpleGitInstance.branch.mockResolvedValue({ current: 'main', detached: false } as any);
      mockSimpleGitInstance.revparse.mockResolvedValue('deadbeef');

      mockSimpleGitInstance.raw.mockImplementation(async (args: string[]) => {
        if (args[0] === 'log') {
          return 'deadbeef\nface1234\ncafe5678\n';
        }
        if (args[0] === 'rev-parse' && args[1] === 'face1234^') {
          return 'cafe5678';
        }
        if (args[0] === 'cherry-pick' && args[1] === 'face1234..main') {
          throw new Error('Cherry-pick conflict');
        }
        return '';
      });

      const success = await gitService.rewordCommit('face1234', 'New message');
      expect(success).toBe(false);
      expect(mockSimpleGitInstance.raw).toHaveBeenCalledWith(['cherry-pick', '--abort']);
      expect(mockSimpleGitInstance.checkout).toHaveBeenCalledWith('main');
      expect(mockSimpleGitInstance.reset).toHaveBeenCalledWith(['--hard', 'deadbeef']);
    });
  });

  describe('fetch', () => {
    it('should call fetch on simple-git and return true on success', async () => {
      mockSimpleGitInstance.fetch.mockResolvedValue({} as any);
      const success = await gitService.fetch();
      expect(mockSimpleGitInstance.fetch).toHaveBeenCalled();
      expect(success).toBe(true);
    });

    it('should return false on fetch error', async () => {
      mockSimpleGitInstance.fetch.mockRejectedValue(new Error('Fetch failed'));
      const success = await gitService.fetch();
      expect(mockSimpleGitInstance.fetch).toHaveBeenCalled();
      expect(success).toBe(false);
    });
  });
});
