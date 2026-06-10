import React, { useEffect, useState, useRef } from 'react';
import './styles.css';
import { GitGraph } from './GitGraph';
import { ContextMenu, MenuEntry } from './ContextMenu';
import { CommitHoverPopup } from './CommitHoverPopup';
import { CommitDetailsSidePane } from './CommitDetailsSidePane';
import { LocalChangesPanel } from './LocalChangesPanel';
import { Commit, GitStatusFile, GitData, Stash } from './types';
import { formatDate } from './utils';
import {
  dispatchMenuAction,
  getCommitMenuItems as buildCommitMenuItems,
  getBranchMenuItems as buildBranchMenuItems,
  getTagMenuItems as buildTagMenuItems,
  getStashMenuItems as buildStashMenuItems,
  MenuActionCallbacks,
} from './contextMenuActions';
import { useResizable } from './hooks/useResizable';
import { useCommitSelection } from './hooks/useCommitSelection';

declare const acquireVsCodeApi: any;
const vscode = acquireVsCodeApi();

type MenuStateBase = { x: number; y: number };
type CommitMenu = MenuStateBase & { kind: 'commit'; commit: Commit; index: number };
type BranchMenu = MenuStateBase & { kind: 'branch'; branch: string; isRemote: boolean };
type TagMenu = MenuStateBase & { kind: 'tag'; tag: string };
type StashMenu = MenuStateBase & { kind: 'stash'; stash: Stash };

export type MenuState = CommitMenu | BranchMenu | TagMenu | StashMenu;

function App() {
  const [gitData, setGitData] = useState<GitData | null>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [selectedCommitFiles, setSelectedCommitFiles] = useState<{hash: string, files: {status: string, path: string}[]} | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fileFilter, setFileFilter] = useState<string>('');

  const selection = useCommitSelection({
    postMessage: (msg: any) => vscode.postMessage(msg),
    hasActiveFilters: () => !!(searchQuery || fileFilter),
    onSelectionCleared: () => {
      setSelectedCommitFiles(null);
    },
    onCommitSelected: () => {
      setIsCompareMode(false);
    },
  });

  const [pinnedBranches, setPinnedBranches] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('pinnedBranches');
      return saved ? new Set<string>(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const [activeTab, setActiveTab] = useState<'log' | 'local' | 'stashes' | 'worktrees'>('log');
  const [commitMessage, setCommitMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showBranches, setShowBranches] = useState(false);
  const [filterBranch, setFilterBranch] = useState<string>('ALL');
  const [filterAuthor, setFilterAuthor] = useState<string>('ALL');
  const [authorPopupPos, setAuthorPopupPos] = useState<{ x: number, y: number } | null>(null);

  const [branchSearchQuery, setBranchSearchQuery] = useState<string>('');
  const branchSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showBranches) {
      setBranchSearchQuery('');
    } else {
      setTimeout(() => {
        if (branchSearchInputRef.current) {
          branchSearchInputRef.current.focus();
        }
      }, 50);
    }
  }, [showBranches]);

  // Stash state variables
  const [selectedStashIndex, setSelectedStashIndex] = useState<number>(-1);
  const [showCreateStash, setShowCreateStash] = useState<boolean>(false);
  const [stashMessage, setStashMessage] = useState<string>('');
  const [stashKeepIndex, setStashKeepIndex] = useState<boolean>(false);
  const [stashIncludeUntracked, setStashIncludeUntracked] = useState<boolean>(true);
  const [isStashGenerating, setIsStashGenerating] = useState<boolean>(false);
  const [localExpanded, setLocalExpanded] = useState(true);
  const [remoteExpanded, setRemoteExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [filesExpanded, setFilesExpanded] = useState(true);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [graphWidth, setGraphWidth] = useState(100);
  const { descWidth, authorWidth, dateWidth, commitBoxHeight, startColumnResize, startCommitBoxResize } = useResizable();

  const [checkedFiles, setCheckedFiles] = useState<Set<string>>(new Set());
  const [hoveredCommit, setHoveredCommit] = useState<{
    commit: Commit;
    x: number;
    y: number;
  } | null>(null);
  const hoverTimeoutRef = React.useRef<any>(null);
  const mouseCoordsRef = React.useRef({ x: 0, y: 0 });
  const [lastFilesList, setLastFilesList] = useState<string[]>([]);
  
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const theadRef = useRef<HTMLTableSectionElement>(null);
  const [actualRowHeight, setActualRowHeight] = useState(24);
  const [actualTheadHeight, setActualTheadHeight] = useState(28);

  useEffect(() => {
    if (!gitData?.status?.files) return;
    const currentPaths = gitData.status.files.map((f: GitStatusFile) => f.path);
    
    // Compare currentPaths with lastFilesList
    const added = currentPaths.filter((p: string) => !lastFilesList.includes(p));
    const removed = lastFilesList.filter((p: string) => !currentPaths.includes(p));
    
    if (added.length > 0 || removed.length > 0) {
      setCheckedFiles(prevChecked => {
        const newChecked = new Set(prevChecked);
        removed.forEach((p: string) => newChecked.delete(p));
        added.forEach((p: string) => newChecked.add(p));
        return newChecked;
      });
      setLastFilesList(currentPaths);
    }
  }, [gitData?.status?.files, lastFilesList]);

  useEffect(() => {
    vscode.postMessage({ type: 'ready' });

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'update':
          const payload = message.payload;
          setGitData(payload);
          if (payload.fileFilter !== undefined) {
            setFileFilter(payload.fileFilter);
          }
          if (payload.selectTab) {
            setActiveTab(payload.selectTab);
          }
          if (payload.log?.all) {
            selection.clampIndices(payload.log.all.length);
          }
          break;
        case 'selectTab':
          if (message.tab) {
            setActiveTab(message.tab);
          }
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
        case 'generateStashMessageResult':
          setIsStashGenerating(false);
          if (message.message) {
            setStashMessage(message.message);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (!tbodyRef.current || !theadRef.current) return;
    
    let animationFrameId: number;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = requestAnimationFrame(() => {
        if (theadRef.current) {
          setActualTheadHeight(theadRef.current.getBoundingClientRect().height);
        }
        if (tbodyRef.current) {
          const length = gitData?.log?.all?.length || 0;
          if (length > 0) {
            const tHeight = tbodyRef.current.getBoundingClientRect().height;
            setActualRowHeight(tHeight / length);
          }
        }
      });
    });
    
    observer.observe(tbodyRef.current);
    observer.observe(theadRef.current);
    
    return () => {
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, [gitData?.log?.all]);

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

  const handleDiscard = (path: string) => {
    vscode.postMessage({ type: 'discardChanges', path });
  };

  const handleSelectCommit = (idx: number, hash: string, e?: React.MouseEvent) => {
    selection.handleSelectCommit(idx, hash, e);
  };

  const handleRowMouseEnter = (e: React.MouseEvent, commit: any) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    mouseCoordsRef.current = { x: e.clientX, y: e.clientY };
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCommit({ commit, x: mouseCoordsRef.current.x, y: mouseCoordsRef.current.y });
    }, 450);
  };

  const handleRowMouseMove = (e: React.MouseEvent) => {
    mouseCoordsRef.current = { x: e.clientX, y: e.clientY };
    if (hoveredCommit) {
      setHoveredCommit(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    }
  };

  const handleRowMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredCommit(null);
  };

  const handleFilter = (branch: string) => {
    setFilterBranch(branch);
    selection.clearSelection();
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
    selection.clearSelection();
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

  const openContextMenu = (
    e: React.MouseEvent,
    data: Omit<CommitMenu, 'x' | 'y'> | Omit<BranchMenu, 'x' | 'y'> | Omit<TagMenu, 'x' | 'y'> | Omit<StashMenu, 'x' | 'y'>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setShowBranches(false);
    setMenuState({
      ...data,
      x: e.clientX,
      y: e.clientY
    } as MenuState);
  };

  const handleSelectStash = (idx: number, stash: Stash) => {
    setSelectedStashIndex(idx);
    selection.clearSelection();
    setIsCompareMode(false);
    vscode.postMessage({ type: 'getStashFiles', hash: stash.hash });
  };

  const handleGenerateStashAI = () => {
    setIsStashGenerating(true);
    // Use checked files from Local Changes if selected, otherwise generate for all local changes
    const files = checkedFiles.size > 0 
      ? Array.from(checkedFiles) 
      : (gitData?.status?.files || []).map(f => f.path);
    vscode.postMessage({ type: 'generateStashMessage', files });
  };

  const handleCreateStash = () => {
    vscode.postMessage({
      type: 'createStash',
      message: stashMessage,
      keepIndex: stashKeepIndex,
      includeUntracked: stashIncludeUntracked
    });
    setStashMessage('');
    setShowCreateStash(false);
  };

  const handleMenuAction = (action: string) => {
    if (!menuState) return;
    dispatchMenuAction(menuState, action, {
      postMessage: (msg: any) => vscode.postMessage(msg),
      setSelectedIndex: selection.setSelectedIndex,
      setActiveTab,
      setFilesExpanded,
      setDetailsExpanded,
      setPinnedBranches,
      handleFilter,
      getAllCommitHashes: (indices: number[]) =>
        indices.map(i => gitData?.log?.all?.[i]?.hash).filter((h): h is string => !!h),
      selectedIndices: selection.selectedIndices,
    });
    setMenuState(null);
  };

  const getCommitMenuItems = (): MenuEntry[] =>
    buildCommitMenuItems(selection.selectedIndices.length, selection.checkCanSquash());

  const getBranchMenuItems = (): MenuEntry[] => {
    if (menuState?.kind !== 'branch') return [];
    const { branch, isRemote } = menuState;
    return buildBranchMenuItems(
      branch,
      isRemote,
      branch === gitData?.branches?.current,
      pinnedBranches.has(branch),
    );
  };

  const getTagMenuItems = (): MenuEntry[] => buildTagMenuItems();

  const getStashMenuItems = (): MenuEntry[] => buildStashMenuItems();

  const selectedCommit = selection.selectedIndex >= 0 ? gitData?.log?.all[selection.selectedIndex] : null;
  const selectedStash = selectedStashIndex >= 0 && gitData?.stashes ? gitData.stashes[selectedStashIndex] : null;

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
  const tags: string[] = gitData?.tags || [];

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

  const query = branchSearchQuery.trim().toLowerCase();

  const filteredLocalBranches = query
    ? localBranches.filter(b => b.displayName.toLowerCase().includes(query))
    : localBranches;

  const filteredRemoteBranches = query
    ? remoteBranches.filter(b => b.displayName.toLowerCase().includes(query))
    : remoteBranches;

  const filteredTags = query
    ? tags.filter(t => t.toLowerCase().includes(query))
    : tags;

  const filteredPinnedBranches = Array.from(pinnedBranches).filter(bName => {
    const isRemote = bName.startsWith('remotes/');
    const displayName = isRemote ? bName.replace(/^remotes\//, '') : bName;
    return query ? displayName.toLowerCase().includes(query) : true;
  });

  const showAllItem = !query || 'all'.includes(query);
  const showHeadItem = !query || 'head'.includes(query);

  return (
    <div className="container">
      <div className="tabs">
        <div className={`tab ${activeTab === 'log' ? 'active' : ''}`} onClick={() => { setActiveTab('log'); setSelectedStashIndex(-1); }}>Log</div>
        <div className={`tab ${activeTab === 'local' ? 'active' : ''}`} onClick={() => { setActiveTab('local'); selection.clearSelection(); setIsCompareMode(false); setSelectedStashIndex(-1); }}>
          Local Changes {gitData?.status?.files && gitData.status.files.length > 0 && `(${gitData.status.files.length})`}
        </div>
        <div className={`tab ${activeTab === 'stashes' ? 'active' : ''}`} onClick={() => { setActiveTab('stashes'); selection.clearSelection(); setIsCompareMode(false); setSelectedStashIndex(-1); }}>
          Stashes {gitData?.stashes && gitData.stashes.length > 0 && `(${gitData.stashes.length})`}
        </div>
        <div className={`tab ${activeTab === 'worktrees' ? 'active' : ''}`} onClick={() => { setActiveTab('worktrees'); selection.clearSelection(); setIsCompareMode(false); setSelectedStashIndex(-1); }}>
          Worktrees {gitData?.worktrees && gitData.worktrees.length > 0 && `(${gitData.worktrees.length})`}
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {activeTab === 'log' ? (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
              <div className="header" style={{ justifyContent: 'space-between', position: 'relative' }}>
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
                  {fileFilter && (
                    <div 
                      className="file-filter-badge"
                      title={`Filtering history by file: ${fileFilter}`}
                    >
                      <span className="codicon codicon-file"></span>
                      <span>{fileFilter.split('/').pop()}</span>
                      <span 
                        className="file-filter-badge-close"
                        onClick={() => {
                          setFileFilter('');
                          vscode.postMessage({ type: 'setFileFilter', file: '' });
                        }}
                      >
                        ✕
                      </span>
                    </div>
                  )}
                  <span style={{ marginLeft: '20px' }}>{gitData?.log?.all.length || 0} commits</span>
                </div>

                <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button 
                    className="toolbar-button" 
                    title="Refresh / Fetch Remote"
                    onClick={() => vscode.postMessage({ type: 'fetch' })}
                  >
                    <span className="codicon codicon-refresh"></span>
                  </button>
                  <button 
                    className="toolbar-button" 
                    title="Pull"
                    onClick={() => vscode.postMessage({ type: 'pull' })}
                  >
                    <span className="codicon codicon-cloud-download"></span>
                  </button>
                  <button 
                    className="toolbar-button" 
                    title="Push"
                    onClick={() => vscode.postMessage({ type: 'push' })}
                  >
                    <span className="codicon codicon-cloud-upload"></span>
                  </button>
                  <button 
                    className="toolbar-button" 
                    title={selection.selectedIndices.length > 1 ? `Cherry-pick ${selection.selectedIndices.length} selected commits` : "Cherry-pick selected commit"}
                    disabled={selection.selectedIndices.length === 0}
                    onClick={() => {
                      if (selection.selectedIndices.length > 1) {
                        const sortedIndices = [...selection.selectedIndices].sort((a, b) => b - a); // oldest first
                        const hashes = sortedIndices.map(i => gitData?.log?.all?.[i]?.hash).filter((h): h is string => !!h);
                        vscode.postMessage({ type: 'cherryPickMultiple', hashes });
                      } else if (selectedCommit) {
                        vscode.postMessage({ type: 'cherryPick', hash: selectedCommit.hash });
                      }
                    }}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      style={{ display: 'block' }}
                    >
                      <circle cx="11" cy="18" r="3"/>
                      <circle cx="18" cy="15" r="3"/>
                      <path d="M12.5 15.5 15 7"/>
                      <path d="M19.5 12.5 21 7"/>
                      <path d="M15 7h6.5l-4.5-4.5"/>
                    </svg>
                  </button>
                </div>

                {showBranches && (
                  <div className="branch-popup">
                    <div className="branch-popup-search-container">
                      <input
                        ref={branchSearchInputRef}
                        type="text"
                        className="branch-popup-search-input"
                        placeholder="Search branches & tags..."
                        value={branchSearchQuery}
                        onChange={(e) => setBranchSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="branch-popup-items">
                      {showAllItem && (
                        <div 
                          className={`branch-item ${filterBranch === 'ALL' ? 'active-filter' : ''}`}
                          onClick={() => handleFilter('ALL')}
                        >
                          {filterBranch === 'ALL' && <span style={{ marginRight: '6px' }}>✓</span>}
                          ALL
                        </div>
                      )}
                      {showHeadItem && (
                        <div 
                          className={`branch-item ${filterBranch === 'HEAD' ? 'active-filter' : ''}`}
                          onClick={() => handleFilter('HEAD')}
                        >
                          {filterBranch === 'HEAD' && <span style={{ marginRight: '6px' }}>✓</span>}
                          HEAD
                        </div>
                      )}
                      
                      {filteredPinnedBranches.length > 0 && (
                        <>
                          <div className="branch-group-header">
                            <span className="codicon codicon-pin" style={{ marginRight: '6px', fontSize: '10px' }}></span>
                            Pinned Branches ({filteredPinnedBranches.length})
                          </div>
                          {filteredPinnedBranches.map((bName) => {
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
                      
                      {filteredLocalBranches.length > 0 && (
                        <>
                          <div 
                            className="branch-group-header"
                            onClick={() => setLocalExpanded(!localExpanded)}
                          >
                            <span className={`codicon ${(localExpanded || !!branchSearchQuery) ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} style={{ marginRight: '6px', fontSize: '10px' }}></span>
                            Local Branches ({filteredLocalBranches.length})
                          </div>
                          {(localExpanded || !!branchSearchQuery) && filteredLocalBranches.map((b) => (
                            <div 
                              key={b.name} 
                              className={`branch-item nested ${b.name === filterBranch ? 'active-filter' : ''} ${b.name === gitData?.branches?.current ? 'current' : ''}`}
                              onClick={() => handleFilter(b.name)}
                              onContextMenu={(e) => openContextMenu(e, { kind: 'branch', branch: b.name, isRemote: false })}
                            >
                              {b.name === filterBranch && <span style={{ marginRight: '6px' }}>✓</span>}
                              {b.displayName}
                            </div>
                          ))}
                        </>
                      )}

                      {filteredRemoteBranches.length > 0 && (
                        <>
                          <div 
                            className="branch-group-header"
                            onClick={() => setRemoteExpanded(!remoteExpanded)}
                          >
                            <span className={`codicon ${(remoteExpanded || !!branchSearchQuery) ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} style={{ marginRight: '6px', fontSize: '10px' }}></span>
                            Remote Branches ({filteredRemoteBranches.length})
                          </div>
                          {(remoteExpanded || !!branchSearchQuery) && filteredRemoteBranches.map((b) => (
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
                        </>
                      )}

                      {filteredTags.length > 0 && (
                        <>
                          <div 
                            className="branch-group-header"
                            onClick={() => setTagsExpanded(!tagsExpanded)}
                          >
                            <span className={`codicon ${(tagsExpanded || !!branchSearchQuery) ? 'codicon-chevron-down' : 'codicon-chevron-right'}`} style={{ marginRight: '6px', fontSize: '10px' }}></span>
                            Tags ({filteredTags.length})
                          </div>
                          {(tagsExpanded || !!branchSearchQuery) && filteredTags.map((t) => (
                            <div 
                              key={t} 
                              className={`branch-item nested ${t === filterBranch ? 'active-filter' : ''}`}
                              onClick={() => handleFilter(t)}
                              onContextMenu={(e) => openContextMenu(e, { kind: 'tag', tag: t })}
                            >
                              {t === filterBranch && <span style={{ marginRight: '6px' }}>✓</span>}
                              {t}
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="table-container" style={{ flex: 1, position: 'relative' }}>
                {gitData?.log?.all && (
                  <div style={{ position: 'absolute', top: `${actualTheadHeight}px`, left: 0, pointerEvents: 'none', zIndex: 5 }}>
                    <GitGraph 
                      commits={gitData.log.all} 
                      rowHeight={actualRowHeight} 
                      onWidthChange={setGraphWidth}
                      isLinear={!!fileFilter}
                    />
                  </div>
                )}
                <table style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead ref={theadRef}>
                    <tr>
                      <th style={{ width: `${graphWidth}px` }}>Graph</th>
                      <th style={{ width: `${descWidth}px`, position: 'relative' }}>
                        Description
                        <div 
                          className="resize-handle"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            startColumnResize('desc', e.clientX, descWidth);
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
                            startColumnResize('author', e.clientX, authorWidth);
                          }}
                        />
                      </th>
                      <th style={{ width: `${dateWidth}px`, position: 'relative' }}>
                        Date
                        <div 
                          className="resize-handle"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            startColumnResize('date', e.clientX, dateWidth);
                          }}
                        />
                      </th>
                      <th style={{ width: 'auto', borderRight: 'none' }}></th>
                    </tr>
                  </thead>
                  <tbody ref={tbodyRef}>
                    {gitData?.log?.all.map((commit: any, idx: number) => (
                      <tr 
                        key={commit.hash} 
                        className={selection.selectedIndices.includes(idx) ? 'selected' : ''}
                        onClick={(e) => handleSelectCommit(idx, commit.hash, e)}
                        onMouseDown={(e) => { if (e.shiftKey) e.preventDefault(); }}
                        onContextMenu={(e) => selection.handleRowContextMenu(e, commit, idx, openContextMenu)}
                        onMouseEnter={(e) => handleRowMouseEnter(e, commit)}
                        onMouseMove={handleRowMouseMove}
                        onMouseLeave={handleRowMouseLeave}
                      >
                        <td style={{ width: `${graphWidth}px` }}></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                            <div style={{ display: 'flex', flexWrap: 'nowrap', marginRight: '8px', flexShrink: 0 }}>
                              {renderRefs(commit.refs)}
                            </div>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{commit.message.split('\n')[0]}</span>
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
                        <td>{formatDate(commit.date, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ borderRight: 'none' }}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {selection.selectedIndex >= 0 && (
              <CommitDetailsSidePane
                commit={selectedCommit ?? null}
                files={selectedCommitFiles}
                isCompareMode={isCompareMode}
                filesExpanded={filesExpanded}
                detailsExpanded={detailsExpanded}
                onClose={() => { selection.clearSelection(); setIsCompareMode(false); }}
                onFileClick={handleFileClick}
                onExitCompare={() => {
                  setIsCompareMode(false);
                  if (selectedCommit) {
                    vscode.postMessage({ type: 'getDiff', hash: selectedCommit.hash });
                  }
                }}
                onToggleFiles={() => setFilesExpanded(!filesExpanded)}
                onToggleDetails={() => setDetailsExpanded(!detailsExpanded)}
                renderRefs={renderRefs}
              />
            )}
          </div>
        ) : activeTab === 'stashes' ? (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div className="stash-panel">
              <div className="header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    style={{ background: 'none', border: '1px solid var(--vscode-panel-border)', padding: '2px 8px', fontSize: '10px' }}
                    onClick={() => setShowCreateStash(!showCreateStash)}
                  >
                    Stash Changes...
                  </button>
                  <button
                    style={{ background: 'none', border: '1px solid var(--vscode-panel-border)', padding: '2px 8px', fontSize: '10px' }}
                    onClick={() => vscode.postMessage({ type: 'clearStashes' })}
                    disabled={!gitData?.stashes || gitData.stashes.length === 0}
                  >
                    Clear All
                  </button>
                  <span style={{ marginLeft: '20px' }}>{gitData?.stashes?.length || 0} stashes</span>
                </div>
                <div className="header-actions">
                  <button 
                    className="toolbar-button" 
                    title="Refresh Stash List"
                    onClick={() => vscode.postMessage({ type: 'ready' })}
                  >
                    <span className="codicon codicon-refresh"></span>
                  </button>
                </div>
              </div>

              {showCreateStash && (
                <div className="stash-form-panel">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--vscode-descriptionForeground)' }}>Stash Description</span>
                    <button
                      className="ai-generate-button"
                      title="Generate Stash Description (AI)"
                      onClick={handleGenerateStashAI}
                      disabled={isStashGenerating}
                    >
                      <span className={`codicon ${isStashGenerating ? 'codicon-loading codicon-modifier-spin' : 'codicon-sparkle'}`} style={{ fontSize: '12px' }}></span>
                      {isStashGenerating ? 'Generating...' : 'AI Generate'}
                    </button>
                  </div>
                  <textarea
                    placeholder="Stash description"
                    value={stashMessage}
                    onChange={(e) => setStashMessage(e.target.value)}
                    style={{ height: '60px', resize: 'none' }}
                  />
                  <div className="stash-form-options">
                    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '4px' }}>
                      <input
                        type="checkbox"
                        checked={stashKeepIndex}
                        onChange={(e) => setStashKeepIndex(e.target.checked)}
                        style={{ marginRight: '6px' }}
                      />
                      Keep Staged Changes (Keep Index)
                    </label>
                    <label style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer', gap: '4px' }}>
                      <input
                        type="checkbox"
                        checked={stashIncludeUntracked}
                        onChange={(e) => setStashIncludeUntracked(e.target.checked)}
                        style={{ marginRight: '6px' }}
                      />
                      Include Untracked Files
                    </label>
                  </div>
                  <div className="stash-form-actions">
                    <button onClick={handleCreateStash}>
                      Stash
                    </button>
                    <button className="button-secondary" onClick={() => setShowCreateStash(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="table-container" style={{ flex: 1 }}>
                <table style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '150px' }}>Reference</th>
                      <th style={{ width: 'auto' }}>Message</th>
                      <th style={{ width: '150px' }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gitData?.stashes && gitData.stashes.length > 0 ? (
                      gitData.stashes.map((stash, idx) => (
                        <tr
                          key={stash.hash}
                          className={selectedStashIndex === idx ? 'selected' : ''}
                          onClick={() => handleSelectStash(idx, stash)}
                          onContextMenu={(e) => openContextMenu(e, { kind: 'stash', stash })}
                        >
                          <td>{stash.refName}</td>
                          <td>{stash.message.split('\n')[0]}</td>
                          <td>{formatDate(stash.date, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', opacity: 0.6, padding: '20px 0' }}>No stashes found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedStash && (
              <CommitDetailsSidePane
                commit={{
                  hash: selectedStash.hash,
                  parents: [],
                  refs: selectedStash.refName,
                  message: selectedStash.message,
                  author_name: 'Stash Reference',
                  author_email: selectedStash.refName,
                  date: selectedStash.date
                } as any}
                files={selectedCommitFiles}
                isCompareMode={isCompareMode}
                filesExpanded={filesExpanded}
                detailsExpanded={detailsExpanded}
                onClose={() => { setSelectedStashIndex(-1); setSelectedCommitFiles(null); setIsCompareMode(false); }}
                onFileClick={handleFileClick}
                onExitCompare={() => {
                  setIsCompareMode(false);
                  vscode.postMessage({ type: 'getStashFiles', hash: selectedStash.hash });
                }}
                onToggleFiles={() => setFilesExpanded(!filesExpanded)}
                onToggleDetails={() => setDetailsExpanded(!detailsExpanded)}
                renderRefs={renderRefs}
              />
            )}
          </div>
        ) : activeTab === 'worktrees' ? (
          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            <div className="stash-panel">
              <div className="header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    style={{ background: 'none', border: '1px solid var(--vscode-panel-border)', padding: '2px 8px', fontSize: '10px' }}
                    onClick={() => vscode.postMessage({ type: 'pruneWorktrees' })}
                  >
                    Prune Worktrees
                  </button>
                  <span style={{ marginLeft: '20px' }}>{gitData?.worktrees?.length || 0} worktrees</span>
                </div>
                <div className="header-actions">
                  <button 
                    className="toolbar-button" 
                    title="Refresh Worktree List"
                    onClick={() => vscode.postMessage({ type: 'ready' })}
                  >
                    <span className="codicon codicon-refresh"></span>
                  </button>
                </div>
              </div>

              <div className="table-container" style={{ flex: 1 }}>
                <table style={{ tableLayout: 'fixed', width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 'auto' }}>Path</th>
                      <th style={{ width: '180px' }}>Branch</th>
                      <th style={{ width: '100px' }}>Commit</th>
                      <th style={{ width: '90px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gitData?.worktrees && gitData.worktrees.length > 0 ? (
                      gitData.worktrees.map((wt) => (
                        <tr key={wt.path}>
                          <td style={{ borderRight: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={wt.path}>
                            {wt.isMain && (
                              <span className="label-pill label-branch" style={{ cursor: 'default', margin: '0 6px 0 0', padding: '1px 4px', fontSize: '9px' }}>Main</span>
                            )}
                            {wt.path}
                          </td>
                          <td>{wt.branch}</td>
                          <td>{wt.commit ? wt.commit.substring(0, 7) : ''}</td>
                          <td style={{ textAlign: 'center', padding: '0 4px', borderRight: 'none' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center', height: '100%' }}>
                              <button
                                className="toolbar-button"
                                title="Open in New Window"
                                onClick={() => vscode.postMessage({ type: 'openWorktree', path: wt.path })}
                                style={{ padding: '2px', background: 'transparent', border: 'none', display: 'inline-flex' }}
                              >
                                <span className="codicon codicon-open-in-window" style={{ fontSize: '14px' }}></span>
                              </button>
                              {!wt.isMain && (
                                <button
                                  className="toolbar-button"
                                  title="Remove Worktree"
                                  onClick={() => vscode.postMessage({ type: 'removeWorktree', path: wt.path })}
                                  style={{ padding: '2px', background: 'transparent', border: 'none', display: 'inline-flex', color: 'var(--vscode-errorForeground)' }}
                                >
                                  <span className="codicon codicon-trash" style={{ fontSize: '14px' }}></span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'center', opacity: 0.6, padding: '20px 0' }}>No worktrees found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <LocalChangesPanel
            files={gitData?.status?.files || []}
            checkedFiles={checkedFiles}
            commitBoxHeight={commitBoxHeight}
            onCheckChange={handleCheckChange}
            onFileClick={handleLocalFileClick}
            onDiscard={handleDiscard}
            onCommit={(message, files) => {
              vscode.postMessage({ type: 'commit', message, files });
            }}
            onCommitAndPush={(message, files, force) => {
              vscode.postMessage({ type: 'commitAndPush', message, files, force });
            }}
            onGenerateAI={(files) => {
              setIsGenerating(true);
              vscode.postMessage({ type: 'generateCommitMessage', files });
            }}
            onStartResizeCommitBox={startCommitBoxResize}
            isGenerating={isGenerating}
            commitMessage={commitMessage}
            onCommitMessageChange={setCommitMessage}
            onGenerateResult={setCommitMessage}
          />
        )}
      </div>
      {authorPopupPos && gitData?.authors && (
        <div className="branch-popup" style={{ top: authorPopupPos.y, left: authorPopupPos.x, position: 'fixed' }}>
          <div className="branch-popup-items">
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
        </div>
      )}
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={
            menuState.kind === 'commit'
              ? getCommitMenuItems()
              : menuState.kind === 'branch'
                ? getBranchMenuItems()
                : menuState.kind === 'tag'
                  ? getTagMenuItems()
                  : getStashMenuItems()
          }
          onAction={handleMenuAction}
          onClose={handleCloseMenu}
        />
      )}
      {hoveredCommit && (
        <CommitHoverPopup
          commit={hoveredCommit.commit}
          x={hoveredCommit.x}
          y={hoveredCommit.y}
        />
      )}
    </div>
  );
}

export default App;
