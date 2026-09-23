import { FolderMeta } from '../types';

/**
 * Returns the earliest (minimum) deadline among all ancestor folders of a given project path.
 * If includeSelf is false (for a folder itself), checks strict ancestors (e.g. for folder "A/B", checks "A").
 * If includeSelf is true (for tasks inside "A/B"), checks "A/B" and "A".
 */
export function getParentFolderDeadline(
  projectPath: string,
  folderMetas: Record<string, FolderMeta>,
  includeSelf = false
): number | undefined {
  if (!projectPath) return undefined;

  // Split by / or \
  const parts = projectPath.split(/[\/\\]/).map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return undefined;

  let earliestDeadline: number | undefined = undefined;

  const maxLen = includeSelf ? parts.length : parts.length - 1;

  for (let i = 1; i <= maxLen; i++) {
    const ancestorPath = parts.slice(0, i).join('/');
    const meta = folderMetas[ancestorPath];
    if (meta && typeof meta.deadline === 'number' && !isNaN(meta.deadline)) {
      if (earliestDeadline === undefined || meta.deadline < earliestDeadline) {
        earliestDeadline = meta.deadline;
      }
    }
  }

  return earliestDeadline;
}

/**
 * Validates if the new deadline is valid with respect to parent folder deadline.
 * Returns true if valid, false if it violates the parent deadline.
 */
export function isDeadlineWithinParentLimit(
  newDeadline: number | undefined | null,
  projectPath: string,
  folderMetas: Record<string, FolderMeta>,
  isFolder: boolean
): boolean {
  if (!newDeadline) return true;
  const parentLimit = getParentFolderDeadline(projectPath, folderMetas, !isFolder);
  if (parentLimit === undefined) return true;
  return newDeadline <= parentLimit;
}
