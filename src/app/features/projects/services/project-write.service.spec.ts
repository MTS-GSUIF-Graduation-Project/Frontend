import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SKIP_ERROR_NOTIFICATION } from '../../../core/interceptors/error.interceptor';
import { Page, Project } from '../models/browser.model';
import { CreateOutcome, ProjectWriteService } from './project-write.service';

describe('ProjectWriteService (mocked HTTP)', () => {
  let service: ProjectWriteService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProjectWriteService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function createProject(): Promise<CreateOutcome<Project>> {
    return firstValueFrom(service.createProject({ name: 'Orders', description: null }));
  }

  it('posts the project once, with inline error handling, and returns it', async () => {
    const outcome = createProject();
    const sent = http.expectOne('/api/v1/projects');
    expect(sent.request.method).toBe('POST');
    expect(sent.request.body).toEqual({ name: 'Orders', description: null });
    expect(sent.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    sent.flush(envelope(project()), { status: 201, statusText: 'Created' });

    await expect(outcome).resolves.toEqual({ kind: 'created', value: project() });
  });

  it('posts a page to its project', async () => {
    const outcome = firstValueFrom(service.createPage('project 1', { name: 'Order list', route: '/orders' }));
    const sent = http.expectOne('/api/v1/projects/project%201/pages');
    expect(sent.request.body).toEqual({ name: 'Order list', route: '/orders' });
    sent.flush(envelope(page()), { status: 201, statusText: 'Created' });

    await expect(outcome).resolves.toEqual({ kind: 'created', value: page() });
  });

  it('keeps duplicate and validation errors by field', async () => {
    const outcome = createProject();
    http.expectOne('/api/v1/projects').flush(
      error(400, "Project with name 'Orders' already exists", { name: "Project with name 'Orders' already exists" }),
      { status: 400, statusText: 'Bad Request' }
    );

    await expect(outcome).resolves.toEqual({
      kind: 'invalid',
      message: "Project with name 'Orders' already exists",
      fieldErrors: { name: "Project with name 'Orders' already exists" }
    });
  });

  it('maps 401, 403 and 404 to their own outcomes', async () => {
    const outcomes: Promise<CreateOutcome<Project>>[] = [];
    for (const status of [401, 403, 404]) {
      outcomes.push(createProject());
      http.expectOne('/api/v1/projects').flush(error(status, `status ${status}`, null), { status, statusText: 'Error' });
    }

    expect(await Promise.all(outcomes)).toEqual([
      { kind: 'unauthenticated' },
      { kind: 'forbidden', message: 'status 403' },
      { kind: 'not-found', message: 'status 404' }
    ]);
  });

  it.each([0, 500, 502, 503, 504])('treats status %i as an unknown outcome and never resends', async status => {
    const outcome = createProject();
    http.expectOne('/api/v1/projects').flush(null, { status, statusText: 'Uncertain' });

    await expect(outcome).resolves.toMatchObject({ kind: 'unknown' });
    http.expectNone('/api/v1/projects');
  });

  it('treats a network failure as an unknown outcome', async () => {
    const outcome = createProject();
    http.expectOne('/api/v1/projects').error(new ProgressEvent('error'));

    await expect(outcome).resolves.toMatchObject({ kind: 'unknown' });
  });

  it('finds a recently created project by exact name with a read-only request', async () => {
    const found = firstValueFrom(service.findRecentProject('  Orders '));
    const sent = http.expectOne('/api/v1/projects');
    expect(sent.request.method).toBe('GET');
    sent.flush(envelope({ data: [{ ...project(), name: 'Orders archive' }, project()], totalPages: 1, totalElements: 2, size: 20, number: 0 }));

    await expect(found).resolves.toEqual(project());
  });

  it('reports no recent page with that name', async () => {
    const found = firstValueFrom(service.findRecentPage('project-1', 'Order list'));
    http.expectOne('/api/v1/projects/project-1/pages')
      .flush(envelope({ data: [], totalPages: 0, totalElements: 0, size: 20, number: 0 }));

    await expect(found).resolves.toBeNull();
  });
});

function project(): Project {
  return {
    id: 'project-1', name: 'Orders', description: null, createdAt: '2026-10-19T09:00:00Z',
    updatedAt: '2026-10-19T09:00:00Z', createdBy: 'admin', lastModifiedBy: 'admin'
  };
}

function page(): Page {
  return {
    id: 'page-1', projectId: 'project-1', name: 'Order list', route: '/orders', createdAt: '2026-10-19T09:00:00Z',
    updatedAt: '2026-10-19T09:00:00Z', createdBy: 'admin', lastModifiedBy: 'admin'
  };
}

function envelope<T>(body: T) {
  return { status: 'OK', clientMessage: 'OK', statusCode: 201, body, errors: null };
}

function error(statusCode: number, clientMessage: string, errors: Record<string, string> | null) {
  return { status: 'ERROR', clientMessage, statusCode, body: null, errors };
}
