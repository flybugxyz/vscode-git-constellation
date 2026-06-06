import React, { useEffect, useState } from 'react';
import './styles.css';
import { GitGraph } from './GitGraph';
import { FileTree } from './FileTree';
import { ContextMenu, MenuEntry } from './ContextMenu';

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

type MenuStateBase = { x: number; y: number };
type CommitMenu = MenuStateBase & { kind: 'commit'; commit: any; index: number };
type BranchMenu = MenuStateBase & { kind: 'branch'; branch: string; isRemote: boolean };
type TagMenu = MenuStateBase & { kind: 'tag'; tag: string };

export type MenuState = CommitMenu | BranchMenu | TagMenu;

function App() {
  const [gitData, setGitData] = useState<any>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [pinnedBranches, setPinnedBranches] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'log' | 'local'>('log');
  const [commitMessage, setCommitMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [selectedCommitFiles, setSelectedCommitFiles] = useState<{hash: string, files: {status: string, path: string}[]} | null>(null);
  const [filterBranch, setFilterBranch] = useState<string>('ALL');
  const [filterAuthor, setFilterAuthor] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [authorPopupPos, setAuthorPopupPos] = useState<{ x: number, y: number } | null>(null);
  const [localExpanded, setLocalExpanded] = useState(true);
  const [remoteExpanded, setRemoteExpanded] = useState(false);  const [filesExpanded, setFilesExpanded] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [graphWidth, setGraphWidth] = useState(100);
  const [descWidth, setDescWidth] = useState<number>(() => {
    const saved = localStorage.getItem('git-jb-desc-width');
    return saved ? parseInt(saved, 10) : 450;
  });
  const [authorWidth, setAuthorWidth] = useState<number>(() => {
    const saved = localStorage.getItem('git-jb-author-width');
    return saved ? parseInt(saved, 10) : 150;
  });
  const [dateWidth, setDateWidth] = useState<number>(() => {
    const saved = localStorage.getItem('git-jb-date-width');
    return saved ? parseInt(saved, 10) : 150;
  });
  const [resizing, setResizing] = useState<{ col: 'desc' | 'author' | 'date'; startX: number; startWidth: number } | null>(null);

  const [commitBoxHeight, setCommitBoxHeight] = useState<number>(() => {
    const saved = localStorage.getItem('git-jb-commit-box-height');
    return saved ? parseInt(saved, 10) : 130;
  });
  const [resizingCommitBox, setResizingCommitBox] = useState<{ startY: number; startHeight: number } | null>(null);

  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());
  const [lastFilesList, setLastFilesList] = useState<string[]>([]);
  const [forcePush, setForcePush] = useState(false);

  useEffect(() => {
    if (!gitData?.status?.files) return;
    const currentPaths = gitData.status.files.map((f: any) => f.path);
    
    // Compare currentPaths with lastFilesList
    const added = currentPaths.filter((p: string) => !lastFilesList.includes(p));
    const removed = lastFilesList.filter((p: string) => !currentPaths.includes(p));
    
    if (added.length > 0 || removed.length > 0) {
      const newChecked = new Set(checkedFiles);
      removed.forEach((p: string) => newChecked.delete(p));
      added.forEach((p: string) => newChecked.add(p));
      
      setCheckedFiles(newChecked);
      setLastFilesList(currentPaths);
    }
  }, [gitData?.status?.files]);

  useEffect(() => {
    vscode.postMessage({ type: 'ready' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'update':
          setGitData(message.payload);
          break;
        case 'files':
          setSelectedCommitFiles({ hash: message.hash, files: message.files });
          break;
        case 'compareFiles':
          setSelectedCommitFiles({ hash: message.hash, files: message.files });
          setIsCompareMode(true);
          break;
        case 'generateCommitMessageResult':
          setIsGenerating(false);
          if (message.message) {
            setCommitMessage(message.message);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizing.startX;
      const newWidth = Math.max(50, resizing.startWidth + deltaX);
      if (resizing.col === 'desc') {
        setDescWidth(newWidth);
      } else if (resizing.col === 'author') {
        setAuthorWidth(newWidth);
      } else if (resizing.col === 'date') {
        setDateWidth(newWidth);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const deltaX = e.clientX - resizing.startX;
      const newWidth = Math.max(50, resizing.startWidth + deltaX);
      localStorage.setItem(`git-jb-${resizing.col}-width`, String(newWidth));
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.classList.add('resizing');

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('resizing');
    };
  }, [resizing]);

  useEffect(() => {
    if (!resizingCommitBox) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = resizingCommitBox.startY - e.clientY;
      const newHeight = Math.max(80, Math.min(window.innerHeight - 100, resizingCommitBox.startHeight + deltaY));
      setCommitBoxHeight(newHeight);
    };

    const handleMouseUp = (e: MouseEvent) => {
      const deltaY = resizingCommitBox.startY - e.clientY;
      const newHeight = Math.max(80, Math.min(window.innerHeight - 100, resizingCommitBox.startHeight + deltaY));
      localStorage.setItem('git-jb-commit-box-height', String(newHeight));
      setResizingCommitBox(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.classList.add('resizing-row');

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('resizing-row');
    };
  }, [resizingCommitBox]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const timestamp = parseInt(dateStr);
    if (isNaN(timestamp)) return dateStr;
    
    try {
      return new Date(timestamp * 1000).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  };

  const handleCommit = () => {
    if (!commitMessage.trim() || checkedFiles.size === 0) return;
    vscode.postMessage({ 
      type: 'commit', 
      message: commitMessage, 
      files: Array.from(checkedFiles) 
    });
    setCommitMessage('');
  };

  const handleCommitAndPush = () => {
    if (!commitMessage.trim() || checkedFiles.size === 0) return;
    vscode.postMessage({ 
      type: 'commitAndPush', 
      message: commitMessage, 
      files: Array.from(checkedFiles),
      force: forcePush
    });
    setCommitMessage('');
  };

  const handleGenerateAI = () => {
    if (checkedFiles.size === 0) return;
    setIsGenerating(true);
    vscode.postMessage({ type: 'generateCommitMessage', files: Array.from(checkedFiles) });
  };

  const handleCheckChange = (path: string, checked: boolean, filePaths: string[]) => {
    const newChecked = new Set(checkedFiles);
    filePaths.forEach(p => {
      if (checked) {
        newChecked.add(p);
      } else {
        newChecked.delete(p);
      }
    });
    setCheckedFiles(newChecked);
  };

  const handleLocalFileClick = (filePath: string) => {
    vscode.postMessage({ type: 'openDiff', hash: '', path: filePath });
  };

  const handleSelectCommit = (idx: number, hash: string) => {
    setSelectedIndex(idx);
    setIsCompareMode(false);
    vscode.postMessage({ type: 'getDiff', hash });
  };

  const handleFilter = (branch: string) => {
    setFilterBranch(branch);
    setSelectedIndex(-1);
    setSelectedCommitFiles(null);
    vscode.postMessage({ type: 'setFilter', branch });
    setShowBranches(false);
  };

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      vscode.postMessage({ type: 'setSearchFilter', search: searchQuery });
    }
  };

  const handleFilterAuthor = (author: string) => {
    setFilterAuthor(author);
    setSelectedIndex(-1);
    setSelectedCommitFiles(null);
    vscode.postMessage({ type: 'setAuthorFilter', author });
    setAuthorPopupPos(null);
  };

  const handleFileClick = (path: string) => {
    if (selectedCommitFiles) {
      vscode.postMessage({ 
        type: 'openDiff', 
        hash: selectedCommitFiles.hash, 
        path,
        isCompare: isCompareMode
      });
    }
  };

  const handleCloseMenu = React.useCallback(() => setMenuState(null), []);

  const openContextMenu = (e: React.MouseEvent, data: Omit<CommitMenu, 'x' | 'y'> | Omit<BranchMenu, 'x' | 'y'> | Omit<TagMenu, 'x' | 'y'>) => {
    e.preventDefault();
    e.stopPropagation();
    setShowBranches(false);
    setMenuState({
      ...data,
      x: e.clientX,
      y: e.clientY
    } as MenuState);
  };

  const handleMenuAction = (action: string) => {
    if (!menuState) return;
    const { kind } = menuState;

    const ref = kind === 'commit' ? menuState.commit.hash : kind === 'branch' ? menuState.branch : menuState.tag;

    switch (action) {
      // Shared actions
      case 'compareWithCurrent':
        if (menuState.kind === 'commit') setSelectedIndex(menuState.index);
        vscode.postMessage({ type: 'compareRef', ref });
        break;
      case 'openInBrowser':
        vscode.postMessage({ type: 'openRefInBrowser', ref, refType: kind });
        break;
      case 'createBranchFrom':
        vscode.postMessage({ type: 'createBranchFrom', ref, refType: kind });
        break;
      case 'mergeRef':
        vscode.postMessage({ type: 'mergeRef', ref });
        break;
      case 'rebaseRef':
        vscode.postMessage({ type: 'rebaseRef', ref });
        break;

      // Commit-specific actions
      case 'copySHA':
      case 'copyShortSHA':
      case 'copyMessage':
      case 'copyURL':
      case 'createTag':
      case 'createWorktree':
      case 'cherryPick':
      case 'cherryPickWithWorktree':
      case 'revertCommit':
      case 'viewDetails':
      case 'viewDiff': {
        if (menuState.kind !== 'commit') break;
        const { commit, index } = menuState;
        
        switch (action) {
          case 'copySHA':
        vscode.postMessage({ type: 'copySHA', hash: commit.hash });
        break;
      case 'copyShortSHA':
        vscode.postMessage({ type: 'copyShortSHA', hash: commit.hash });
        break;
      case 'copyMessage':
        vscode.postMessage({ type: 'copyMessage', message: commit.message });
        break;
      case 'copyURL':
        vscode.postMessage({ type: 'copyURL', hash: commit.hash });
        break;
      case 'createTag':
        vscode.postMessage({ type: 'createTag', hash: commit.hash });
        break;
      case 'createWorktree':
        vscode.postMessage({ type: 'createWorktree', hash: commit.hash });
        break;
      case 'cherryPick':
        vscode.postMessage({ type: 'cherryPick', hash: commit.hash });
        break;
      case 'cherryPickWithWorktree':
        vscode.postMessage({ type: 'cherryPickWithWorktree', hash: commit.hash });
        break;
      case 'revertCommit':
        vscode.postMessage({ type: 'revertCommit', hash: commit.hash });
        break;
      case 'viewDetails':
        if (index !== undefined) setSelectedIndex(index);
        setActiveTab('log');
        setFilesExpanded(true);
        setDetailsExpanded(true);
        vscode.postMessage({ type: 'getDiff', hash: commit.hash });
        break;
          case 'viewDiff':
            vscode.postMessage({ type: 'viewDiff', hash: commit.hash });
            break;
        }
        break;
      }

      // Branch-specific actions
      case 'checkoutBranch':
      case 'pullBranch':
      case 'pushBranch':
      case 'pushBranchTo':
      case 'renameBranch':
      case 'deleteBranch':
      case 'compareBranchWith':
      case 'pinBranch':
      case 'unpinBranch':
      case 'setUpstream':
      case 'showInGraph': {
        if (menuState.kind !== 'branch') break;
        const { branch, isRemote } = menuState;
        
        switch (action) {
          case 'checkoutBranch':
        vscode.postMessage({ type: 'checkoutBranch', branch });
        break;
      case 'pullBranch':
        vscode.postMessage({ type: 'pullBranch', branch });
        break;
      case 'pushBranch':
        vscode.postMessage({ type: 'pushBranch', branch });
        break;
      case 'pushBranchTo':
        vscode.postMessage({ type: 'pushBranchTo', branch });
        break;
      case 'renameBranch':
        vscode.postMessage({ type: 'renameBranch', branch });
        break;
      case 'deleteBranch':
        vscode.postMessage({ type: 'deleteBranch', branch, isRemote });
        break;
      case 'compareBranchWith':
        vscode.postMessage({ type: 'compareBranchWith', branch });
        break;
      case 'pinBranch':
        setPinnedBranches(prev => new Set(prev).add(branch!));
        break;
      case 'unpinBranch':
        setPinnedBranches(prev => { const s = new Set(prev); s.delete(branch!); return s; });
        break;
      case 'setUpstream':
        vscode.postMessage({ type: 'setUpstream', branch });
        break;
          case 'showInGraph':
            handleFilter(branch);
            break;
        }
        break;
      }

      // Tag-specific actions
      case 'viewTagDetails':
      case 'deleteTag':
      case 'copyTagName': {
        if (menuState.kind !== 'tag') break;
        const { tag } = menuState;
        
        switch (action) {
          case 'viewTagDetails':
        vscode.postMessage({ type: 'viewTagDetails', tag });
        break;
      case 'deleteTag':
        vscode.postMessage({ type: 'deleteTag', tag });
        break;
          case 'copyTagName':
            vscode.postMessage({ type: 'copyTagName', tag });
            break;
        }
        break;
      }
    }
    
    setMenuState(null);
  };

  const getCommitMenuItems = (): MenuEntry[] => {
    return [
      {
        label: 'Copy', icon: 'copy',
        submenu: [
          { label: 'Copy SHA', icon: 'copy', action: 'copySHA' },
          { label: 'Copy Short SHA', icon: 'copy', action: 'copyShortSHA' },
          { label: 'Copy Message', icon: 'copy', action: 'copyMessage' },
          { label: 'Copy URL', icon: 'link', action: 'copyURL' }
        ]
      },
      { type: 'separator' },
      { label: 'Create Branch...', icon: 'git-branch', action: 'createBranchFrom' },
      { label: 'Create Tag...', icon: 'tag', action: 'createTag' },
      { label: 'Create Worktree...', icon: 'worktree', action: 'createWorktree' },
      { type: 'separator' },
      { label: 'Cherry Pick', icon: 'git-merge', action: 'cherryPick' },
      { label: 'Cherry Pick (with worktree)', icon: 'git-merge', action: 'cherryPickWithWorktree' },
      { label: 'Revert Commit', icon: 'discard', action: 'revertCommit', danger: true },
      { label: 'Rebase Current Branch onto This', icon: 'sync', action: 'rebaseRef' },
      { label: 'Merge into Current Branch...', icon: 'merge', action: 'mergeRef' },
      { type: 'separator' },
      { label: 'Compare with Current Branch', icon: 'git-compare', action: 'compareWithCurrent' },
      { label: 'View Details', icon: 'inspect', action: 'viewDetails' },
      { label: 'Open in Browser', icon: 'link-external', action: 'openInBrowser' },
      { label: 'View Diff', icon: 'diff', action: 'viewDiff' }
    ];
  };

  const getBranchMenuItems = (): MenuEntry[] => {
    if (menuState?.kind !== 'branch') return [];
    const { branch, isRemote } = menuState;
    const isCurrent = branch === gitData?.branches?.current;
    return [
      { label: 'Checkout Branch', icon: 'check', action: 'checkoutBranch', disabled: isCurrent },
      { label: 'New Branch from...', icon: 'git-branch', action: 'createBranchFrom' },
      { type: 'separator' },
      { label: 'Merge into Current Branch...', icon: 'git-merge', action: 'mergeRef', disabled: isCurrent },
      { label: 'Rebase Current Branch onto This', icon: 'sync', action: 'rebaseRef', disabled: isCurrent },
      { label: 'Pull into Current Branch', icon: 'cloud-download', action: 'pullBranch' },
      { label: 'Push...', icon: 'cloud-upload', action: 'pushBranch' },
      { label: 'Push to Remote...', icon: 'cloud-upload', action: 'pushBranchTo' },
      { type: 'separator' },
      { label: 'Rename Branch...', icon: 'edit', action: 'renameBranch', hidden: isRemote },
      { label: 'Delete Branch...', icon: 'trash', action: 'deleteBranch', danger: true },
      { type: 'separator' },
      { label: 'Compare with Current Branch', icon: 'git-compare', action: 'compareWithCurrent' },
      { label: 'Compare with Branch...', icon: 'git-compare', action: 'compareBranchWith' },
      { type: 'separator' },
      pinnedBranches.has(branch!) 
        ? { label: 'Unpin Branch', icon: 'pin', action: 'unpinBranch' }
        : { label: 'Pin Branch', icon: 'pin', action: 'pinBranch' },
      { label: 'Open in Browser', icon: 'link-external', action: 'openInBrowser' },
      { label: 'Set as Upstream Branch', icon: 'link', action: 'setUpstream', hidden: isRemote },
      { label: 'Show in Commit Graph', icon: 'graph', action: 'showInGraph' }
    ];
  };

  const getTagMenuItems = (): MenuEntry[] => {
    return [
      { label: 'View Tag Details', icon: 'inspect', action: 'viewTagDetails' },
      { label: 'Create Branch from Tag...', icon: 'git-branch', action: 'createBranchFrom' },
      { label: 'Compare with Current Branch', icon: 'git-compare', action: 'compareWithCurrent' },
      { label: 'Delete Tag...', icon: 'trash', action: 'deleteTag', danger: true },
      { type: 'separator' },
      { label: 'Copy Tag Name', icon: 'copy', action: 'copyTagName' },
      { label: 'Open in Browser', icon: 'link-external', action: 'openInBrowser' }
    ];
  };

  const selectedCommit = selectedIndex >= 0 ? gitData?.log?.all[selectedIndex] : null;

  const renderRefs = (refs: string) => {
    if (!refs) return null;
    return refs.split(',').map(r => r.trim()).map(ref => {
      let type = 'branch';
      let label = ref;
      if (ref.startsWith('tag: ')) {
        type = 'tag';
        label = ref.replace('tag: ', '');
      } else if (ref.includes('/')) {
        type = 'remote';
      }

      const onCtxMenu = (e: React.MouseEvent) => {
        if (type === 'tag') {
          openContextMenu(e, { kind: 'tag', tag: label });
        } else {
          openContextMenu(e, { kind: 'branch', branch: label, isRemote: type === 'remote' });
        }
      };

      return (
        <span 
          key={ref} 
          className={`label-pill label-${type}`}
          onContextMenu={onCtxMenu}
          style={{ cursor: 'context-menu' }}
        >
          {label}
        </span>
      );
    });
  };

  const branches = gitData?.branches?.all || [];
  const localBranches: { name: string; displayName: string }[] = [];
  const remoteBranches: { name: string; displayName: string }[] = [];

  branches.forEach((b: string) => {
    if (b.startsWith('remotes/')) {
      if (!b.endsWith('/HEAD')) {
        remoteBranches.push({
          name: b,
          displayName: b.replace(/^remotes\//, '')
        });
      }
    } else {
      localBranches.push({
        name: b,
        displayName: b
      });
    }
  });

  return (
    <div className="container">
      <div className="tabs">
        <div className={`tab ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>Log</div>
        <div className={`tab ${activeTab === 'local' ? 'active' : ''}`} onClick={() => { setActiveTab('local'); setSelectedIndex(-1); setSelectedCommitFiles(null); }}>
          Local Changes {gitData?.status?.files && gitData.status.files.length > 0 && `(${gitData.status.files.length})`}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {activeTab === 'log' ? (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    style={{ background: 'none', border: '1px solid var(--vscode-panel-border)', padding: '2px 8px', fontSize: '10px' }}
                    onClick={() => setShowBranches(!showBranches)}
                  >
                    {filterBranch.startsWith('remotes/') ? filterBranch.replace(/^remotes\//, '') : filterBranch} ▾
                  </button>
                  <input
                    type="text"
                    placeholder="Search commits..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearch}
                    style={{
                      background: 'var(--vscode-input-background)',
                      color: 'var(--vscode-input-foreground)',
                      border: '1px solid var(--vscode-input-border)',
                      padding: '2px 6px',
                      fontSize: '11px',
                      borderRadius: '2px',
                      outline: 'none',
                      width: '200px'
                    }}
                  />
                  {searchQuery && (
                    <span 
                      style={{ cursor: 'pointer', fontSize: '12px', opacity: 0.7, padding: '0 4px' }}
                      title="Clear Search"
                      onClick={() => {
                        setSearchQuery('');
                        vscode.postMessage({ type: 'setSearchFilter', search: '' });
                      }}
                    >
                      ✕
                    </span>
                  )}
                </div>
                {showBranches && (
                  <div className="branch-popup">
                    <div 
                      className={`branch-item ${filterBranch === 'ALL' ? 'active-filter' : ''}`}
                      onClick={() => handleFilter('ALL')}
                    >
                      {filterBranch === 'ALL' && <span style={{ marginRight: '6px' }}>✓</span>}
                      ALL
                    </div>
                    <div 
                      className={`branch-item ${filterBranch === 'HEAD' ? 'active-filter' : ''}`}
                      onClick={() => handleFilter('HEAD')}
                    >
                      {filterBranch === 'HEAD' && <span style={{ marginRight: '6px' }}>✓</span>}
                      HEAD
                    </div>
                    
                    {pinnedBranches.size > 0 && (
                      <>
                        <div className="branch-group-header">
                          <span className="codicon codicon-pin" style={{ marginRight: '6px', fontSize: '10px' }}></span>
                          Pinned Branches ({pinnedBranches.size})
                        </div>
                        {Array.from(pinnedBranches).map((bName) => {
                          const isRemote = bName.startsWith('remotes/');
                          const displayName = isRemote ? bName.replace(/^remotes\//, '') : bName;
                          return (
                            <div 
                              key={`pinned-${bName}`} 
                              className={`branch-item nested ${bName === filterBranch ? 'active-filter' : ''}`}
                              onClick={() => handleFilter(bName)}
                              onContextMenu={(e) => openContextMenu(e, { kind: 'branch', branch: bName, isRemote })}
                            >
                              {bName === filterBranch && <span style={{ marginRight: '6px' }}>✓</span>}
                              {displayName}
                            </div>
                          );
                        })}
                      </>
                    )}
                    
                    <div 
                      className="branch-group-header"
                      onClick={() => setLocalExpanded(!localExpanded)}
                    >
                      <span className={`codicon ${localExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} style={{ marginRight: '6px', fontSize: '10px' }}></span>
                      Local Branches ({localBranches.length})
                    </div>
                    {localExpanded && localBranches.map((b) => (
                      <div 
                        key={b.name} 
                        className={`branch-item nested ${b.name === filterBranch ? 'active-filter' : ''} ${b.name === gitData.branches.current ? 'current' : ''}`}
                        onClick={() => handleFilter(b.name)}
                        onContextMenu={(e) => openContextMenu(e, { kind: 'branch', branch: b.name, isRemote: false })}
                      >
                        {b.name === filterBranch && <span style={{ marginRight: '6px' }}>✓</span>}
                        {b.displayName}
                      </div>
                    ))}

                    <div 
                      className="branch-group-header"
                      onClick={() => setRemoteExpanded(!remoteExpanded)}
                    >
                      <span className={`codicon ${remoteExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} style={{ marginRight: '6px', fontSize: '10px' }}></span>
                      Remote Branches ({remoteBranches.length})
                    </div>
                    {remoteExpanded && remoteBranches.map((b) => (
                      <div 
                        key={b.name} 
                        className={`branch-item nested ${b.name === filterBranch ? 'active-filter' : ''}`}
                        onClick={() => handleFilter(b.name)}
                        onContextMenu={(e) => openContextMenu(e, { kind: 'branch', branch: b.name, isRemote: true })}
                      >
                        {b.name === filterBranch && <span style={{ marginRight: '6px' }}>✓</span>}
                        {b.displayName}
                      </div>
                    ))}
                  </div>
                )}
                <span style={{ marginLeft: '20px' }}>{gitData?.log?.all.length || 0} commits</span>
              </div>
              <div className="table-container" style={{ flex: 1, position: 'relative' }}>
                {gitData?.log?.all && (
                  <div style={{ position: 'absolute', top: '28px', left: 0, pointerEvents: 'none', zIndex: 5 }}>
                    <GitGraph 
                      commits={gitData.log.all} 
                      rowHeight={24} 
                      onWidthChange={setGraphWidth}
                    />
                  </div>
                )}
                <table style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: `${graphWidth}px` }}>Graph</th>
                      <th style={{ width: `${descWidth}px`, position: 'relative' }}>
                        Description
                        <div 
                          className="resize-handle"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setResizing({ col: 'desc', startX: e.clientX, startWidth: descWidth });
                          }}
                        />
                      </th>
                      <th style={{ width: `${authorWidth}px`, position: 'relative' }}>
                        <div 
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          onClick={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setAuthorPopupPos(authorPopupPos ? null : { x: rect.left, y: rect.bottom });
                          }}
                        >
                          {filterAuthor === 'ALL' ? 'Author' : filterAuthor} ▾
                        </div>
                        <div 
                          className="resize-handle"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setResizing({ col: 'author', startX: e.clientX, startWidth: authorWidth });
                          }}
                        />
                      </th>
                      <th style={{ width: `${dateWidth}px`, position: 'relative' }}>
                        Date
                        <div 
                          className="resize-handle"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setResizing({ col: 'date', startX: e.clientX, startWidth: dateWidth });
                          }}
                        />
                      </th>
                      <th style={{ width: 'auto', borderRight: 'none' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {gitData?.log?.all.map((commit: any, idx: number) => (
                      <tr 
                        key={commit.hash} 
                        className={selectedIndex === idx ? 'selected' : ''}
                        onClick={() => handleSelectCommit(idx, commit.hash)}
                        onContextMenu={(e) => openContextMenu(e, { kind: 'commit', commit, index: idx })}
                      >
                        <td style={{ width: `${graphWidth}px` }}></td>
                        <td title={commit.message}>
                          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                            <div style={{ display: 'flex', flexWrap: 'nowrap', marginRight: '8px', flexShrink: 0 }}>
                              {renderRefs(commit.refs)}
                            </div>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{commit.message}</span>
                          </div>
                        </td>
                        <td>
                          {commit.author_name}
                          {gitData?.currentUser && (gitData.currentUser.name === commit.author_name || gitData.currentUser.email === commit.author_email) && (
                            <span style={{ marginLeft: '4px', opacity: 0.6, fontSize: '10px', fontStyle: 'italic' }} title="Me">
                              (me)
                            </span>
                          )}
                        </td>
                        <td>{formatDate(commit.date)}</td>
                        <td style={{ borderRight: 'none' }}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {selectedIndex >= 0 && (
              <div className="side-pane">
                <div className="side-pane-title-bar">
                  <span>Commit Details</span>
                  <span 
                    className="codicon codicon-close side-pane-close" 
                    title="Close Details"
                    onClick={() => {
                      setSelectedIndex(-1);
                      setSelectedCommitFiles(null);
                      setIsCompareMode(false);
                    }}
                  ></span>
                </div>
                <div className="side-pane-header" onClick={() => setFilesExpanded(!filesExpanded)}>
                  <span className={`header-chevron codicon ${filesExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}></span>
                  Changed Files
                </div>
                {filesExpanded && (
                  <div className="file-tree-wrapper">
                    {isCompareMode && (
                      <div className="compare-banner">
                        <span>Comparing with HEAD</span>
                        <div className="compare-banner-close" onClick={(e) => {
                          e.stopPropagation();
                          setIsCompareMode(false);
                          if (selectedCommit) {
                            vscode.postMessage({ type: 'getDiff', hash: selectedCommit.hash });
                          }
                        }}>
                          <span className="codicon codicon-close" style={{ fontSize: '10px' }}></span>
                        </div>
                      </div>
                    )}
                    {selectedCommitFiles ? (
                      <FileTree files={selectedCommitFiles.files} onFileClick={handleFileClick} />
                    ) : (
                      <div style={{ padding: '10px', fontSize: '11px' }}>Loading files...</div>
                    )}
                  </div>
                )}
                
                <div className="side-pane-header" onClick={() => setDetailsExpanded(!detailsExpanded)}>
                  <span className={`header-chevron codicon ${detailsExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right'}`}></span>
                  Commit Details
                </div>
                {detailsExpanded && (
                  <div className="commit-details">
                    <div className="detail-row">
                      <b>{selectedCommit?.message}</b>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Commit:</span>
                      <span className="detail-value">{selectedCommit?.hash.substring(0, 8)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Author:</span>
                      <span className="detail-value">{selectedCommit?.author_name} &lt;{selectedCommit?.author_email}&gt;</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Date:</span>
                      <span className="detail-value">{formatDate(selectedCommit?.date)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Labels:</span>
                      <span className="detail-value">{renderRefs(selectedCommit?.refs)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="local-changes-container" style={{ flex: 1 }}>
            <div className="files-list">
              {gitData?.status?.files && gitData.status.files.length > 0 ? (
                <FileTree
                  files={gitData.status.files.map((f: any) => {
                    const getStatusChar = () => {
                      const ind = f.index;
                      const wd = f.working_dir;
                      if (ind === '?' || wd === '?') return '?';
                      if (ind === 'D' || wd === 'D') return 'D';
                      if (ind === 'A' || wd === 'A') return 'A';
                      if (ind === 'R' || wd === 'R') return 'R';
                      return 'M';
                    };
                    return {
                      path: f.path,
                      status: getStatusChar()
                    };
                  })}
                  onFileClick={handleLocalFileClick}
                  checkboxes={true}
                  checkedPaths={checkedFiles}
                  onCheckChange={handleCheckChange}
                />
              ) : (
                <p style={{ padding: '10px', fontSize: '11px', opacity: 0.6 }}>No local changes.</p>
              )}
            </div>
            <div className="commit-box" style={{ height: `${commitBoxHeight}px`, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div 
                className="resize-handle-row"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setResizingCommitBox({ startY: e.clientY, startHeight: commitBoxHeight });
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--vscode-descriptionForeground)' }}>Commit Message</span>
                <button
                  className="ai-generate-button"
                  title="Generate Commit Message (AI)"
                  onClick={handleGenerateAI}
                  disabled={isGenerating || checkedFiles.size === 0}
                >
                  <span className={`codicon ${isGenerating ? 'codicon-loading codicon-modifier-spin' : 'codicon-sparkle'}`} style={{ fontSize: '12px' }}></span>
                  {isGenerating ? 'Generating...' : 'AI Generate'}
                </button>
              </div>
              <textarea 
                placeholder="Commit message" 
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                style={{ flex: 1, resize: 'none' }}
              />
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: '8px' }}>
                <button 
                  onClick={handleCommit} 
                  disabled={!commitMessage.trim() || checkedFiles.size === 0}
                >
                  Commit
                </button>
                <button 
                  className="button-secondary"
                  onClick={handleCommitAndPush} 
                  disabled={!commitMessage.trim() || checkedFiles.size === 0}
                >
                  Commit and Push
                </button>
                <label style={{ marginLeft: '4px', display: 'inline-flex', alignItems: 'center', fontSize: '11px', cursor: 'pointer', userSelect: 'none', color: 'var(--vscode-descriptionForeground)' }}>
                  <input 
                    type="checkbox" 
                    checked={forcePush} 
                    onChange={(e) => setForcePush(e.target.checked)} 
                    style={{ marginRight: '6px' }}
                  />
                  Force Push
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
      {authorPopupPos && gitData?.authors && (
        <div className="branch-popup" style={{ top: authorPopupPos.y, left: authorPopupPos.x, position: 'fixed' }}>
          <div 
            className={`branch-item ${filterAuthor === 'ALL' ? 'active-filter' : ''}`}
            onClick={() => handleFilterAuthor('ALL')}
          >
            {filterAuthor === 'ALL' && <span style={{ marginRight: '6px' }}>✓</span>}
            ALL
          </div>
          {gitData.authors.map((a: string) => (
            <div 
              key={a} 
              className={`branch-item ${filterAuthor === a ? 'active-filter' : ''}`}
              onClick={() => handleFilterAuthor(a)}
            >
              {filterAuthor === a && <span style={{ marginRight: '6px' }}>✓</span>}
              {a}
            </div>
          ))}
        </div>
      )}
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={menuState.kind === 'commit' ? getCommitMenuItems() : menuState.kind === 'branch' ? getBranchMenuItems() : getTagMenuItems()}
          onAction={handleMenuAction}
          onClose={handleCloseMenu}
        />
      )}
    </div>
  );
}

export default App;
