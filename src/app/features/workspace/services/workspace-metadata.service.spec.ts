import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SKIP_ERROR_NOTIFICATION } from '../../../core/interceptors/error.interceptor';
import { ApiException } from '../../../core/models/api-response.model';
import { MetadataVersion } from '../../projects/models/browser.model';
import { WorkspaceMetadataService } from './workspace-metadata.service';

describe('WorkspaceMetadataService (mocked HTTP)', () => {
  let service: WorkspaceMetadataService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(WorkspaceMetadataService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('returns the current version and keeps errors inline', async () => {
    const result = firstValueFrom(service.getCurrent('page 9'));
    const request = http.expectOne('/api/v1/pages/page%209/metadata/current');
    expect(request.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    request.flush(envelope(version()));

    await expect(result).resolves.toEqual(version());
  });

  it('treats a page without a current version as empty', async () => {
    const result = firstValueFrom(service.getCurrent('page-9'));
    http.expectOne('/api/v1/pages/page-9/metadata/current').flush(
      { status: 'NOT_FOUND', clientMessage: 'No current metadata version', statusCode: 404, body: null, errors: null },
      { status: 404, statusText: 'Not Found' }
    );

    await expect(result).resolves.toBeNull();
  });

  it('posts only schemaVersion and snapshot to create a new version', async () => {
    const result = firstValueFrom(service.createVersion('page-9', '1.2.0', { components: [] }));
    const request = http.expectOne('/api/v1/pages/page-9/metadata');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ schemaVersion: '1.2.0', snapshot: { components: [] } });
    request.flush(envelope({ ...version(), version: 4, id: 'version-4' }), { status: 201, statusText: 'Created' });

    await expect(result).resolves.toMatchObject({ id: 'version-4', version: 4 });
  });

  it('keeps backend validation errors by path', async () => {
    const result = firstValueFrom(service.createVersion('page-9', '1.2.0', {}));
    http.expectOne('/api/v1/pages/page-9/metadata').flush({
      status: 'BAD_REQUEST', clientMessage: 'Request validation failed', statusCode: 400, body: null,
      errors: { '$.components': 'required property missing' }
    }, { status: 400, statusText: 'Bad Request' });

    const error = await result.catch(caught => caught);
    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({
      statusCode: 400,
      clientMessage: 'Request validation failed',
      errors: { '$.components': 'required property missing' }
    });
  });
});

function version(): MetadataVersion {
  return {
    id: 'version-3', pageId: 'page-9', projectId: 'project-71', version: 3, schemaVersion: '1.2.0',
    isCurrent: true, snapshot: { components: [] }, createdAt: '2026-10-05T08:00:00Z',
    updatedAt: '2026-10-05T08:00:00Z', createdBy: 'barbara', lastModifiedBy: 'barbara'
  };
}

function envelope<T>(body: T) {
  return { status: 'OK', clientMessage: 'OK', statusCode: 200, body, errors: null };
}
