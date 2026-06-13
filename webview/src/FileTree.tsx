import React, { useState, useEffect, useRef } from 'react';

interface FileInfo {
  status: string;
  path: string;
}

interface FileTreeProps {
  files: FileInfo[];
  onFileClick?: (path: string) => void;
  checkboxes?: boolean;
  checkedPaths?: Set<string>;
  onCheckChange?: (path: string, checked: boolean, filePaths: string[]) => void;
  onDiscard?: (path: string) => void;
  rootNodeName?: string;
  expandedNodes?: Set<string>;
  setExpandedNodes?: React.Dispatch<React.SetStateAction<Set<string>>>;
  onFileContextMenu?: (path: string, event: React.MouseEvent) => void;
}

interface TreeNode {
  name: string;
  fullPath: string;
  children: { [key: string]: TreeNode };
  isFile: boolean;
  status?: string;
}

const IndeterminateCheckbox: React.FC<{
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}> = ({ checked, indeterminate, onChange }) => {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      type="checkbox"
      ref={ref}
      checked={checked}
      onChange={onChange}
      style={{
        marginRight: '6px',
        cursor: 'pointer',
        width: '13px',
        height: '13px',
        flexShrink: 0
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
};

const getFileIconPath = (fileName: string, isExpanded: boolean = false, isFile: boolean = true): string => {
  if (!isFile) {
    return isExpanded ? 'antigravity-icons/folders/folder-open.svg' : 'antigravity-icons/folders/folder.svg';
  }

  const ext = fileName.split('.').pop()?.toLowerCase();
  let iconName = 'document.svg';

  switch (ext) {
    case 'ts': iconName = 'ts.svg'; break;
    case 'tsx': iconName = 'react-ts.svg'; break;
    case 'js': iconName = 'js.svg'; break;
    case 'jsx': iconName = 'react.svg'; break;
    case 'py': iconName = 'python.svg'; break;
    case 'go': iconName = 'go.svg'; break;
    case 'rs': iconName = 'rust.svg'; break;
    case 'java': iconName = 'java.svg'; break;
    case 'c': iconName = 'c.svg'; break;
    case 'cpp': iconName = 'cplus.svg'; break;
    case 'h': iconName = 'h.svg'; break;
    case 'json': iconName = 'brackets-yellow.svg'; break;
    case 'md': iconName = 'markdown.svg'; break;
    case 'css':
    case 'scss':
    case 'less': iconName = 'code-blue.svg'; break;
    case 'html': iconName = 'code-orange.svg'; break;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg': iconName = 'image.svg'; break;
    case 'yaml':
    case 'yml': iconName = 'yaml.svg'; break;
    case 'xml': iconName = 'xml.svg'; break;
    case 'sh':
    case 'bash':
    case 'bat': iconName = 'shell.svg'; break;
    case 'pdf': iconName = 'pdf.svg'; break;
    case 'zip':
    case 'tar':
    case 'gz': iconName = 'archive.svg'; break;
    default: iconName = 'document.svg'; break;
  }

  return `antigravity-icons/files/${iconName}`;
};

export const FileTree: React.FC<FileTreeProps> = ({ 
  files, 
  onFileClick, 
  checkboxes = false, 
  checkedPaths, 
  onCheckChange,
  onDiscard,
  rootNodeName,
  expandedNodes: propsExpandedNodes,
  setExpandedNodes: propsSetExpandedNodes,
  onFileContextMenu
}) => {
  const [localExpandedNodes, setLocalExpandedNodes] = useState<Set<string>>(new Set());
  const expandedNodes = propsExpandedNodes || localExpandedNodes;
  const setExpandedNodes = propsSetExpandedNodes || setLocalExpandedNodes;
  const seenDirs = useRef<Set<string>>(new Set());

  useEffect(() => {
    setExpandedNodes(prev => {
      const newExpanded = new Set(prev);
      let changed = false;

      const allDirs = new Set<string>();
      files.forEach(file => {
        const parts = file.path.split('/');
        let currentPath = '';
        for (let i = 0; i < parts.length - 1; i++) {
          currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
          allDirs.add(currentPath);
        }
      });
      if (rootNodeName) {
        allDirs.add(rootNodeName);
      }

      allDirs.forEach(dir => {
        if (!seenDirs.current.has(dir)) {
          seenDirs.current.add(dir);
          newExpanded.add(dir);
          changed = true;
        }
      });

      return changed ? newExpanded : prev;
    });
  }, [files, rootNodeName]);

  const buildTree = (fileList: FileInfo[]): TreeNode => {
    const root: TreeNode = { name: '', fullPath: '', children: {}, isFile: false };
    
    fileList.forEach(file => {
      const parts = file.path.split('/');
      let current = root;
      let currentPath = '';
      
      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            fullPath: currentPath,
            children: {},
            isFile: index === parts.length - 1,
            status: index === parts.length - 1 ? file.status : undefined
          };
        }
        current = current.children[part];
      });
    });
    
    if (rootNodeName) {
      return {
        name: '',
        fullPath: '',
        children: {
          [rootNodeName]: {
            name: rootNodeName,
            fullPath: rootNodeName,
            children: root.children,
            isFile: false
          }
        },
        isFile: false
      };
    }
    
    return root;
  };

  const toggleNode = (fullPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(fullPath)) {
      newExpanded.delete(fullPath);
    } else {
      newExpanded.add(fullPath);
    }
    setExpandedNodes(newExpanded);
  };

  const getStatusClass = (status?: string) => {
    switch (status) {
      case 'A': return 'status-added';
      case 'M': return 'status-modified';
      case 'D': return 'status-deleted';
      case 'R': return 'status-renamed';
      case '?': return 'status-untracked';
      case 'U': return 'status-conflicted';
      default: return '';
    }
  };

  const getFilePathsUnderNode = (node: TreeNode): string[] => {
    if (node.isFile) {
      return [node.fullPath];
    }
    let paths: string[] = [];
    for (const childName in node.children) {
      paths = paths.concat(getFilePathsUnderNode(node.children[childName]));
    }
    return paths;
  };

  const renderNodes = (nodes: { [key: string]: TreeNode }, depth: number = 0) => {
    const sortedKeys = Object.keys(nodes).sort((a, b) => {
      if (nodes[a].isFile !== nodes[b].isFile) {
        return nodes[a].isFile ? 1 : -1;
      }
      return a.localeCompare(b);
    });

    return sortedKeys.map(key => {
      const node = nodes[key];
      const isExpanded = expandedNodes.has(node.fullPath);
      const hasChildren = Object.keys(node.children).length > 0;

      let checkboxState: 'checked' | 'unchecked' | 'indeterminate' = 'unchecked';
      let filesUnder: string[] = [];
      if (checkboxes && checkedPaths) {
        filesUnder = getFilePathsUnderNode(node);
        const checkedUnder = filesUnder.filter(p => checkedPaths.has(p));
        if (checkedUnder.length === filesUnder.length) {
          checkboxState = 'checked';
        } else if (checkedUnder.length > 0) {
          checkboxState = 'indeterminate';
        }
      }

      return (
        <div key={node.fullPath} className="tree-node-container">
          <div 
            className={`tree-item ${getStatusClass(node.status)}`} 
            style={{ paddingLeft: `${depth * 12}px` }}
            onClick={() => node.isFile ? (onFileClick && onFileClick(node.fullPath)) : toggleNode(node.fullPath, {} as any)}
            onContextMenu={(e) => {
              if (onFileContextMenu) {
                onFileContextMenu(node.fullPath, e);
              }
            }}
          >
            <span 
              className={`tree-chevron codicon ${!node.isFile && hasChildren ? (isExpanded ? 'codicon-chevron-down' : 'codicon-chevron-right') : ''}`}
              style={{ width: '16px', visibility: !node.isFile && hasChildren ? 'visible' : 'hidden' }}
              onClick={(e) => !node.isFile && toggleNode(node.fullPath, e)}
            ></span>
            {checkboxes && (
              <IndeterminateCheckbox
                checked={checkboxState === 'checked'}
                indeterminate={checkboxState === 'indeterminate'}
                onChange={() => {
                  if (onCheckChange) {
                    const targetChecked = checkboxState !== 'checked';
                    onCheckChange(node.fullPath, targetChecked, filesUnder);
                  }
                }}
              />
            )}
            <img 
              className="tree-icon" 
              src={getFileIconPath(node.name, isExpanded, node.isFile)} 
              alt="icon" 
              style={{ width: '16px', height: '16px' }}
            />
            <span className="tree-name">{node.name}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {onDiscard && node.fullPath !== rootNodeName && (
                <span 
                  className="codicon codicon-discard tree-discard-btn" 
                  title="Discard changes"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDiscard(node.fullPath);
                  }}
                />
              )}
              {node.status && <span style={{ fontSize: '9px', opacity: 0.6, paddingRight: '4px' }}>{node.status}</span>}
            </div>
          </div>
          {!node.isFile && isExpanded && renderNodes(node.children, depth + 1)}
        </div>
      );
    });
  };

  const tree = buildTree(files);

  return (
    <div className="file-tree">
      {renderNodes(tree.children)}
    </div>
  );
};
