export function validateBranchName(name: string): void {
  if (!name || name.startsWith('-') || !/^[a-zA-Z0-9._/-]+$/.test(name)) {
    throw new Error(`Invalid branch/ref name: "${name}"`);
  }
}

export function validateHash(hash: string): void {
  if (hash === 'HEAD') return;
  if (!hash || !/^[a-fA-F0-9]{4,40}$/.test(hash)) {
    throw new Error(`Invalid commit hash: "${hash}"`);
  }
}

export function validateFilePath(path: string): void {
  if (!path || path.startsWith('-')) {
    throw new Error(`Invalid file path: "${path}"`);
  }
}

export function validateStashRef(ref: string): void {
  if (!ref || !/^stash@\{\d+\}$/.test(ref)) {
    throw new Error(`Invalid stash reference: "${ref}"`);
  }
}
