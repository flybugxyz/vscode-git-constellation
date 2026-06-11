import React, { useState, useRef } from 'react';
import { useGitData } from '../GitDataContext';
import { MenuActionData } from '../types';

interface SidebarProps {
  openContextMenu: (e: React.MouseEvent, data: MenuActionData) => void;
}

export function Sidebar({ openContextMenu }: SidebarProps) {
  const { gitData, vscode, filterBranch, setFilterBranch, pinnedBranches } = useGitData();
  
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const [localExpanded, setLocalExpanded] = useState(true);
  const [remoteExpanded, setRemoteExpanded] = useState(false);
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const branchSearchInputRef = useRef<HTMLInputElement>(null);

  const handleFilter = (branch: string) => {
    setFilterBranch(branch);
    vscode.postMessage({ type: 'setFilter', branch });
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

  const activeRepo = gitData?.repositories?.find(r => r.path === gitData.activeRepo);
  const activeRepoName = activeRepo ? activeRepo.name : '';

  return (
    <div className="left-sidebar">
      {gitData?.repositories && gitData.repositories.length > 1 && (
        <div className="sidebar-section">
          <div className="sidebar-section-header">
            <span className="codicon codicon-repo" style={{ marginRight: '6px' }}></span>
            Repositories
          </div>
          <div className="sidebar-section-content">
            {gitData.repositories.map(repo => (
              <div 
                key={repo.path}
                className={`repo-item ${gitData.activeRepo === repo.path ? 'active' : ''}`}
                onClick={() => vscode.postMessage({ type: 'setActiveRepo', path: repo.path })}
                title={repo.path}
              >
                <span className={`codicon ${repo.isMain ? 'codicon-root-folder' : 'codicon-folder-library'}`} style={{ marginRight: '6px', fontSize: '14px' }}></span>
                <span className="repo-name">{repo.name}</span>
                {repo.isMain && <span className="repo-badge">Main</span>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="sidebar-section flex-1">
        <div className="sidebar-section-header">
          <span className="codicon codicon-git-branch" style={{ marginRight: '6px' }}></span>
          Branches
        </div>
        <div className="sidebar-section-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
                  Local Branches {activeRepoName ? `(${activeRepoName})` : ''} ({filteredLocalBranches.length})
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
                  Remote Branches {activeRepoName ? `(${activeRepoName})` : ''} ({filteredRemoteBranches.length})
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
                  Tags {activeRepoName ? `(${activeRepoName})` : ''} ({filteredTags.length})
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
      </div>
    </div>
  );
}
