# GitConstellation - VS Code Extension

[English](#english) | [中文](#中文)

---

## English

GitConstellation is a VS Code extension that brings the highly acclaimed Git visualization and management experience from JetBrains IDEs to Visual Studio Code. It provides a powerful, multi-colored commit graph and a cohesive interface for managing local changes and history.

### ✨ Features

*   **JetBrains-Style Log View**: A multi-colored, interactive commit history graph with clear indicators for branches, tags, and remotes. Hovering over a commit displays a detailed metadata popup.
*   **Commit Side Pane**:
    *   **Tree View**: Modified files are shown in a hierarchical tree with status-based coloring (Added, Modified, Deleted, Renamed, Untracked).
    *   **Commit Details**: View full commit messages, author information, and associated refs.
*   **Integrated Diff Viewer**: Click on any file in the tree to open a side-by-side diff comparison in the main VS Code editor.
*   **Local Changes Manager**: A dedicated tab to stage changes, write commit messages, discard changes, and generate commit messages using AI.
*   **Stash Management**: A dedicated "Stashes" tab to view stashed changes, apply/pop/drop stashes, and generate AI stash descriptions.
*   **Worktree Management**: A dedicated "Worktrees" tab to list and manage git worktrees (open in a new window, remove, or prune).
*   **File History View**: Right-click a file in VS Code explorer to view its git history with a simplified linear graph.
*   **Multi-Select & Operations**: Select multiple commits with Ctrl+click or Shift+click to perform batch cherry-pick or squash contiguous commits on the current branch.
*   **Commit Editing**: Amend the HEAD commit message or rewrite older commit messages from the context menu.
*   **Branch & Tag Switcher**: Easily search and filter commits by tags, local/remote branches, and pin branches.
*   **Native Look & Feel**: Uses VS Code's standard Codicons and theme-aware styling for a seamless experience.

### 📸 Screenshots

#### Log View & Commit History
![Log View](docs/commitList.png)

#### Local Changes Panel
![Local Changes](docs/localChanges.png)

#### AI Commit Message Settings
![AI Settings](docs/AISettings.png)

### 🚀 Getting Started

1.  Clone this repository.
2.  Run `npm install` to install dependencies.
3.  Run `npm run compile` to build the extension and webview.
4.  Press `F5` in VS Code to start the extension in a new Extension Development Host window.
5.  Open the "GitConstellation" tab in the bottom panel (alongside Terminal/Output).

---

## 中文

GitConstellation 是一款 VS Code 插件，旨在将深受好评的 JetBrains IDE Git 可视化与管理体验带入 Visual Studio Code。它提供了一个强大的多色提交图谱（Commit Graph）以及一个用于管理本地更改和历史记录的统一界面。

### ✨ 功能特性

*   **JetBrains 风格日志视图**：交互式多色提交历史图谱，清晰显示分支、标签（Tag）及远程分支标识。悬停在提交记录上可查看详细的悬停元数据卡片。
*   **提交详情侧边栏**：
    *   **树状视图**：以层级树结构显示修改的文件，并根据 Git 状态（新增、修改、删除、重命名、未追踪）进行着色。
    *   **提交详情**：查看完整的提交信息、作者详情及关联的引用（Refs）。
*   **集成对比查看器**：点击文件树中的任何文件，即可在 VS Code 主编辑区直接打开双栏对比（Diff）窗口。
*   **本地更改管理**：专门的标签页用于查看/撤销本地更改、暂存修改，并支持通过 AI 自动生成提交信息。
*   **Stash 暂存管理**：独立的 "Stashes" 标签页，用于查看所有 stash 列表、应用/弹出/丢弃 stash，以及使用 AI 生成暂存描述。
*   **Worktree 工作树管理**：独立的 "Worktrees" 标签页，列出当前工作树并支持一键在新窗口打开、删除或修剪 (prune) 工作树。
*   **文件历史视图**：在 VS Code 资源管理器中右键点击任意文件，即可通过简化的线性提交图谱查看该文件的 Git 历史。
*   **多选与批量操作**：支持按 Ctrl/Shift 键多选提交记录，支持批量 Cherry-pick 及压缩（Squash）当前分支上的连续提交。
*   **编辑提交信息**：支持直接在右键菜单中修改（Amend）HEAD 提交信息，或者重写历史记录以修改旧提交的提交信息。
*   **分支与标签过滤**：增强的下拉筛选菜单，支持按本地/远程分支、标签（Tag）过滤提交列表，并支持置顶（Pin）常用分支。
*   **原生集成**：使用 VS Code 标准的 Codicons 图标库，并适配编辑器主题，确保完美的视觉集成。

### 📸 界面截图

#### 日志视图与提交历史
![日志视图](docs/commitList.png)

#### 本地更改面板
![本地更改](docs/localChanges.png)

#### AI 提交信息设置
![AI 设置](docs/AISettings.png)

### 🚀 快速开始

1.  克隆本仓库。
2.  运行 `npm install` 安装依赖。
3.  运行 `npm run compile` 编译插件和 Webview。
4.  在 VS Code 中按 `F5` 启动插件调试。
5.  在底部面板（终端/输出旁边）打开 "GitConstellation" 标签页。

---

## License | 开源协议

This project is licensed under the [MIT License](LICENSE).
本项目采用 [MIT 协议](LICENSE) 开源。
