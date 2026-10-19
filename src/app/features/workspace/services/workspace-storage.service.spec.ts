import { TestBed } from '@angular/core/testing';
import { PendingAttempt, WorkspaceDraft, WorkspaceStorageService } from './workspace-storage.service';

describe('WorkspaceStorageService', () => {
  let storage: WorkspaceStorageService;

  const draft: WorkspaceDraft = {
    schemaVersion: '1.2.0', metadataText: '{"components":[]}', specText: '{}',
    contractKey: 'stock-unit-api@3.0.0', baseVersionId: 'version-3'
  };
  const attempt: PendingAttempt = {
    attemptId: '1b0e7f6a-3c1d-4e0a-9b51-2f6a0c9d8e11', pageId: 'page-9',
    requestJson: '{"pageId":"page-9"}', submittedAt: '2026-10-19T10:00:00.000Z'
  };

  beforeEach(() => {
    sessionStorage.clear();
    storage = TestBed.inject(WorkspaceStorageService);
  });

  it('keeps drafts per page', () => {
    storage.writeDraft('page-9', draft);

    expect(storage.readDraft('page-9')).toEqual(draft);
    expect(storage.readDraft('page-10')).toBeNull();

    storage.clearDraft('page-9');
    expect(storage.readDraft('page-9')).toBeNull();
  });

  it('keeps the exact pending request and never touches the auth session', () => {
    sessionStorage.setItem('gsuif.auth', 'session');
    storage.writeAttempt(attempt);

    expect(storage.readAttempt('page-9')).toEqual(attempt);
    storage.clearAttempt('page-9');
    expect(storage.readAttempt('page-9')).toBeNull();
    expect(sessionStorage.getItem('gsuif.auth')).toBe('session');
  });

  it('ignores corrupt or foreign stored values', () => {
    sessionStorage.setItem('gsuif.workspace.draft.page-9', '{not json');
    sessionStorage.setItem('gsuif.workspace.attempt.page-9', JSON.stringify({ ...attempt, pageId: 'page-10' }));

    expect(storage.readDraft('page-9')).toBeNull();
    expect(storage.readAttempt('page-9')).toBeNull();
  });
});
