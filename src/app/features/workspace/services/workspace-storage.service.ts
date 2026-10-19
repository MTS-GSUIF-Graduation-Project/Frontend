import { Injectable } from '@angular/core';

const DRAFT_PREFIX = 'gsuif.workspace.draft.';
const ATTEMPT_PREFIX = 'gsuif.workspace.attempt.';
const LAST_RUN_PREFIX = 'gsuif.workspace.lastRun.';

/**
 * The newest run started from this browser for one user and page. Only the ID is kept, in
 * localStorage so it survives reloads and new tabs; every detail is read from the server.
 */
export interface LastRun {
  runId: string;
  pageId: string;
  recordedAt: string;
}

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

  readLastRun(username: string, pageId: string): LastRun | null {
    if (!username) {
      return null;
    }
    const value = this.read(lastRunKey(username, pageId), 'local');
    return isLastRun(value) && value.pageId === pageId ? value : null;
  }

  writeLastRun(username: string, pageId: string, runId: string): void {
    if (username && runId) {
      this.write(lastRunKey(username, pageId), { runId, pageId, recordedAt: new Date().toISOString() }, 'local');
    }
  }

  private read(key: string, area: 'session' | 'local' = 'session'): unknown {
    try {
      const raw = storageArea(area).getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown, area: 'session' | 'local' = 'session'): void {
    try {
      storageArea(area).setItem(key, JSON.stringify(value));
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

function storageArea(area: 'session' | 'local'): Storage {
  return area === 'local' ? localStorage : sessionStorage;
}

function lastRunKey(username: string, pageId: string): string {
  return `${LAST_RUN_PREFIX}${encodeURIComponent(username)}.${pageId}`;
}

function isLastRun(value: unknown): value is LastRun {
  const run = value as Partial<LastRun> | null;
  return typeof run === 'object' && run !== null
    && typeof run.runId === 'string' && run.runId.length > 0
    && typeof run.pageId === 'string'
    && typeof run.recordedAt === 'string';
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
