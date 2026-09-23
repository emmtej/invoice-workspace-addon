import type {
  SourceFileRecord,
  WorkspaceFolderRecord,
} from '../../shared/drive-records';
import { type InvoiceDocumentRecord } from './invoice-model';

export interface OverviewParentFolder {
  id: string;
  name: string;
}

export interface WorkspaceDriveReader {
  getOverviewParent(documentId: string): OverviewParentFolder;
  listChildFolders(parentFolderId: string): WorkspaceFolderRecord[];
  listChildFiles(parentFolderId: string): SourceFileRecord[];
  listInvoiceCandidates(parentFolderId: string): InvoiceDocumentRecord[];
}
