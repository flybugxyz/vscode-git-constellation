import React from 'react';

interface FileInfo {
  status: string;
  path: string;
}

interface FileTreeProps {
  files: FileInfo[];
  onFileClick: (path: string) => void;
}

interface TreeNode {
  name: string;
  fullPath: string;
  children: { [key: string]: TreeNode };
  isFile: boolean;
  status?: string;
}

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

export const FileTree: React.FC<FileTreeProps> = ({ files, onFileClick }) => {
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

  const getStatusClass = (status?: string) => {
    switch (status) {
      case 'A': return 'status-added';
      case 'M': return 'status-modified';
      case 'D': return 'status-deleted';
      case 'R': return 'status-renamed';
      default: return '';
    }
  };

  const renderNodes = (nodes: { [key: string]: TreeNode }) => {
    const sortedKeys = Object.keys(nodes).sort((a, b) => {
      if (nodes[a].isFile !== nodes[b].isFile) {
        return nodes[a].isFile ? 1 : -1;
      }
      return a.localeCompare(b);
    });

    return sortedKeys.map(key => {
      const node = nodes[key];
      return (
        <div key={node.fullPath} className="tree-node">
          <div 
            className={`tree-item ${getStatusClass(node.status)}`} 
            onClick={() => node.isFile && onFileClick(node.fullPath)}
          >
            <span className={`tree-icon codicon ${node.isFile ? getFileIconClass(node.name) : 'codicon-folder'}`}>
            </span>
            {node.name}
            {node.status && <span style={{ marginLeft: 'auto', fontSize: '9px', opacity: 0.6 }}>{node.status}</span>}
          </div>
          {!node.isFile && renderNodes(node.children)}
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
