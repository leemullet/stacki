// Marker namespaces are project-relative POSIX paths, even when Electron
// reads the project through a Windows drive or WSL UNC path. Keep native
// paths for filesystem calls; normalize only these renderer identifiers.
export const slashPath = (value) => String(value).replace(/\\/g, '/');

export function projectRelativePath(root, file) {
  if (!root || !file) return null;
  const base = slashPath(root).replace(/\/+$/, '');
  const target = slashPath(file);
  return target.startsWith(base + '/') ? target.slice(base.length + 1) : target;
}
