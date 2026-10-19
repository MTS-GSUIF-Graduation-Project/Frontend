import { HttpErrorResponse } from '@angular/common/http';
import { ApiException } from '../models/api-response.model';

const NETWORK_ERROR_MESSAGE = 'Unable to reach the server.';
const UNAVAILABLE_MESSAGE = 'The service is temporarily unavailable.';
const SERVER_ERROR_MESSAGE = 'An unexpected server error occurred.';

const UNAVAILABLE_STATUSES = new Set([502, 503, 504]);

/**
 * The HTTP status is authoritative; the GSUIF `ApiResponse` envelope only supplies
 * `clientMessage` and field `errors` when the body actually has that shape.
 */
export function toApiException(error: unknown, fallbackMessage: string): ApiException {
  if (error instanceof ApiException) {
    return error;
  }

  if (!(error instanceof HttpErrorResponse)) {
    return new ApiException(0, fallbackMessage, null);
  }

  const body = isRecord(error.error) ? error.error : null;
  const clientMessage = typeof body?.['clientMessage'] === 'string' ? body['clientMessage'].trim() : '';

  return new ApiException(
    error.status,
    clientMessage || statusMessage(error.status, fallbackMessage),
    fieldErrors(body?.['errors'])
  );
}

/**
 * Binary requests (`responseType: 'blob'`) deliver the JSON error envelope as a Blob.
 * Read it so callers get the same `ApiException` as for JSON requests.
 */
export async function blobErrorToApiException(error: unknown, fallbackMessage: string): Promise<ApiException> {
  if (!(error instanceof HttpErrorResponse) || !(error.error instanceof Blob)) {
    return toApiException(error, fallbackMessage);
  }

  let body: unknown = null;
  try {
    body = JSON.parse(await error.error.text());
  } catch {
    body = null;
  }

  return toApiException(new HttpErrorResponse({
    error: body,
    headers: error.headers,
    status: error.status,
    statusText: error.statusText,
    url: error.url ?? undefined
  }), fallbackMessage);
}

function statusMessage(status: number, fallbackMessage: string): string {
  if (status === 0) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (UNAVAILABLE_STATUSES.has(status)) {
    return UNAVAILABLE_MESSAGE;
  }

  return status >= 500 ? SERVER_ERROR_MESSAGE : fallbackMessage;
}

function fieldErrors(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null;
  }

  const entries = Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string');
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
