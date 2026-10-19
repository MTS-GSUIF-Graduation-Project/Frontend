import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, of, switchMap, throwError } from 'rxjs';
import { blobErrorToApiException, toApiException } from '../../../core/http/api-error';
import { SKIP_ERROR_NOTIFICATION } from '../../../core/interceptors/error.interceptor';
import { ApiException, ApiResponse } from '../../../core/models/api-response.model';
import { ApiClientService } from '../../../core/services/api-client.service';
import { AttemptStatus, AvailableContract } from '../models/generation.model';
import { safeFileName } from './file-saver.service';
import type {
  AttemptLookup, AttemptRecovery, ContractCatalog, ContractOption, DownloadedFile, PackageDownload
} from './generation-ports';

const GENERATION_ROOT = '/api/v1/generation';
const CATALOG_FAILED = 'Unable to load the available contracts.';
const LOOKUP_FAILED = 'Unable to check the generation attempt.';
const ZIP_FAILED = 'The package could not be downloaded.';
/** The backend returns a generic 500 for incomplete, oversized or damaged packages. */
const ZIP_NOT_PREPARED = 'The package could not be prepared. The run may be incomplete, larger than 512 files or 64 MiB, or it failed its integrity check.';
const ZIP_FORBIDDEN = 'Downloading the package needs access to its project, page and metadata versions.';

function inline(): HttpContext {
  return new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
}

function unwrap<T>(response: ApiResponse<T>, fallbackMessage: string): T {
  if (response.status !== 'OK' || response.body === null) {
    throw new ApiException(response.statusCode, response.clientMessage?.trim() || fallbackMessage, response.errors);
  }
  return response.body;
}

/** `GET /api/v1/generation/contracts?output=BACKEND`. There is no fallback list. */
@Injectable({ providedIn: 'root' })
export class HttpContractCatalog implements ContractCatalog {
  private readonly api = inject(ApiClientService);

  listBackendContracts(): Observable<ContractOption[]> {
    return this.api.get<AvailableContract[]>(`${GENERATION_ROOT}/contracts?output=BACKEND`, inline()).pipe(
      map(response => unwrap(response, CATALOG_FAILED).map(contract => ({
        contractId: contract.contractId,
        contractVersion: contract.contractVersion,
        label: contract.label,
        operationIds: [...contract.operationIds],
        pageCompatibilityChecked: contract.pageCompatibilityChecked
      }))),
      catchError(error => throwError(() => toApiException(error, CATALOG_FAILED)))
    );
  }
}

/** `GET /api/v1/generation/attempts/{attemptId}`: owner-scoped and read-only. */
@Injectable({ providedIn: 'root' })
export class HttpAttemptRecovery implements AttemptRecovery {
  readonly available = true;
  private readonly api = inject(ApiClientService);

  findRun(attemptId: string): Observable<AttemptLookup> {
    return this.api.get<AttemptStatus>(`${GENERATION_ROOT}/attempts/${encodeURIComponent(attemptId)}`, inline()).pipe(
      map((response): AttemptLookup => {
        const attempt = unwrap(response, LOOKUP_FAILED);
        return {
          kind: 'found',
          runId: attempt.runId,
          status: attempt.status,
          metadataVersionId: attempt.metadataVersionId,
          failureStage: attempt.failureStage,
          failureCode: attempt.failureCode
        };
      }),
      // Missing and other users' attempts are both 404 by design.
      catchError(error => error instanceof HttpErrorResponse && error.status === 404
        ? of<AttemptLookup>({ kind: 'not-found' })
        : throwError(() => toApiException(error, LOOKUP_FAILED)))
    );
  }
}

/** `GET /api/v1/generation/runs/{runId}/package.zip`: the verified complete BACKEND package. */
@Injectable({ providedIn: 'root' })
export class HttpPackageDownload implements PackageDownload {
  readonly available = true;
  private readonly api = inject(ApiClientService);

  downloadZip(runId: string): Observable<DownloadedFile> {
    return this.api.getBlobResponse(`${GENERATION_ROOT}/runs/${encodeURIComponent(runId)}/package.zip`, inline()).pipe(
      map(response => {
        if (!response.body) {
          throw new ApiException(response.status, ZIP_FAILED, null);
        }
        return {
          blob: response.body,
          fileName: safeFileName(attachmentName(response.headers.get('Content-Disposition')) ?? `${runId}.zip`)
        };
      }),
      catchError(error => from(blobErrorToApiException(error, ZIP_FAILED)).pipe(
        switchMap(exception => throwError(() => zipException(exception)))
      ))
    );
  }
}

function zipException(exception: ApiException): ApiException {
  if (exception.statusCode >= 500) {
    return new ApiException(exception.statusCode, ZIP_NOT_PREPARED, exception.errors);
  }
  if (exception.statusCode === 403) {
    return new ApiException(403, ZIP_FORBIDDEN, exception.errors);
  }
  return exception;
}

/** The `filename` of an `attachment` Content-Disposition, if present. */
function attachmentName(header: string | null): string | null {
  const match = header ? /filename="?([^";]+)"?/i.exec(header) : null;
  return match ? match[1] : null;
}
