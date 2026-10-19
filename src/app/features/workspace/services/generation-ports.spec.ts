import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { SKIP_ERROR_NOTIFICATION } from '../../../core/interceptors/error.interceptor';
import { ATTEMPT_RECOVERY, CONTRACT_CATALOG, PACKAGE_DOWNLOAD } from './generation-ports';

describe('generation ports over HTTP (mocked HTTP)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('contract catalog', () => {
    const url = '/api/v1/generation/contracts?output=BACKEND';

    it('lists the server contracts in order, with inline errors', async () => {
      const result = firstValueFrom(TestBed.inject(CONTRACT_CATALOG).listBackendContracts());
      const sent = http.expectOne(url);
      expect(sent.request.method).toBe('GET');
      expect(sent.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
      sent.flush(envelope([
        contract('stock-unit-api', '2.0.0'),
        contract('stock-unit-api', '3.0.0'),
        contract('asset-ticket-api', '2.0.0')
      ]));

      const options = await result;
      expect(options.map(option => `${option.contractId}@${option.contractVersion}`))
        .toEqual(['stock-unit-api@2.0.0', 'stock-unit-api@3.0.0', 'asset-ticket-api@2.0.0']);
      expect(options[0]).toEqual({
        contractId: 'stock-unit-api', contractVersion: '2.0.0', label: 'StockUnit fixture API',
        operationIds: ['registerStockUnit', 'inspectStockUnit', 'scanStockUnits', 'replaceStockUnit', 'discardStockUnit'],
        pageCompatibilityChecked: false
      });
    });

    it('reports a failure without falling back to any built-in list', async () => {
      const result = firstValueFrom(TestBed.inject(CONTRACT_CATALOG).listBackendContracts());
      http.expectOne(url).flush(error(500, 'An unexpected error occurred'), { status: 500, statusText: 'Server Error' });

      await expect(result).rejects.toMatchObject({ statusCode: 500 });
    });
  });

  describe('attempt lookup', () => {
    const url = '/api/v1/generation/attempts/1b0e7f6a-3c1d-4e0a-9b51-2f6a0c9d8e11';

    function lookup() {
      return firstValueFrom(TestBed.inject(ATTEMPT_RECOVERY).findRun('1b0e7f6a-3c1d-4e0a-9b51-2f6a0c9d8e11'));
    }

    it('is available and returns the persisted attempt, including a failure stage and code', async () => {
      expect(TestBed.inject(ATTEMPT_RECOVERY).available).toBe(true);
      const result = lookup();
      const sent = http.expectOne(url);
      expect(sent.request.method).toBe('GET');
      expect(sent.request.context.get(SKIP_ERROR_NOTIFICATION)).toBe(true);
      sent.flush(envelope({
        runId: 'run-7', attemptId: '1b0e7f6a-3c1d-4e0a-9b51-2f6a0c9d8e11', status: 'FAILED',
        metadataVersionId: 'version-3', failureStage: 'AI', failureCode: 'MODEL_COMPILATION_FAILED'
      }));

      await expect(result).resolves.toEqual({
        kind: 'found', runId: 'run-7', status: 'FAILED', metadataVersionId: 'version-3',
        failureStage: 'AI', failureCode: 'MODEL_COMPILATION_FAILED'
      });
    });

    it('treats 404 as no accessible attempt', async () => {
      const result = lookup();
      http.expectOne(url).flush(error(404, 'Generation attempt not found'), { status: 404, statusText: 'Not Found' });

      await expect(result).resolves.toEqual({ kind: 'not-found' });
    });

    it('reports a missing grant as an error', async () => {
      const result = lookup();
      http.expectOne(url).flush(error(403, 'Access denied'), { status: 403, statusText: 'Forbidden' });

      await expect(result).rejects.toMatchObject({ statusCode: 403, clientMessage: 'Access denied' });
    });
  });

  describe('package download', () => {
    const url = '/api/v1/generation/runs/run-7/package.zip';

    function download() {
      return firstValueFrom(TestBed.inject(PACKAGE_DOWNLOAD).downloadZip('run-7'));
    }

    it('downloads the verified ZIP from a relative URL under the server file name', async () => {
      expect(TestBed.inject(PACKAGE_DOWNLOAD).available).toBe(true);
      const result = download();
      const sent = http.expectOne(url);
      expect(sent.request.method).toBe('GET');
      expect(sent.request.responseType).toBe('blob');
      expect(sent.request.url).not.toContain('token');
      const blob = new Blob(['PK']);
      sent.flush(blob, { headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="run-7.zip"' }) });

      await expect(result).resolves.toEqual({ blob, fileName: 'run-7.zip' });
    });

    it('falls back to the run ID when no file name is sent, and strips unsafe names', async () => {
      const first = download();
      http.expectOne(url).flush(new Blob(['PK']));
      await expect(first).resolves.toMatchObject({ fileName: 'run-7.zip' });

      const second = download();
      http.expectOne(url).flush(new Blob(['PK']), {
        headers: new HttpHeaders({ 'Content-Disposition': 'attachment; filename="../../evil.zip"' })
      });
      await expect(second).resolves.toMatchObject({ fileName: 'evil.zip' });
    });

    it('explains a package the server could not prepare', async () => {
      const result = download();
      http.expectOne(url).flush(new Blob([JSON.stringify(error(500, 'An unexpected error occurred'))]),
        { status: 500, statusText: 'Server Error' });

      await expect(result).rejects.toMatchObject({
        statusCode: 500,
        clientMessage: 'The package could not be prepared. The run may be incomplete, larger than 512 files or 64 MiB, or it failed its integrity check.'
      });
    });

    it('explains missing grants and keeps the not-found message', async () => {
      const forbidden = download();
      http.expectOne(url).flush(new Blob([JSON.stringify(error(403, 'Access denied'))]), { status: 403, statusText: 'Forbidden' });
      await expect(forbidden).rejects.toMatchObject({
        statusCode: 403, clientMessage: 'Downloading the package needs access to its project, page and metadata versions.'
      });

      const missing = download();
      http.expectOne(url).flush(new Blob([JSON.stringify(error(404, 'Generation run not found'))]), { status: 404, statusText: 'Not Found' });
      await expect(missing).rejects.toMatchObject({ statusCode: 404, clientMessage: 'Generation run not found' });
    });
  });
});

function contract(contractId: string, contractVersion: string) {
  return {
    contractId, contractVersion, label: contractId === 'stock-unit-api' ? 'StockUnit fixture API' : 'AssetTicket API',
    operationIds: ['registerStockUnit', 'inspectStockUnit', 'scanStockUnits', 'replaceStockUnit', 'discardStockUnit'],
    updateMode: 'FULL', pageCompatibilityChecked: false
  };
}

function envelope<T>(body: T) {
  return { status: 'OK', clientMessage: 'OK', statusCode: 200, body, errors: null };
}

function error(statusCode: number, clientMessage: string) {
  return { status: 'ERROR', clientMessage, statusCode, body: null, errors: null };
}
