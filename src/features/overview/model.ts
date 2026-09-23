import type { InvoiceDocumentState } from './invoice-model';
import type { WorkspaceFolderRecord } from '../../shared/drive-records';

export interface OverviewProjectItem {
  number: number;
  title: string;
  voiceActor: string;
  characters: string[];
  youtubeUrl?: string;
  characterScriptsFolderUrl?: string;
  postProductionFolderUrl?: string;
}

export type WorkspaceFolderStatus =
  | 'matched'
  | 'missing'
  | 'partial'
  | 'ambiguous'
  | 'unknown';

export type WorkspaceIssue =
  | { code: 'project-folder-missing' }
  | { code: 'multiple-project-folders'; count: number }
  | { code: 'original-scripts-folder-missing' }
  | { code: 'multiple-original-scripts-folders'; count: number }
  | { code: 'required-scripts-missing'; characters: string[] }
  | { code: 'required-scripts-ambiguous'; characters: string[] }
  | { code: 'workspace-inspection-failed' };

export interface WorkspaceItemState {
  status: WorkspaceFolderStatus;
  folders: WorkspaceFolderRecord[];
  initialized: boolean;
  issues: WorkspaceIssue[];
}

export interface WorkspaceProjectItem extends OverviewProjectItem {
  workspace: WorkspaceItemState;
}

export interface OverviewWorkspace {
  documentId: string;
  parentFolderId?: string;
  parentFolderName?: string;
  items: WorkspaceProjectItem[];
  inspectionError?: string;
  invoice: InvoiceDocumentState;
}
