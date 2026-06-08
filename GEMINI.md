# Project: GitConstellation - Project Instructions

Foundational mandates for maintenance and future development.

## Project Overview
A VS Code extension mimicking the JetBrains Git UI experience. Located in the `vscode-git-constellation` directory.

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

### 5. Context Menus & Git Operations
- **Trigger**: Right-clicking a commit row, branch (dropdown list / pills), or tag pill triggers custom context menus positioned to respect viewport boundaries.
- **Implementation**: Handled by a unified `<ContextMenu />` component in `ContextMenu.tsx`. It provides standard styling, keyboard navigation, submenus (e.g. for Copying), danger states, and dynamic enabling/disabling of options.
- **Commit Menu**: Copy SHA/short SHA/message/URL, create branch/tag/worktree, cherry-pick (supports multiple commits), squash commits (combines selected contiguous commits on the current branch with same-branch validation), revert, rebase, merge, compare, inspect details, open browser, view diff.
- **Branch Menu**: Checkout, new branch, merge, rebase, pull, push, push to remote, rename, delete (local/remote), compare, pin/unpin, open in browser, set upstream. Pinned branches are displayed at the very top of the branch filter popup. The branch filter popup also allows filtering the commit log by local branches, remote branches, and tags.
- **Tag Menu**: View tag details (registers custom content provider `git-constellation-tag` scheme), create branch, compare, delete (local/remote), copy tag name, open in browser.
- **Compare Mode**: Diff status between branches/tags or HEAD vs commit. Renders file differences list in the side pane with a banner to exit.
- **View Diff**: Registers a custom text content provider `git-constellation-diff` scheme returning full git diffs.
- **VS Code Explorer Context Menu**: Right-clicking a file in the VS Code file explorer context menu displays a "View File History (GitConstellation)" option, which automatically focuses the extension panel and filters the commit list to show the file's git history.

### 6. Commit List Table
- **Layout**: Uses `table-layout: fixed` for stable column dimensions.
- **Selection**: Supports multiple selection using Ctrl+click (toggle selection) and Shift+click (range selection) with active selection highlighting (`tr.selected`). Right-clicking a row selects it if it isn't already part of the current selection.
- **Resizable Columns**: Enables manual stretching of the "Description", "Author", and "Date" columns via mouse drag handlers on header borders. Final column widths are saved and persisted via `localStorage`.
- **Graph Column**: Exempt from manual resizing; width is automatically controlled by `GitGraph`.

### 7. AI Commit Generation
- **Integration**: OpenAI-compatible API configured via `git-constellation.openai.apiUrl`, `git-constellation.openai.apiKey`, `git-constellation.openai.model`, and `git-constellation.openai.prompt`.
- **Logic**: Reads diff from selected checked files, limits length, and sends to the configured API. If no API key is set, it prompts the user to open settings.
- **Test Command**: `git-constellation.testOpenAISettings` is available via settings page or command palette to verify connection.

## Maintenance Guidelines
- **Building**: Always run `npm run compile` to build both Webview (Vite) and Extension (Webpack).
- **Styling**: Prefer `var(--vscode-*)` variables for theme compatibility.
- **Communication**: Use `vscode.postMessage` and `window.addEventListener('message', ...)` for host-webview bridge.
- **New Features**: Ensure High-DPI support for any new Canvas elements.

## Testing
- **Framework**: Vitest unit testing.
- **Run command**: `npm run test` executes the unit test suite.
- **Test locations**: `src/__tests__/` (extension host) and `webview/src/__tests__/` (webview logic).
- **Mocks**: Out-of-process modules like `vscode` and `simple-git` are mocked under `src/__tests__/git.test.ts`.

## File Manifest
- `package.json`: Extension entry point, scripts, and contributes.
- `tsconfig.json`: TypeScript compiler options and workspace exclusions.
- `vitest.config.ts`: Vitest test suite runner configuration.
- `src/extension.ts`: Main activation logic and message handling.
- `src/git.ts`: Git abstraction layer with input validation safeguards.
- `src/__tests__/git.test.ts`: Unit test suite verifying GitService operations.
- `webview/index.html`: Webview entry.
- `webview/src/App.tsx`: Main UI orchestration (commit table, toolbar, branch popup, author popup).
- `webview/src/types.ts`: Shared TypeScript interface definitions for domain objects.
- `webview/src/utils.ts`: Shared UI utility helpers.
- `webview/src/GitGraph.tsx`: Commit graph rendering.
- `webview/src/FileTree.tsx`: Modified files tree view.
- `webview/src/ContextMenu.tsx`: Unified context menu component with keyboard navigation.
- `webview/src/CommitDetailsSidePane.tsx`: Commit details side pane (changed files + commit metadata).
- `webview/src/CommitHoverPopup.tsx`: Hover popup showing commit details on mouse hover.
- `webview/src/LocalChangesPanel.tsx`: Local changes panel (file tree + commit box + AI generate).
- `webview/src/contextMenuActions.ts`: Pure logic for context menu item builders and action dispatch.
- `webview/src/hooks/useResizable.ts`: Custom hook for column/commit-box drag-resize with localStorage persistence.
- `webview/src/hooks/useCommitSelection.ts`: Custom hook for commit multi-select/range-select/squash logic.
- `webview/src/__tests__/contextMenuActions.test.ts`: Unit tests for context menu actions (34 tests).
- `webview/src/styles.css`: Global styles and theme overrides.
