import { describe, it, expect, vi } from 'vitest';
import {
  dispatchMenuAction,
  getCommitMenuItems,
  getBranchMenuItems,
  getTagMenuItems,
  getStashMenuItems,
  MenuActionCallbacks,
} from '../contextMenuActions';
import type { MenuState } from '../App';
import type { Commit } from '../types';
import type { MenuEntry, MenuItem } from '../ContextMenu';

function createCallbacks(overrides?: Partial<MenuActionCallbacks>): MenuActionCallbacks {
  return {
    postMessage: vi.fn(),
    setSelectedIndex: vi.fn(),
    setActiveTab: vi.fn(),
    setFilesExpanded: vi.fn(),
    setDetailsExpanded: vi.fn(),
    setPinnedBranches: vi.fn(),
    handleFilter: vi.fn(),
    getAllCommitHashes: vi.fn((indices: number[]) => indices.map(i => `hash-${i}`)),
    selectedIndices: [0],
    ...overrides,
  };
}

const sampleCommit: Commit = {
  hash: 'abc123def456',
  parents: ['parent1'],
  refs: 'main',
  message: 'feat: add feature',
  author_name: 'Test',
  author_email: 'test@example.com',
  date: '1700000000',
};

describe('dispatchMenuAction', () => {
  describe('shared actions', () => {
    it('compareWithCurrent should call compareRef and setSelectedIndex for commits', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'commit', commit: sampleCommit, index: 3, x: 0, y: 0 };

      dispatchMenuAction(menu, 'compareWithCurrent', cb);

      expect(cb.setSelectedIndex).toHaveBeenCalledWith(3);
      expect(cb.postMessage).toHaveBeenCalledWith({ type: 'compareRef', ref: 'abc123def456' });
    });

    it('compareWithCurrent should NOT call setSelectedIndex for branches', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'branch', branch: 'main', isRemote: false, x: 0, y: 0 };

      dispatchMenuAction(menu, 'compareWithCurrent', cb);

      expect(cb.setSelectedIndex).not.toHaveBeenCalled();
      expect(cb.postMessage).toHaveBeenCalledWith({ type: 'compareRef', ref: 'main' });
    });

    it('openInBrowser uses correct refType', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'tag', tag: 'v1.0', x: 0, y: 0 };

      dispatchMenuAction(menu, 'openInBrowser', cb);

      expect(cb.postMessage).toHaveBeenCalledWith({ type: 'openRefInBrowser', ref: 'v1.0', refType: 'tag' });
    });

    it.each(['createBranchFrom', 'mergeRef', 'rebaseRef'])('shared action %s posts message', (action) => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'branch', branch: 'develop', isRemote: false, x: 0, y: 0 };

      dispatchMenuAction(menu, action, cb);

      expect(cb.postMessage).toHaveBeenCalled();
    });
  });

  describe('commit-specific actions', () => {
    it('copySHA posts correct message', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'commit', commit: sampleCommit, index: 0, x: 0, y: 0 };

      dispatchMenuAction(menu, 'copySHA', cb);

      expect(cb.postMessage).toHaveBeenCalledWith({ type: 'copySHA', hash: 'abc123def456' });
    });

    it('copyMessage posts commit message', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'commit', commit: sampleCommit, index: 0, x: 0, y: 0 };

      dispatchMenuAction(menu, 'copyMessage', cb);

      expect(cb.postMessage).toHaveBeenCalledWith({ type: 'copyMessage', message: 'feat: add feature' });
    });

    it('cherryPick single commit', () => {
      const cb = createCallbacks({ selectedIndices: [2] });
      const menu: MenuState = { kind: 'commit', commit: sampleCommit, index: 2, x: 0, y: 0 };

      dispatchMenuAction(menu, 'cherryPick', cb);

      expect(cb.postMessage).toHaveBeenCalledWith({ type: 'cherryPick', hash: 'abc123def456' });
    });

    it('cherryPick multiple commits uses getAllCommitHashes', () => {
      const cb = createCallbacks({ selectedIndices: [1, 3, 5] });
      const menu: MenuState = { kind: 'commit', commit: sampleCommit, index: 1, x: 0, y: 0 };

      dispatchMenuAction(menu, 'cherryPick', cb);

      expect(cb.getAllCommitHashes).toHaveBeenCalled();
      expect(cb.postMessage).toHaveBeenCalledWith({
        type: 'cherryPickMultiple',
        hashes: ['hash-5', 'hash-3', 'hash-1'],
      });
    });

    it('squashCommits sends sorted hashes', () => {
      const cb = createCallbacks({ selectedIndices: [2, 4] });
      const menu: MenuState = { kind: 'commit', commit: sampleCommit, index: 2, x: 0, y: 0 };

      dispatchMenuAction(menu, 'squashCommits', cb);

      expect(cb.getAllCommitHashes).toHaveBeenCalled();
      expect(cb.postMessage).toHaveBeenCalledWith({
        type: 'squashCommits',
        hashes: ['hash-4', 'hash-2'],
      });
    });

    it('rewordCommit posts correct message', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'commit', commit: sampleCommit, index: 0, x: 0, y: 0 };

      dispatchMenuAction(menu, 'rewordCommit', cb);

      expect(cb.postMessage).toHaveBeenCalledWith({ type: 'rewordCommit', hash: 'abc123def456' });
    });

    it('viewDetails sets UI state and fetches diff', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'commit', commit: sampleCommit, index: 5, x: 0, y: 0 };

      dispatchMenuAction(menu, 'viewDetails', cb);

      expect(cb.setSelectedIndex).toHaveBeenCalledWith(5);
      expect(cb.setActiveTab).toHaveBeenCalledWith('log');
      expect(cb.setFilesExpanded).toHaveBeenCalledWith(true);
      expect(cb.setDetailsExpanded).toHaveBeenCalledWith(true);
      expect(cb.postMessage).toHaveBeenCalledWith({ type: 'getDiff', hash: 'abc123def456' });
    });

    it('does nothing for commit actions when menu kind is branch', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'branch', branch: 'main', isRemote: false, x: 0, y: 0 };

      dispatchMenuAction(menu, 'copySHA', cb);

      // Only shared actions would match; copySHA is commit-specific, so postMessage should not be called
      expect(cb.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('branch-specific actions', () => {
    it('checkoutBranch posts correct message', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'branch', branch: 'feature/test', isRemote: false, x: 0, y: 0 };

      dispatchMenuAction(menu, 'checkoutBranch', cb);

      expect(cb.postMessage).toHaveBeenCalledWith({ type: 'checkoutBranch', branch: 'feature/test' });
    });

    it('deleteBranch includes isRemote flag', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'branch', branch: 'origin/main', isRemote: true, x: 0, y: 0 };

      dispatchMenuAction(menu, 'deleteBranch', cb);

      expect(cb.postMessage).toHaveBeenCalledWith({ type: 'deleteBranch', branch: 'origin/main', isRemote: true });
    });

    it('pinBranch calls setPinnedBranches', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'branch', branch: 'main', isRemote: false, x: 0, y: 0 };

      dispatchMenuAction(menu, 'pinBranch', cb);

      expect(cb.setPinnedBranches).toHaveBeenCalled();
      // Verify the updater function adds the branch
      const updater = (cb.setPinnedBranches as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const result = updater(new Set<string>());
      expect(result.has('main')).toBe(true);
    });

    it('unpinBranch calls setPinnedBranches with removal', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'branch', branch: 'main', isRemote: false, x: 0, y: 0 };

      dispatchMenuAction(menu, 'unpinBranch', cb);

      const updater = (cb.setPinnedBranches as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const result = updater(new Set(['main', 'develop']));
      expect(result.has('main')).toBe(false);
      expect(result.has('develop')).toBe(true);
    });

    it('showInGraph calls handleFilter', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'branch', branch: 'develop', isRemote: false, x: 0, y: 0 };

      dispatchMenuAction(menu, 'showInGraph', cb);

      expect(cb.handleFilter).toHaveBeenCalledWith('develop');
    });
  });

  describe('tag-specific actions', () => {
    it('viewTagDetails posts correct message', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'tag', tag: 'v2.0.0', x: 0, y: 0 };

      dispatchMenuAction(menu, 'viewTagDetails', cb);

      expect(cb.postMessage).toHaveBeenCalledWith({ type: 'viewTagDetails', tag: 'v2.0.0' });
    });

    it('copyTagName posts correct message', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'tag', tag: 'v1.0.0', x: 0, y: 0 };

      dispatchMenuAction(menu, 'copyTagName', cb);

      expect(cb.postMessage).toHaveBeenCalledWith({ type: 'copyTagName', tag: 'v1.0.0' });
    });

    it('deleteTag posts correct message', () => {
      const cb = createCallbacks();
      const menu: MenuState = { kind: 'tag', tag: 'v0.9', x: 0, y: 0 };

      dispatchMenuAction(menu, 'deleteTag', cb);

      expect(cb.postMessage).toHaveBeenCalledWith({ type: 'deleteTag', tag: 'v0.9' });
    });
  });
});

describe('getCommitMenuItems', () => {
  it('returns correct items for single selection', () => {
    const items = getCommitMenuItems(1, false);
    const menuItems = items.filter((i): i is MenuItem => 'label' in i);

    expect(menuItems.some(i => i.label === 'Cherry Pick')).toBe(true);
    expect(menuItems.find(i => i.action === 'copySHA')?.disabled).toBeFalsy();
  });

  it('returns multi-select label when count > 1', () => {
    const items = getCommitMenuItems(3, false);
    const menuItems = items.filter((i): i is MenuItem => 'label' in i);

    expect(menuItems.some(i => i.label === 'Cherry Pick 3 Commits')).toBe(true);
    // Top-level items should be disabled for multi-select
    expect(menuItems.find(i => i.action === 'createBranchFrom')?.disabled).toBe(true);
    // copySHA is inside a submenu, verify it's disabled there
    const copySubmenu = menuItems.find(i => i.label === 'Copy')?.submenu;
    expect(copySubmenu?.find(s => 'action' in s && s.action === 'copySHA')?.disabled).toBe(true);
  });

  it('enables squash when canSquash is true', () => {
    const items = getCommitMenuItems(2, true);
    const squash = (items.filter((i): i is MenuItem => 'label' in i)).find(i => i.action === 'squashCommits');

    expect(squash?.disabled).toBe(false);
  });

  it('disables squash when canSquash is false', () => {
    const items = getCommitMenuItems(2, false);
    const squash = (items.filter((i): i is MenuItem => 'label' in i)).find(i => i.action === 'squashCommits');

    expect(squash?.disabled).toBe(true);
  });

  it('has Copy submenu with 4 items', () => {
    const items = getCommitMenuItems(1, false);
    const copyItem = (items.filter((i): i is MenuItem => 'label' in i)).find(i => i.label === 'Copy');

    expect(copyItem?.submenu).toHaveLength(4);
  });

  it('includes Edit Commit Message... action', () => {
    const items = getCommitMenuItems(1, false);
    const menuItems = items.filter((i): i is MenuItem => 'label' in i);
    const rewordItem = menuItems.find(i => i.action === 'rewordCommit');

    expect(rewordItem).toBeDefined();
    expect(rewordItem?.label).toBe('Edit Commit Message...');
    expect(rewordItem?.disabled).toBe(false);
  });

  it('disables Edit Commit Message... action for multi-select', () => {
    const items = getCommitMenuItems(3, false);
    const menuItems = items.filter((i): i is MenuItem => 'label' in i);
    const rewordItem = menuItems.find(i => i.action === 'rewordCommit');

    expect(rewordItem?.disabled).toBe(true);
  });
});

describe('getBranchMenuItems', () => {
  it('disables checkout for current branch', () => {
    const items = getBranchMenuItems('main', false, true, false);
    const checkout = (items.filter((i): i is MenuItem => 'label' in i)).find(i => i.action === 'checkoutBranch');

    expect(checkout?.disabled).toBe(true);
  });

  it('enables checkout for non-current branch', () => {
    const items = getBranchMenuItems('develop', false, false, false);
    const checkout = (items.filter((i): i is MenuItem => 'label' in i)).find(i => i.action === 'checkoutBranch');

    expect(checkout?.disabled).toBe(false);
  });

  it('shows Unpin when branch is pinned', () => {
    const items = getBranchMenuItems('main', false, false, true);
    const menuItems = items.filter((i): i is MenuItem => 'label' in i);

    expect(menuItems.some(i => i.label === 'Unpin Branch')).toBe(true);
    expect(menuItems.some(i => i.label === 'Pin Branch')).toBe(false);
  });

  it('shows Pin when branch is not pinned', () => {
    const items = getBranchMenuItems('main', false, false, false);
    const menuItems = items.filter((i): i is MenuItem => 'label' in i);

    expect(menuItems.some(i => i.label === 'Pin Branch')).toBe(true);
    expect(menuItems.some(i => i.label === 'Unpin Branch')).toBe(false);
  });

  it('hides rename for remote branches', () => {
    const items = getBranchMenuItems('origin/main', true, false, false);
    const rename = (items.filter((i): i is MenuItem => 'label' in i)).find(i => i.action === 'renameBranch');

    expect(rename?.hidden).toBe(true);
  });
});

describe('getTagMenuItems', () => {
  it('returns 7 items including separators', () => {
    const items = getTagMenuItems();
    expect(items).toHaveLength(7);
  });

  it('includes View Tag Details as first item', () => {
    const items = getTagMenuItems();
    const first = items[0] as MenuItem;
    expect(first.label).toBe('View Tag Details');
  });

  it('marks Delete Tag as danger', () => {
    const items = getTagMenuItems();
    const deleteItem = (items.filter((i): i is MenuItem => 'label' in i)).find(i => i.action === 'deleteTag');
    expect(deleteItem?.danger).toBe(true);
  });
});

describe('stash-specific actions', () => {
  const sampleStash = {
    hash: 'stash-hash-123',
    refName: 'stash@{0}',
    message: 'WIP on main: stash message',
    date: '1700000000',
  };

  it('applyStash posts correct message', () => {
    const cb = createCallbacks();
    const menu = { kind: 'stash', stash: sampleStash, x: 0, y: 0 } as any;

    dispatchMenuAction(menu, 'applyStash', cb);

    expect(cb.postMessage).toHaveBeenCalledWith({ type: 'applyStash', refName: 'stash@{0}' });
  });

  it('popStash posts correct message', () => {
    const cb = createCallbacks();
    const menu = { kind: 'stash', stash: sampleStash, x: 0, y: 0 } as any;

    dispatchMenuAction(menu, 'popStash', cb);

    expect(cb.postMessage).toHaveBeenCalledWith({ type: 'popStash', refName: 'stash@{0}' });
  });

  it('dropStash posts correct message', () => {
    const cb = createCallbacks();
    const menu = { kind: 'stash', stash: sampleStash, x: 0, y: 0 } as any;

    dispatchMenuAction(menu, 'dropStash', cb);

    expect(cb.postMessage).toHaveBeenCalledWith({ type: 'dropStash', refName: 'stash@{0}' });
  });

  it('copySHA posts correct message', () => {
    const cb = createCallbacks();
    const menu = { kind: 'stash', stash: sampleStash, x: 0, y: 0 } as any;

    dispatchMenuAction(menu, 'copySHA', cb);

    expect(cb.postMessage).toHaveBeenCalledWith({ type: 'copySHA', hash: 'stash-hash-123' });
  });

  it('copyMessage posts correct message', () => {
    const cb = createCallbacks();
    const menu = { kind: 'stash', stash: sampleStash, x: 0, y: 0 } as any;

    dispatchMenuAction(menu, 'copyMessage', cb);

    expect(cb.postMessage).toHaveBeenCalledWith({ type: 'copyMessage', message: 'WIP on main: stash message' });
  });
});

describe('getStashMenuItems', () => {
  it('returns 6 items including separators', () => {
    const items = getStashMenuItems();
    expect(items).toHaveLength(6);
  });

  it('includes Apply Stash as first item', () => {
    const items = getStashMenuItems();
    const first = items[0] as MenuItem;
    expect(first.label).toBe('Apply Stash');
  });

  it('marks Drop Stash as danger', () => {
    const items = getStashMenuItems();
    const deleteItem = (items.filter((i): i is MenuItem => 'label' in i)).find(i => i.action === 'dropStash');
    expect(deleteItem?.danger).toBe(true);
  });
});

