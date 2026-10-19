import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SKIP_ERROR_NOTIFICATION } from '../../../core/interceptors/error.interceptor';
import { BackendCreated, BackendGenerationRequest, GenerationOutcome } from '../models/generation.model';
import { BackendGenerationService, MAX_VIEWABLE_BYTES } from './backend-generation.service';

const GENERATE_URL = '/api/v1/generation/backend';

describe('BackendGenerationService (mocked HTTP)', () => {
  let service: BackendGenerationService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(BackendGenerationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function send(): Promise<GenerationOutcome> {
    return firstValueFrom(service.generate(request()));
  }

  it('sends the request once, unchanged, with inline error handling', async () => {
    const outcome = send();
    const sent = http.expectOne(GENERATE_URL);
    expect(sent.request.method).toBe('POST');
    expect(sent.request.body).toEqual(request());
    expect(sent.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
    sent.flush({ status: 'OK', clientMessage: 'Generation run recorded', statusCode: 201, body: created(), errors: null },
      { status: 201, statusText: 'Created' });

    await expect(outcome).resolves.toEqual({ kind: 'success', result: created() });
  });

  it.each([0, 502, 503, 504])('treats status %i as an unknown outcome and does not resend', async status => {
    const outcome = send();
    http.expectOne(GENERATE_URL).flush(null, { status, statusText: 'Uncertain' });

    await expect(outcome).resolves.toMatchObject({ kind: 'unknown' });
    http.expectNone(GENERATE_URL);
  });

  it('reports a network error as an unknown outcome', async () => {
    const outcome = send();
    http.expectOne(GENERATE_URL).error(new ProgressEvent('error'));

    await expect(outcome).resolves.toMatchObject({ kind: 'unknown' });
  });

  it('keeps field errors and any persisted attempt for a rejected request', async () => {
    const outcome = send();
    http.expectOne(GENERATE_URL).flush(
      error(400, 'Invalid generation request', { _global: 'specification.basePackage: invalid Java package' }),
      { status: 400, statusText: 'Bad Request', headers: trackingHeaders() }
    );

    await expect(outcome).resolves.toEqual({
      kind: 'rejected',
      message: 'Invalid generation request',
      errors: { _global: 'specification.basePackage: invalid Java package' },
      tracking: { runId: 'run-7', stage: 'CONFIG', code: 'CONFIG_MISSING' }
    });
  });

  it('recognises a reused attempt ID that is running or already failed', async () => {
    const outcome = send();
    http.expectOne(GENERATE_URL).flush(
      error(400, 'Invalid generation request', { _global: 'attemptId: already reserved or terminal; use a new ID' }),
      { status: 400, statusText: 'Bad Request' }
    );

    await expect(outcome).resolves.toEqual({
      kind: 'attempt-unavailable', message: 'attemptId: already reserved or terminal; use a new ID'
    });
  });

  it('recognises a reused attempt ID bound to different inputs', async () => {
    const outcome = send();
    http.expectOne(GENERATE_URL).flush(
      error(400, 'Invalid generation request', { _global: 'attemptId: bound to different inputs' }),
      { status: 400, statusText: 'Bad Request' }
    );

    await expect(outcome).resolves.toMatchObject({ kind: 'attempt-conflict' });
  });

  it('reports a recorded failure with its stage and code', async () => {
    const outcome = send();
    http.expectOne(GENERATE_URL).flush(
      error(500, 'Generation attempt failed', { _global: 'Generation attempt failed' }),
      { status: 500, statusText: 'Server Error', headers: trackingHeaders() }
    );

    await expect(outcome).resolves.toEqual({
      kind: 'failed', message: 'Generation attempt failed',
      tracking: { runId: 'run-7', stage: 'CONFIG', code: 'CONFIG_MISSING' }
    });
  });

  it('does not claim failure for an untracked server error', async () => {
    const outcome = send();
    http.expectOne(GENERATE_URL).flush(error(500, 'An unexpected error occurred', null), { status: 500, statusText: 'Server Error' });

    await expect(outcome).resolves.toMatchObject({ kind: 'unknown' });
  });

  it('maps 401, 403 and 404 to their own outcomes', async () => {
    const outcomes: Promise<GenerationOutcome>[] = [];
    for (const status of [401, 403, 404]) {
      outcomes.push(send());
      http.expectOne(GENERATE_URL).flush(error(status, `status ${status}`, null), { status, statusText: 'Error' });
    }

    const [unauthenticated, forbidden, notFound] = await Promise.all(outcomes);
    expect(unauthenticated).toEqual({ kind: 'unauthenticated' });
    expect(forbidden).toEqual({ kind: 'forbidden', message: 'status 403' });
    expect(notFound).toEqual({ kind: 'not-found', message: 'status 404' });
  });

  it('does not report success for an unexpected success body', async () => {
    const outcome = send();
    http.expectOne(GENERATE_URL).flush({ status: 'OK', clientMessage: '', statusCode: 201, body: null, errors: null });

    await expect(outcome).resolves.toMatchObject({ kind: 'unknown' });
  });

  describe('artifacts', () => {
    const artifactUrl = '/api/v1/generation/runs/run-7/artifacts/download?path=backend/src/Main.java';

    it('returns text for a small text file, requested by registered path', async () => {
      const text = firstValueFrom(service.readArtifactText('run-7', 'backend/src/Main.java'));
      const sent = http.expectOne(artifactUrl);
      expect(sent.request.responseType).toBe('blob');
      sent.flush(new Blob(['class Main {}']));

      await expect(text).resolves.toEqual({ kind: 'text', text: 'class Main {}' });
    });

    it('does not decode binary content', async () => {
      const text = firstValueFrom(service.readArtifactText('run-7', 'backend/src/Main.java'));
      http.expectOne(artifactUrl).flush(new Blob([new Uint8Array([80, 75, 0, 3])]));

      await expect(text).resolves.toEqual({ kind: 'binary' });
    });

    it('does not decode oversized files', async () => {
      const text = firstValueFrom(service.readArtifactText('run-7', 'backend/src/Main.java'));
      http.expectOne(artifactUrl).flush(new Blob([new Uint8Array(MAX_VIEWABLE_BYTES + 1)]));

      await expect(text).resolves.toEqual({ kind: 'too-large', size: MAX_VIEWABLE_BYTES + 1 });
    });

    it('reads the error envelope from a failed binary response', async () => {
      const text = firstValueFrom(service.readArtifactText('run-7', 'backend/src/Main.java'));
      http.expectOne(artifactUrl).flush(
        new Blob([JSON.stringify(error(404, 'Artifact not registered for run', null))]),
        { status: 404, statusText: 'Not Found' }
      );

      await expect(text).rejects.toMatchObject({ statusCode: 404, clientMessage: 'Artifact not registered for run' });
    });
  });
});

function request(): BackendGenerationRequest {
  return {
    pageId: 'page-9',
    attemptId: '1b0e7f6a-3c1d-4e0a-9b51-2f6a0c9d8e11',
    specification: {
      specVersion: '1.0.0', basePackage: 'com.example.inventory',
      entity: { className: 'StockUnit', tableName: 'stock_unit', fields: [], enversAudited: false },
      openApi: { contractId: 'stock-unit-api', contractVersion: '3.0.0', bindingOperations: {} },
      operationRoles: {},
      angular: { className: 'StockUnit', tableColumns: {} }
    }
  };
}

function created(): BackendCreated {
  return {
    runId: 'run-7', attemptId: '1b0e7f6a-3c1d-4e0a-9b51-2f6a0c9d8e11', status: 'SUCCESS',
    metadataVersionId: 'version-3', artifactCount: 42,
    backendPackage: {
      contractId: 'stock-unit-api', contractVersion: '3.0.0', manifestSha256: 'abc123',
      validationScope: { passedTargets: ['ISOLATED_BACKEND_BUILD_PASSED'], notValidatedTargets: [] }
    }
  };
}

function error(statusCode: number, clientMessage: string, errors: Record<string, string> | null) {
  return { status: 'ERROR', clientMessage, statusCode, body: null, errors };
}

function trackingHeaders(): HttpHeaders {
  return new HttpHeaders({
    'X-Generation-Run-Id': 'run-7',
    'X-Generation-Failure-Stage': 'CONFIG',
    'X-Generation-Failure-Code': 'CONFIG_MISSING'
  });
}
