import type { WorkspaceIssue } from './model';

function presentWorkspaceIssue(issue: WorkspaceIssue): string | undefined {
  switch (issue.code) {
    case 'project-folder-missing':
      return 'Project folder is missing.';
    case 'multiple-project-folders':
      return `${issue.count} exact-name folders found.`;
    case 'original-scripts-folder-missing':
      return 'Original Scripts folder is missing.';
    case 'multiple-original-scripts-folders':
      return `${issue.count} Original Scripts folders found.`;
    case 'required-scripts-missing':
      return `Missing from Original Scripts: ${issue.characters.join(', ')}`;
    case 'required-scripts-ambiguous':
      return `Multiple matches in Original Scripts: ${issue.characters.join(', ')}`;
    case 'workspace-inspection-failed':
      return 'Folder inspection failed. Reload to try again.';
  }
}

export function getWorkspaceIssueSummary(
  issues: readonly WorkspaceIssue[],
): string | undefined {
  const summaries = issues
    .map(presentWorkspaceIssue)
    .filter((summary): summary is string => Boolean(summary));
  return [...new Set(summaries)].join(' · ') || undefined;
}
