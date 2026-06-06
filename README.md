# GitConstellation - VS Code Extension

[English](#english) | [中文](#中文)

---

## English

GitConstellation is a VS Code extension that brings the highly acclaimed Git visualization and management experience from JetBrains IDEs to Visual Studio Code. It provides a powerful, multi-colored commit graph and a cohesive interface for managing local changes and history.

### ✨ Features

*   **JetBrains-Style Log View**: A multi-colored, interactive commit history graph with clear indicators for branches, tags, and remotes.
*   **Commit Side Pane**:
    *   **Tree View**: Modified files are shown in a hierarchical tree with status-based coloring (Added, Modified, Deleted).
    *   **Commit Details**: View full commit messages, author information, and associated refs.
*   **Integrated Diff Viewer**: Click on any file in the tree to open a side-by-side diff comparison in the main VS Code editor.
*   **Local Changes Manager**: A dedicated tab to stage changes and commit directly from the panel.
*   **Branch Switcher**: Easily checkout local branches with a quick-access dropdown.
*   **Native Look & Feel**: Uses VS Code's standard Codicons and theme-aware styling for a seamless experience.

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

*   **JetBrains 风格日志视图**：交互式多色提交历史图谱，清晰显示分支、标签（Tag）及远程分支标识。
*   **提交详情侧边栏**：
    *   **树状视图**：以层级树结构显示修改的文件，并根据 Git 状态（新增、修改、删除）进行着色。
    *   **提交详情**：查看完整的提交信息、作者详情及关联的引用（Refs）。
*   **集成对比查看器**：点击文件树中的任何文件，即可在 VS Code 主编辑区直接打开双栏对比（Diff）窗口。
*   **本地更改管理**：专门的标签页用于查看待提交内容，并直接在面板中进行提交。
*   **分支切换**：通过顶部的快速访问下拉菜单轻松切换本地分支。
*   **原生集成**：使用 VS Code 标准的 Codicons 图标库，并适配编辑器主题，确保完美的视觉集成。

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
