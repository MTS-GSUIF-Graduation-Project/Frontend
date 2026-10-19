import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';
import { FormDraftService } from './form-draft.service';

describe('FormDraftService', () => {
  let username: string;
  let drafts: FormDraftService;

  beforeEach(() => {
    sessionStorage.clear();
    username = 'ada';
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { getUsername: () => username } }]
    });
    drafts = TestBed.inject(FormDraftService);
  });

  it('keeps a draft per user and form context', () => {
    drafts.write('page-create:project-1', { name: 'Orders' });

    expect(drafts.read('page-create:project-1')).toEqual({ name: 'Orders' });
    expect(drafts.read('page-create:project-2')).toBeNull();

    username = 'grace';
    expect(drafts.read('page-create:project-1')).toBeNull();
  });

  it('clears only the given context', () => {
    drafts.write('project-create', { name: 'A' });
    drafts.write('page-create:project-1', { name: 'B' });

    drafts.clear('project-create');

    expect(drafts.read('project-create')).toBeNull();
    expect(drafts.read('page-create:project-1')).toEqual({ name: 'B' });
  });

  it('stores nothing without a signed-in user', () => {
    username = '';
    drafts.write('project-create', { name: 'A' });

    expect(sessionStorage.length).toBe(0);
    expect(drafts.read('project-create')).toBeNull();
  });

  it('ignores corrupt stored values', () => {
    sessionStorage.setItem('gsuif.form-draft.ada.project-create', '{"name": 3}');

    expect(drafts.read('project-create')).toBeNull();
  });
});
