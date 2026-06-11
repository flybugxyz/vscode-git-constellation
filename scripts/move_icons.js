const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'webview', 'assets', 'antigravity-icons');
const destDir = path.join(__dirname, '..', 'webview', 'public', 'antigravity-icons');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

if (fs.existsSync(srcDir)) {
    copyRecursiveSync(srcDir, destDir);
    console.log('Moved icons to public directory');
} else {
    console.log('Source directory does not exist');
}
