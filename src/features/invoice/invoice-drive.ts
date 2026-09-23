import {
  toFolderRecord,
  toSourceFileRecord,
  type SourceFileRecord,
  type WorkspaceFolderRecord,
} from '../../shared/drive-records';
import type { DriveApi, DriveFileIdentity } from '../../shared/drive/drive-api';
import {
  GOOGLE_DOCS_MIME_TYPE,
  GOOGLE_FOLDER_MIME_TYPE,
  INVOICE_DOCUMENT_NAME,
} from '../../shared/workspace-domain';
import { readGoogleDocText } from './google-doc-reader';
import { isInvoiceDocumentName } from './invoice-document';
import { createInvoiceWordCountReplacement } from './invoice-projects';
import type {
  InvoiceParentFolder,
  InvoiceWorkspaceReader,
  InvoiceWorkspaceWriter,
} from './invoice-workspace';
import { collectGoogleDocTabs } from '../../shared/google-doc-tabs';
import {
  createInvoiceFinalization,
  type InvoiceFinalization,
} from './invoice-finalization';

type DocsBody = GoogleAppsScript.Docs.Schema.Body;
type DocsRequest = GoogleAppsScript.Docs.Schema.Request;

interface DocsApiTab {
  tabProperties?: { tabId?: string };
  childTabs?: DocsApiTab[];
  documentTab?: { body?: DocsBody };
}

interface DocsApiDocument extends GoogleAppsScript.Docs.Schema.Document {
  tabs?: DocsApiTab[];
}

interface InvoiceDocsParagraph {
  text: string;
  startIndex: number;
  endIndex: number;
}

interface InvoiceDocsSnapshot {
  paragraphs: InvoiceDocsParagraph[];
  revisionId: string;
  tabId: string;
  text: string;
}

function docsDocuments(): NonNullable<typeof Docs>['Documents'] {
  if (typeof Docs === 'undefined') {
    throw new Error('Advanced Docs service is unavailable.');
  }
  return Docs.Documents;
}

function readInvoiceParagraph(
  element: GoogleAppsScript.Docs.Schema.StructuralElement,
): InvoiceDocsParagraph {
  const { startIndex, endIndex, paragraph } = element;
  if (
    !paragraph ||
    !Number.isSafeInteger(startIndex) ||
    !Number.isSafeInteger(endIndex) ||
    startIndex === undefined ||
    endIndex === undefined ||
    endIndex <= startIndex
  ) {
    throw new Error('Invoice contains unsupported document structure.');
  }

  const content = (paragraph.elements ?? [])
    .map((paragraphElement) => {
      const text = paragraphElement.textRun?.content;
      if (typeof text !== 'string') {
        throw new Error('Invoice contains unsupported inline content.');
      }
      return text;
    })
    .join('');
  if (!content.endsWith('\n')) {
    throw new Error('Invoice paragraph structure is invalid.');
  }

  const text = content.slice(0, -1);
  if (text.includes('\n')) {
    throw new Error('Invoice paragraphs cannot contain manual line breaks.');
  }
  return { text, startIndex, endIndex };
}

function readInvoiceDocsSnapshot(documentId: string): InvoiceDocsSnapshot {
  const document = docsDocuments().get(documentId, {
    includeTabsContent: true,
  }) as DocsApiDocument;
  const tabs = collectGoogleDocTabs(
    document.tabs ?? [],
    (tab) => tab.childTabs ?? [],
  );
  if (tabs.length !== 1) {
    throw new Error('Invoice document must contain exactly one tab.');
  }

  const revisionId = document.revisionId;
  const tabId = tabs[0].tabProperties?.tabId;
  const body = tabs[0].documentTab?.body;
  if (!revisionId || !tabId || !body) {
    throw new Error('Invoice document snapshot is incomplete.');
  }

  const paragraphs = (body.content ?? []).flatMap((element) => {
    if (element.paragraph) {
      return [readInvoiceParagraph(element)];
    }
    if (element.sectionBreak) {
      return [];
    }
    throw new Error('Invoice contains unsupported document structure.');
  });
  return {
    paragraphs,
    revisionId,
    tabId,
    text: paragraphs.map((paragraph) => paragraph.text).join('\n'),
  };
}

function createAtomicFinalizationRequests(
  finalization: InvoiceFinalization,
  snapshot: InvoiceDocsSnapshot,
): DocsRequest[] {
  const seenLineIndexes = new Set<number>();
  const targets = finalization.replacements.map((replacement) => {
    if (seenLineIndexes.has(replacement.lineIndex)) {
      throw new Error('Invoice finalization contains a duplicate target row.');
    }
    seenLineIndexes.add(replacement.lineIndex);

    const paragraph = snapshot.paragraphs[replacement.lineIndex];
    if (!paragraph || paragraph.text.trim() !== replacement.previousLine) {
      throw new Error(
        'Invoice body structure changed. Reload the Invoice card.',
      );
    }
    return { paragraph, replacement };
  });

  return targets
    .sort(
      (left, right) => right.paragraph.startIndex - left.paragraph.startIndex,
    )
    .flatMap(({ paragraph, replacement }) => {
      const textEndIndex = paragraph.endIndex - 1;
      if (textEndIndex <= paragraph.startIndex) {
        throw new Error('Invoice cost row structure is invalid.');
      }
      const range = {
        startIndex: paragraph.startIndex,
        endIndex: textEndIndex,
        tabId: snapshot.tabId,
      } as GoogleAppsScript.Docs.Schema.Range;
      const location = {
        index: paragraph.startIndex,
        tabId: snapshot.tabId,
      } as GoogleAppsScript.Docs.Schema.Location;
      return [
        { deleteContentRange: { range } },
        {
          insertText: {
            location,
            text: replacement.replacementLine,
          },
        },
      ];
    });
}

function getInvoiceFile(
  documentId: string,
  driveApi: DriveApi,
): DriveFileIdentity {
  const file = driveApi.getFile(documentId, 'identity');
  if (
    file.trashed ||
    file.mimeType !== GOOGLE_DOCS_MIME_TYPE ||
    !isInvoiceDocumentName(file.name)
  ) {
    throw new Error(
      `Selected file is no longer a Google Doc named ${INVOICE_DOCUMENT_NAME}.`,
    );
  }
  return file;
}

export function createInvoiceWorkspaceDriveReader(
  driveApi: DriveApi,
): InvoiceWorkspaceReader {
  return {
    readInvoiceText(documentId: string): string {
      const result = readGoogleDocText(documentId, DocumentApp);
      if (result.status !== 'ready') {
        throw new Error(
          `Invoice document could not be read: ${result.reason}.`,
        );
      }
      return result.text;
    },

    validateInvoiceAndGetParent(documentId: string): InvoiceParentFolder {
      const parents = getInvoiceFile(documentId, driveApi).parents ?? [];
      if (parents.length !== 1) {
        throw new Error('Invoice document must have one parent folder.');
      }
      return { id: parents[0] };
    },

    listChildFolders(parentFolderId: string): WorkspaceFolderRecord[] {
      return driveApi
        .listChildren(parentFolderId, {
          filter: { mimeType: GOOGLE_FOLDER_MIME_TYPE },
          projection: 'folder',
        })
        .map(toFolderRecord);
    },

    listChildFiles(parentFolderId: string): SourceFileRecord[] {
      return driveApi
        .listChildren(parentFolderId, { projection: 'source' })
        .filter((file) => file.mimeType !== GOOGLE_FOLDER_MIME_TYPE)
        .map(toSourceFileRecord);
    },
  };
}

export function createInvoiceWorkspaceDriveWriter(
  driveApi: DriveApi,
): InvoiceWorkspaceWriter {
  return {
    replaceProjectWordCount(
      documentId,
      project,
      collection,
      wordCount,
      expectedInvoiceWordCountLine,
    ): void {
      getInvoiceFile(documentId, driveApi);
      const document = DocumentApp.openById(documentId);
      const tabs = collectGoogleDocTabs(document.getTabs(), (tab) =>
        tab.getChildTabs(),
      );
      if (tabs.length !== 1) {
        throw new Error('Invoice document must contain exactly one tab.');
      }

      const body = tabs[0].asDocumentTab().getBody();
      const replacement = createInvoiceWordCountReplacement(
        body.getText(),
        project,
        collection,
        wordCount,
      );
      if (replacement.previousLine !== expectedInvoiceWordCountLine) {
        throw new Error(
          'Invoice word-count row changed. Parse scripts again before applying.',
        );
      }
      const paragraphs = body.getParagraphs();
      const target = paragraphs[replacement.lineIndex];
      if (!target || target.getText().trim() !== replacement.previousLine) {
        throw new Error(
          'Invoice body structure changed. Reload the Invoice card.',
        );
      }
      target.setText(replacement.replacementLine);
      document.saveAndClose();
    },

    finalizeInvoice(documentId, settings) {
      getInvoiceFile(documentId, driveApi);
      const snapshot = readInvoiceDocsSnapshot(documentId);
      const finalization = createInvoiceFinalization(snapshot.text, settings);
      const requests = createAtomicFinalizationRequests(finalization, snapshot);
      docsDocuments().batchUpdate(
        {
          requests,
          writeControl: { requiredRevisionId: snapshot.revisionId },
        },
        documentId,
      );
      return finalization;
    },
  };
}
