export interface Commit {
  hash: string;
  parents: string[];
  refs: string;
  message: string;
  author_name: string;
  author_email: string;
  date: string;
}

export interface GitStatusFile {
  path: string;
  index: string;
  working_dir: string;
}

export interface GitStatus {
  files: GitStatusFile[];
  not_added: string[];
  conflicted: string[];
  created: string[];
  deleted: string[];
  modified: string[];
  renamed: { from: string; to: string }[];
  staged: string[];
  ahead: number;
  behind: number;
  current: string | null;
  tracking: string | null;
}

export interface GitBranch {
  name: string;
  commit: string;
  label: string;
  current: boolean;
  isRemote: boolean;
}

export interface GitBranches {
  all: string[];
  branches: { [key: string]: GitBranch };
  current: string;
}

export interface Stash {
  hash: string;
  refName: string;
  message: string;
  date: string;
}

export interface Worktree {
  path: string;
  commit: string;
  branch: string;
  isMain: boolean;
}

export interface RepositoryInfo {
  name: string;
  path: string;
  isMain: boolean;
}

export interface GitData {
  log: { all: Commit[] } | null;
  status: GitStatus | null;
  branches: GitBranches | null;
  tags: string[];
  authors: string[];
  currentUser: { name: string; email: string } | null;
  fileFilter: string;
  stashes?: Stash[];
  worktrees?: Worktree[];
  repositories?: RepositoryInfo[];
  activeRepo?: string;
}
