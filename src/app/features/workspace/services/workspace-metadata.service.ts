import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, throwError } from 'rxjs';
import { toApiException } from '../../../core/http/api-error';
import { SKIP_ERROR_NOTIFICATION } from '../../../core/interceptors/error.interceptor';
import { ApiException, ApiResponse } from '../../../core/models/api-response.model';
import { ApiClientService } from '../../../core/services/api-client.service';
import { MetadataVersion } from '../../projects/models/browser.model';

const LOAD_FAILED = 'Unable to load the current metadata version.';
const SAVE_FAILED = 'The metadata version could not be saved.';

/** Metadata reads and immutable-version writes; these endpoints are merged on backend develop. */
@Injectable({ providedIn: 'root' })
export class WorkspaceMetadataService {
  private readonly api = inject(ApiClientService);
  private readonly inline = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);

  /** The page's selected version, or null when the page has none yet. */
  getCurrent(pageId: string): Observable<MetadataVersion | null> {
    return this.api.get<MetadataVersion>(`${metadataPath(pageId)}/current`, this.inline).pipe(
      map(response => unwrap(response, LOAD_FAILED)),
      catchError(error => error instanceof HttpErrorResponse && error.status === 404
        ? of(null)
        : throwError(() => toApiException(error, LOAD_FAILED)))
    );
  }

  /** Creates a new immutable version; the backend makes it the page's current version. */
  createVersion(pageId: string, schemaVersion: string, snapshot: unknown): Observable<MetadataVersion> {
    return this.api.post<MetadataVersion>(metadataPath(pageId), { schemaVersion, snapshot }, this.inline).pipe(
      map(response => unwrap(response, SAVE_FAILED)),
      catchError(error => throwError(() => toApiException(error, SAVE_FAILED)))
    );
  }
}

function metadataPath(pageId: string): string {
  return `/api/v1/pages/${encodeURIComponent(pageId)}/metadata`;
}

function unwrap<T>(response: ApiResponse<T>, fallbackMessage: string): T {
  if (response.status !== 'OK' || response.body === null) {
    throw new ApiException(response.statusCode, response.clientMessage?.trim() || fallbackMessage, response.errors);
  }
  return response.body;
}
