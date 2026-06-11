import React, { useEffect, useState, useRef } from 'react';
import './styles.css';
import { ContextMenu, MenuEntry } from './ContextMenu';
import { CommitHoverPopup } from './CommitHoverPopup';
import { Commit, GitStatusFile, GitData, Stash } from './types';
import {
  dispatchMenuAction,
  getCommitMenuItems as buildCommitMenuItems,
  getBranchMenuItems as buildBranchMenuItems,
  getTagMenuItems as buildTagMenuItems,
  getStashMenuItems as buildStashMenuItems,
} from './contextMenuActions';
import { useResizable } from './hooks/useResizable';
import { useCommitSelection } from './hooks/useCommitSelection';

import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar } from './components/Sidebar';
import { LogTab } from './components/LogTab';
import { LocalChangesTab } from './components/LocalChangesTab';
import { StashTab } from './components/StashTab';
import { WorktreeTab } from './components/WorktreeTab';

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
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [commitActionState, setCommitActionState] = useState<'commit' | 'commitAndPush' | null>(null);
  const [hasMoreCommits, setHasMoreCommits] = useState(true);
  const [commitMessage, setCommitMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [filterBranch, setFilterBranch] = useState<string>('ALL');
  const [filterAuthor, setFilterAuthor] = useState<string>('ALL');
  const [authorPopupPos, setAuthorPopupPos] = useState<{ x: number, y: number } | null>(null);

  const [branchSearchQuery, setBranchSearchQuery] = useState<string>('');
  const branchSearchInputRef = useRef<HTMLInputElement>(null);

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
          setHasMoreCommits(true);
          setIsFetchingMore(false);
          setIsFetching(false);
          setIsPulling(false);
          setIsPushing(false);
          setCommitActionState(null);
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
        case 'appendCommits':
          setIsFetchingMore(false);
          if (message.payload?.log?.all) {
            const newCommits = message.payload.log.all;
            if (newCommits.length < 100) {
              setHasMoreCommits(false);
            }
            setGitData(prev => {
              if (!prev || !prev.log) return prev;
              return {
                ...prev,
                log: {
                  ...prev.log,
                  all: [...prev.log.all, ...newCommits]
                }
              };
            });
          } else {
            setHasMoreCommits(false);
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
          // CR-001: Added optional chaining to prevent crash if all is undefined
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
    // CR-001: Safe dependencies mapping
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

  const handleCloseMenu = React.useCallback(() => setMenuState(null), []);

  const openContextMenu = (
    e: React.MouseEvent,
    data: Omit<CommitMenu, 'x' | 'y'> | Omit<BranchMenu, 'x' | 'y'> | Omit<TagMenu, 'x' | 'y'> | Omit<StashMenu, 'x' | 'y'>
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuState({
      ...data,
      x: e.clientX,
      y: e.clientY
    } as MenuState);
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

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 50) {
      if (!isFetchingMore && hasMoreCommits) {
        setIsFetchingMore(true);
        vscode.postMessage({ type: 'loadMoreCommits', skip: gitData?.log?.all?.length || 0 });
      }
    }
  };

  return (
    <ErrorBoundary vscode={vscode}>
      <div className="container" style={{ display: 'flex', flexDirection: 'row' }}>
        <Sidebar
          gitData={gitData}
          vscode={vscode}
          filterBranch={filterBranch}
          handleFilter={handleFilter}
          branchSearchQuery={branchSearchQuery}
          setBranchSearchQuery={setBranchSearchQuery}
          branchSearchInputRef={branchSearchInputRef}
          localExpanded={localExpanded}
          setLocalExpanded={setLocalExpanded}
          remoteExpanded={remoteExpanded}
          setRemoteExpanded={setRemoteExpanded}
          tagsExpanded={tagsExpanded}
          setTagsExpanded={setTagsExpanded}
          pinnedBranches={pinnedBranches}
          openContextMenu={openContextMenu}
        />
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
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
              <LogTab
                gitData={gitData}
                vscode={vscode}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                handleSearch={handleSearch}
                fileFilter={fileFilter}
                setFileFilter={setFileFilter}
                isFetching={isFetching}
                setIsFetching={setIsFetching}
                isPulling={isPulling}
                setIsPulling={setIsPulling}
                isPushing={isPushing}
                setIsPushing={setIsPushing}
                isCompareMode={isCompareMode}
                setIsCompareMode={setIsCompareMode}
                selectedCommitFiles={selectedCommitFiles}
                filesExpanded={filesExpanded}
                setFilesExpanded={setFilesExpanded}
                detailsExpanded={detailsExpanded}
                setDetailsExpanded={setDetailsExpanded}
                graphWidth={graphWidth}
                setGraphWidth={setGraphWidth}
                descWidth={descWidth}
                authorWidth={authorWidth}
                dateWidth={dateWidth}
                startColumnResize={startColumnResize}
                actualTheadHeight={actualTheadHeight}
                actualRowHeight={actualRowHeight}
                theadRef={theadRef}
                tbodyRef={tbodyRef}
                selection={selection}
                handleRowMouseEnter={handleRowMouseEnter}
                handleRowMouseMove={handleRowMouseMove}
                handleRowMouseLeave={handleRowMouseLeave}
                handleTableScroll={handleTableScroll}
                renderRefs={renderRefs}
                openContextMenu={openContextMenu}
                isFetchingMore={isFetchingMore}
              />
            ) : activeTab === 'stashes' ? (
              <StashTab
                gitData={gitData}
                vscode={vscode}
                selectedStashIndex={selectedStashIndex}
                setSelectedStashIndex={setSelectedStashIndex}
                showCreateStash={showCreateStash}
                setShowCreateStash={setShowCreateStash}
                stashMessage={stashMessage}
                setStashMessage={setStashMessage}
                stashKeepIndex={stashKeepIndex}
                setStashKeepIndex={setStashKeepIndex}
                stashIncludeUntracked={stashIncludeUntracked}
                setStashIncludeUntracked={setStashIncludeUntracked}
                isStashGenerating={isStashGenerating}
                setIsStashGenerating={setIsStashGenerating}
                checkedFiles={checkedFiles}
                selectedCommitFiles={selectedCommitFiles}
                setSelectedCommitFiles={setSelectedCommitFiles}
                isCompareMode={isCompareMode}
                setIsCompareMode={setIsCompareMode}
                filesExpanded={filesExpanded}
                setFilesExpanded={setFilesExpanded}
                detailsExpanded={detailsExpanded}
                setDetailsExpanded={setDetailsExpanded}
                openContextMenu={openContextMenu}
                renderRefs={renderRefs}
              />
            ) : activeTab === 'worktrees' ? (
              <WorktreeTab
                gitData={gitData}
                vscode={vscode}
              />
            ) : (
              <LocalChangesTab
                files={gitData?.status?.files || []}
                checkedFiles={checkedFiles}
                commitBoxHeight={commitBoxHeight}
                onCheckChange={handleCheckChange}
                onFileClick={handleLocalFileClick}
                onDiscard={handleDiscard}
                onCommit={(message, files) => {
                  setCommitActionState('commit');
                  vscode.postMessage({ type: 'commit', message, files });
                }}
                onCommitAndPush={(message, files, force) => {
                  setCommitActionState('commitAndPush');
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
                commitActionState={commitActionState}
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
      </div>
    </ErrorBoundary>
  );
}

export default App;
