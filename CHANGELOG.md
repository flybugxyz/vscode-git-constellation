# Changelog

All notable changes to the **GitConstellation** extension will be documented in this file.

## [1.0.4] - 2026-06-11

### Added
- **Marketplace Discoverability**: Added `keywords` and `categories` tags to `package.json`.
- **Active Branch Highlighting**: Visually highlight the currently active Git branch in the UI.

### Changed
- **AI Commit Prompt**: Updated the default system prompt for the AI assistant to more strictly follow the Conventional Commits specification.
- **Extension Icon Theme**: Updated the extension icon theme.
- **Performance**: Optimized the Local Changes panel for better rendering and performance.

## [1.0.3] - 2026-06-10

### Added
- **Submodule Management**: Added support for managing Git submodules, including submodule branch sidebar integration.
- **Searchable Branches and Tags**: Implement search functionality for the branch and tag filter popups in the log view.
- **Loading Animations**: Added loading animations to Git operations for better user feedback.
- **Configurable Commit Limit**: Increased the flexibility of the commit list limit.

### Fixed
- **GitGraph Rendering**: Fixed GitGraph rendering alignment issues.

## [1.0.2] - 2026-06-09

### Added
- **Multiline Commit Messages**: Render carriage returns and newlines correctly in Commit Details Side Pane and Commit Hover Popup.
- **Editor Context Menu integration**: Added "View File History (GitConstellation)" to editor context menu in addition to explorer context menu.
- **Auto-Switch Tab**: Automatically switch the active panel tab to "Log" when invoking "View File History" from the file explorer context menu.

### Fixed
- **Git Diff Normalization**: Allowed HEAD and empty hashes in Git service, fixing a runtime error when comparing files or viewing diffs across certain Git states.

## [1.0.1] - 2026-06-08

### Added
- **Stash Management**: Added a dedicated "Stashes" tab to list and manage git stashes. Supports applying, popping, and dropping stashes, viewing stashed files, and generating AI descriptions for new stashes.
- **Worktree Management**: Added a dedicated "Worktrees" tab to view all git worktrees with options to open them in a new window, remove them, or prune stale administrative records.
- **File History View**: Added a VS Code Explorer context menu action to view a file's history, rendering a simplified linear timeline git graph filtered by the selected file.
- **Multi-Selection & Batch Operations**: Enabled Ctrl+click / Shift+click multi-selection on the commit list table. Added support for batch cherry-picking and squashing contiguous commits on the current branch.
- **Edit Commit Messages**: Support amending HEAD or rewriting history for older commits to edit commit messages directly from the context menu.
- **Tag & Remote Filtering**: Enhanced the branch dropdown to support filtering the commit list by tags, local/remote branches, and pinned branches.
- **Commit Detail Hover Popup**: Custom popup shows detailed commit metadata, refs, and the message when hovering over rows in the log.
- **Manual Sync**: Refresh button in the top-right toolbar to manually fetch remote changes and reload the view.
- **Testing Infrastructure**: Set up a robust Vitest testing environment with mocks for VS Code and simple-git.

### Fixed
- Fixed browser text selection being triggered when Shift+clicking rows in the commit table.
- Fixed worktree "open in new window" icon rendering.
- Fixed parsing of HEAD prefix from `git worktree list --porcelain`.

## [1.0.0] - 2026-06-07

### Added
- **Interactive Git Graph & Log View**: A full JetBrains-style multi-lane Git commit graph rendered with Canvas, supporting High-DPI displays.
- **Commit Details & File Tree**: Collapsible side panels displaying commit details and a file tree of changes. Supports directory-level expansion, custom icons, and file status coloring.
- **Local Changes & Selective Staging**: View and stage local changes using checkbox controls. Includes a resizable commit message input text area.
- **Discard Local Changes**: Added a trash icon to the local changes file tree to easily discard changes, with double-confirmation via VS Code prompts.
- **AI Commit Message Generation**: Generate conventional commit messages from the diff of staged files using configurable OpenAI-compatible API endpoints.
- **Filtering & Search**:
  - Filter commits by commit ID (SHA) or message.
  - Filter commits by Author, including a quick-access badge for the current user.
- **Log Header Controls**: Action buttons in the header for quick Git operations:
  - Pull (fetch and merge)
  - Push (push to remote)
  - Cherry-pick
- **Context Menus**: Comprehensive right-click menus for Commits, Branches, and Tags, featuring:
  - Git operations: Revert, checkout, rename, delete, merge, rebase, and set upstream.
  - Compare mode to view differences between branches/tags or HEAD vs a specific commit.
  - Custom diff view text document provider.
- **User Interface**: Sleek, theme-aware Vanilla CSS styles that automatically adapt to standard VS Code colors (`--vscode-*` variables).
- **Extension Asset**: Custom 128x128 extension icon.
