import type {
  SourceFileRecord,
  WorkspaceFolderRecord,
} from '../../shared/drive-records';
import type { AdditionalCharacterCheckSettings } from './overview-settings';
import type { ActionProcessBudget } from '../../shared/action-process-budget';

export interface MutationContext {
  changed: boolean;
}

export interface InitializationRunContext {
  parentFolderId: string;
  budget: ActionProcessBudget;
  mutation: MutationContext;
}

export interface ProjectInitializationDependencies {
  listFolderRecords(parentFolderId: string): WorkspaceFolderRecord[];
  listSourceFiles(folderId: string): SourceFileRecord[];
  createDriveFolder(
    name: string,
    parentFolderId: string,
  ): WorkspaceFolderRecord;
  copyDriveFile(
    source: SourceFileRecord,
    destinationFolderId: string,
    appProperties: Record<string, string>,
  ): string;
  withLock<T>(operation: () => T): T;
  getSettings(): AdditionalCharacterCheckSettings;
}
