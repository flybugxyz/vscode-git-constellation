# Project: Git JB Style - Project Instructions

Foundational mandates for maintenance and future development.

## Project Overview
A VS Code extension mimicking the JetBrains Git UI experience. Located in the `vscode-git-jb` directory.

## Coding Rule
- Finished the task should run `npm run compile` to compile the project and write a commit message then commit it.
- Finished the task should update GEMINI.md if needed.

## Technical Architecture
- **Extension Host (Node.js)**: Handles Git operations via `simple-git`.
- **UI Layer (Webview)**: React + TypeScript + Vite.
- **Styling**: Vanilla CSS, theme-aware using VS Code CSS variables.
- **Icons**: `@vscode/codicons` (font-based).

## Key Components & Logic
### 1. Git Data Layer (`src/git.ts`)
- Uses `simple-git` with custom raw formatting.
- Log format: `%H%x09%P%x09%D%x09%s%x09%an%x09%ae%x09%at` (Tab-separated).
- Fields: Hash, Parents, Refs, Message, Author, Email, Date (UNIX timestamp).

### 2. Git Graph (`webview/src/GitGraph.tsx`)
- **Rendering**: HTML5 Canvas with High-DPI (Retina/4K) scaling logic.
- **Lanes**: Dynamic lane-based layout.
- **Auto-Width**: Calculates `maxLanes` and notifies parent via `onWidthChange` to adjust table columns.
- **Labels**: Branch/Tag labels are handled by the main App in HTML (description column) to prevent overlap.

### 3. File Tree (`webview/src/FileTree.tsx`)
- **Structure**: Recursive tree with folder support.
- **Expansion**: Default-expanded on load via `useEffect`.
- **Checkboxes**: Supports rendering checkbox controls for selecting files and directories (with checked/unchecked/indeterminate states).
- **Status Coloring**:
    - `A` (Added): Green (`#50fa7b`)
    - `M` (Modified): Blue (`#4a9eff`)
    - `D` (Deleted): Red + Strikethrough (`#ff5555`)
    - `R` (Renamed): Purple (`#bd93f9`)
    - `?` (Untracked): Red-brown (`#d16969`)
- **Icons**: Mapped to common file extensions using Codicons.

### 4. Side Pane Layout
- Split into **Changed Files** (top) and **Commit Details** (bottom).
- Both sections are collapsible with persistent state in the session.

### 5. Commit Context Menu & Git Operations
- **Trigger**: Right-clicking a commit row triggers `handleContextMenu`, rendering a custom HTML context menu positioned to respect viewport boundaries.
- **Copy Actions**: Copies full/short SHA, commit message, or parsed remote repository HTTP URL.
- **Git Actions**: Create branch, create tag, create worktree (Pro), cherry-pick, cherry-pick in worktree (Pro), revert, rebase, and merge.
- **Compare Mode**: Fetches and renders file differences (`git diff --name-status HEAD <hash>`) between the selected commit and current branch. Supports exiting comparison mode via a banner in the changed files pane.
- **View Diff**: Registers a custom text content provider `git-jb-diff` scheme returning full git diffs with VS Code syntax highlighting.

## Maintenance Guidelines
- **Building**: Always run `npm run compile` to build both Webview (Vite) and Extension (Webpack).
- **Styling**: Prefer `var(--vscode-*)` variables for theme compatibility.
- **Communication**: Use `vscode.postMessage` and `window.addEventListener('message', ...)` for host-webview bridge.
- **New Features**: Ensure High-DPI support for any new Canvas elements.

## File Manifest
- `package.json`: Extension entry point and contributes.
- `src/extension.ts`: Main activation logic and message handling.
- `src/git.ts`: Git abstraction layer.
- `webview/index.html`: Webview entry.
- `webview/src/App.tsx`: Main UI orchestration.
- `webview/src/GitGraph.tsx`: Commit graph rendering.
- `webview/src/FileTree.tsx`: Modified files tree view.
- `webview/src/styles.css`: Global styles and theme overrides.
