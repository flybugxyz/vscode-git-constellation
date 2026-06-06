import React, { useState, useEffect } from 'react';

interface FileInfo {
  status: string;
  path: string;
}

interface FileTreeProps {
  files: FileInfo[];
  onFileClick: (path: string) => void;
  checkboxes?: boolean;
  checkedPaths?: Set<string>;
  onCheckChange?: (path: string, checked: boolean, filePaths: string[]) => void;
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

const getFileIconClass = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'go':
    case 'rs':
    case 'java':
    case 'c':
    case 'cpp':
    case 'h': return 'codicon-file-code';
    case 'json': return 'codicon-json';
    case 'md': return 'codicon-markdown';
    case 'css':
    case 'scss':
    case 'less': return 'codicon-symbol-color';
    case 'html': return 'codicon-globe';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg': return 'codicon-file-media';
    case 'yaml':
    case 'yml':
    case 'xml': return 'codicon-settings';
    case 'sh':
    case 'bash':
    case 'bat': return 'codicon-terminal';
    case 'pdf': return 'codicon-file-pdf';
    case 'zip':
    case 'tar':
    case 'gz': return 'codicon-file-zip';
    default: return 'codicon-file';
  }
};

export const FileTree: React.FC<FileTreeProps> = ({ 
  files, 
  onFileClick, 
  checkboxes = false, 
  checkedPaths, 
  onCheckChange 
}) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    const allDirs = new Set<string>();
    files.forEach(file => {
      const parts = file.path.split('/');
      let currentPath = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];
        allDirs.add(currentPath);
      }
    });
    setExpandedNodes(allDirs);
  }, [files]);

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
            onClick={() => node.isFile ? onFileClick(node.fullPath) : toggleNode(node.fullPath, {} as any)}
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
            <span className={`tree-icon codicon ${node.isFile ? getFileIconClass(node.name) : (isExpanded ? 'codicon-folder-opened' : 'codicon-folder')}`}>
            </span>
            <span className="tree-name">{node.name}</span>
            {node.status && <span style={{ marginLeft: 'auto', fontSize: '9px', opacity: 0.6, paddingRight: '4px' }}>{node.status}</span>}
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
