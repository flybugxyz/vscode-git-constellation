# Changelog

All notable changes to the **GitConstellation** extension will be documented in this file.

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
