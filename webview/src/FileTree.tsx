import React from 'react';

interface FileTreeProps {
  files: string[];
  onFileClick: (path: string) => void;
}

interface TreeNode {
  name: string;
  fullPath: string;
  children: { [key: string]: TreeNode };
  isFile: boolean;
}

const getFileIcon = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx': return '🟦';
    case 'js':
    case 'jsx': return '🟨';
    case 'json': return '🟡';
    case 'md': return '📝';
    case 'css':
    case 'scss':
    case 'less': return '🎨';
    case 'html': return '🌐';
    case 'py': return '🐍';
    case 'go': return '🐹';
    case 'rs': return '🦀';
    case 'java': return '☕';
    case 'php': return '🐘';
    case 'rb': return '💎';
    case 'c':
    case 'cpp':
    case 'h': return '⚙️';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg': return '🖼️';
    case 'yaml':
    case 'yml':
    case 'xml': return '🔧';
    case 'sh':
    case 'bash':
    case 'bat': return '🐚';
    default: return '📄';
  }
};

export const FileTree: React.FC<FileTreeProps> = ({ files, onFileClick }) => {
  const buildTree = (fileList: string[]): TreeNode => {
    const root: TreeNode = { name: '', fullPath: '', children: {}, isFile: false };
    
    fileList.forEach(path => {
      const parts = path.split('/');
      let current = root;
      let currentPath = '';
      
      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            fullPath: currentPath,
            children: {},
            isFile: index === parts.length - 1
          };
        }
        current = current.children[part];
      });
    });
    
    return root;
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
          <div className="tree-item" onClick={() => node.isFile && onFileClick(node.fullPath)}>
            <span className="tree-icon">
              {node.isFile ? getFileIcon(node.name) : '📁'}
            </span>
            {node.name}
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
