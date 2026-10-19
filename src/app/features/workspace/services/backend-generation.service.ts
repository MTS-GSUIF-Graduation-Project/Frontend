import { HttpContext, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, from, map, of, switchMap, throwError } from 'rxjs';
import { blobErrorToApiException, toApiException } from '../../../core/http/api-error';
import { SKIP_ERROR_NOTIFICATION } from '../../../core/interceptors/error.interceptor';
import { ApiException, ApiResponse } from '../../../core/models/api-response.model';
import { ApiClientService } from '../../../core/services/api-client.service';
import {
  ArtifactText,
  BackendCreated,
  BackendGenerationRequest,
  FailureTracking,
  GenerationOutcome,
  RunDetails
} from '../models/generation.model';

const GENERATION_ROOT = '/api/v1/generation';
/** Larger files are offered for download instead of being rendered as text. */
export const MAX_VIEWABLE_BYTES = 512 * 1024;
const BINARY_PROBE_BYTES = 8 * 1024;

const UNKNOWN_OUTCOME = 'The connection ended before the server confirmed the result. Generation may still be running or may have finished.';
const UNRECOGNISED_RESPONSE = 'The server response was not recognised, so the result is not confirmed.';
const SERVER_ERROR_UNTRACKED = 'The server reported an unexpected error without a recorded attempt, so the attempt state is unknown.';
const REJECTED = 'The generation request was rejected.';
const FAILED = 'The generation attempt failed.';
const FORBIDDEN = 'You do not have access to generate from this page.';
const NOT_FOUND = 'The page or its selected metadata version was not found.';
const RUN_FAILED = 'Unable to load the generation run.';
const ARTIFACT_FAILED = 'Unable to load the generated file.';

/** Statuses after which the server may or may not have processed the request. */
const UNCERTAIN_STATUSES = new Set([0, 408, 502, 503, 504]);

/**
 * BACKEND generation over the endpoints verified on gsuif-backend PR #47 at
 * 9482e1fc25f405f0ec7a780b9f39ffbcf0b9bbc4. Requests are sent once; nothing here retries.
 */
@Injectable({ providedIn: 'root' })
export class BackendGenerationService {
  private readonly api = inject(ApiClientService);
  private readonly inline = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);

  /** Sends one generation request and reports how it ended. Never errors. */
  generate(request: BackendGenerationRequest): Observable<GenerationOutcome> {
    return this.api.postResponse<BackendCreated>(`${GENERATION_ROOT}/backend`, request, this.inline).pipe(
      map((response): GenerationOutcome => {
        const body = response.body;
        return body?.status === 'OK' && body.body
          ? { kind: 'success', result: body.body }
          : { kind: 'unknown', message: UNRECOGNISED_RESPONSE };
      }),
      catchError(error => of(classify(error)))
    );
  }

  getRun(runId: string): Observable<RunDetails> {
    return this.api.get<RunDetails>(`${GENERATION_ROOT}/runs/${encodeURIComponent(runId)}`, this.inline).pipe(
      map(response => unwrap(response, RUN_FAILED)),
      catchError(error => throwError(() => toApiException(error, RUN_FAILED)))
    );
  }

  /** Downloads one registered artifact of a run. */
  downloadArtifact(runId: string, path: string): Observable<Blob> {
    return this.api.getBlob(`${GENERATION_ROOT}/runs/${encodeURIComponent(runId)}/artifacts/download`, { path }, this.inline).pipe(
      catchError(error => from(blobErrorToApiException(error, ARTIFACT_FAILED)).pipe(
        switchMap(exception => throwError(() => exception))
      ))
    );
  }

  /** Reads an artifact for display as text; binary and oversized files are reported, not decoded. */
  readArtifactText(runId: string, path: string): Observable<ArtifactText> {
    return this.downloadArtifact(runId, path).pipe(
      switchMap(blob => from(toArtifactText(blob)))
    );
  }
}

async function toArtifactText(blob: Blob): Promise<ArtifactText> {
  if (blob.size > MAX_VIEWABLE_BYTES) {
    return { kind: 'too-large', size: blob.size };
  }

  const probe = new Uint8Array(await blob.slice(0, BINARY_PROBE_BYTES).arrayBuffer());
  if (probe.includes(0)) {
    return { kind: 'binary' };
  }

  return { kind: 'text', text: new TextDecoder('utf-8').decode(await blob.arrayBuffer()) };
}

function classify(error: unknown): GenerationOutcome {
  if (!(error instanceof HttpErrorResponse)) {
    return { kind: 'unknown', message: UNKNOWN_OUTCOME };
  }

  if (UNCERTAIN_STATUSES.has(error.status)) {
    return { kind: 'unknown', message: UNKNOWN_OUTCOME };
  }

  const tracking = trackingFrom(error.headers);

  switch (error.status) {
    case 400: {
      const exception = toApiException(error, REJECTED);
      const global = exception.errors?.['_global'] ?? '';
      // Same-attempt replay outcomes from BackendGenerationService.reserveOrReplay.
      if (global.startsWith('attemptId: already reserved or terminal')) {
        return { kind: 'attempt-unavailable', message: global };
      }
      if (global.startsWith('attemptId: bound to different inputs')) {
        return { kind: 'attempt-conflict', message: global };
      }
      return { kind: 'rejected', message: exception.clientMessage, errors: exception.errors, tracking };
    }
    case 401:
      return { kind: 'unauthenticated' };
    case 403:
      return { kind: 'forbidden', message: toApiException(error, FORBIDDEN).clientMessage };
    case 404:
      return { kind: 'not-found', message: toApiException(error, NOT_FOUND).clientMessage };
    default:
      if (tracking) {
        return { kind: 'failed', message: toApiException(error, FAILED).clientMessage, tracking };
      }
      return error.status >= 500
        ? { kind: 'unknown', message: SERVER_ERROR_UNTRACKED }
        : { kind: 'rejected', message: toApiException(error, REJECTED).clientMessage, errors: null, tracking: null };
  }
}

function trackingFrom(headers: HttpHeaders | null | undefined): FailureTracking | null {
  const runId = headers?.get('X-Generation-Run-Id');
  if (!runId) {
    return null;
  }
  return {
    runId,
    stage: headers?.get('X-Generation-Failure-Stage') ?? null,
    code: headers?.get('X-Generation-Failure-Code') ?? null
  };
}

function unwrap<T>(response: ApiResponse<T>, fallbackMessage: string): T {
  if (response.status !== 'OK' || response.body === null) {
    throw new ApiException(response.statusCode, response.clientMessage?.trim() || fallbackMessage, response.errors);
  }
  return response.body;
}
