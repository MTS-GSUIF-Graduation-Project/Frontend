import { Injectable } from '@angular/core';

const DRAFT_PREFIX = 'gsuif.workspace.draft.';
const ATTEMPT_PREFIX = 'gsuif.workspace.attempt.';

/** Unsaved editor text for one page. Kept per browser tab in sessionStorage. */
export interface WorkspaceDraft {
  schemaVersion: string;
  metadataText: string;
  specText: string;
  contractKey: string | null;
  /** The current version the metadata draft was started from, if any. */
  baseVersionId: string | null;
}

/**
 * A generation request whose outcome has not been confirmed. `requestJson` is the exact
 * body that was sent, so a retry can repeat it byte for byte. It never holds credentials.
 */
export interface PendingAttempt {
  attemptId: string;
  pageId: string;
  requestJson: string;
  submittedAt: string;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceStorageService {
  readDraft(pageId: string): WorkspaceDraft | null {
    const value = this.read(DRAFT_PREFIX + pageId);
    return isDraft(value) ? value : null;
  }

  writeDraft(pageId: string, draft: WorkspaceDraft): void {
    this.write(DRAFT_PREFIX + pageId, draft);
  }

  clearDraft(pageId: string): void {
    this.remove(DRAFT_PREFIX + pageId);
  }

  readAttempt(pageId: string): PendingAttempt | null {
    const value = this.read(ATTEMPT_PREFIX + pageId);
    return isAttempt(value) && value.pageId === pageId ? value : null;
  }

  writeAttempt(attempt: PendingAttempt): void {
    this.write(ATTEMPT_PREFIX + attempt.pageId, attempt);
  }

  clearAttempt(pageId: string): void {
    this.remove(ATTEMPT_PREFIX + pageId);
  }

  private read(key: string): unknown {
    try {
      const raw = sessionStorage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage can be unavailable or full; the in-memory state still works.
    }
  }

  private remove(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }
}

function isDraft(value: unknown): value is WorkspaceDraft {
  const draft = value as Partial<WorkspaceDraft> | null;
  return typeof draft === 'object' && draft !== null
    && typeof draft.schemaVersion === 'string'
    && typeof draft.metadataText === 'string'
    && typeof draft.specText === 'string'
    && (draft.contractKey === null || typeof draft.contractKey === 'string')
    && (draft.baseVersionId === null || typeof draft.baseVersionId === 'string');
}

function isAttempt(value: unknown): value is PendingAttempt {
  const attempt = value as Partial<PendingAttempt> | null;
  return typeof attempt === 'object' && attempt !== null
    && typeof attempt.attemptId === 'string'
    && typeof attempt.pageId === 'string'
    && typeof attempt.requestJson === 'string'
    && typeof attempt.submittedAt === 'string';
}
