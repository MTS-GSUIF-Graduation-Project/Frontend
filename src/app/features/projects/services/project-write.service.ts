import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { toApiException } from '../../../core/http/api-error';
import { SKIP_ERROR_NOTIFICATION } from '../../../core/interceptors/error.interceptor';
import { ApiResponse } from '../../../core/models/api-response.model';
import { ApiClientService } from '../../../core/services/api-client.service';
import { CreatePageRequest, CreateProjectRequest, Page, Project } from '../models/browser.model';
import { MetadataBrowserService } from './metadata-browser.service';

/** How a creation request ended, as far as the client can tell. */
export type CreateOutcome<T> =
  | { kind: 'created'; value: T }
  | { kind: 'invalid'; message: string; fieldErrors: Record<string, string> }
  | { kind: 'forbidden'; message: string }
  | { kind: 'not-found'; message: string }
  | { kind: 'unauthenticated' }
  /** The request may or may not have been processed; nothing can be assumed. */
  | { kind: 'unknown'; message: string };

const UNCERTAIN_STATUSES = new Set([0, 408]);
const UNKNOWN_MESSAGE = 'The server did not confirm the result. It may or may not have been created.';
const REJECTED = 'The request was rejected.';

/**
 * Project and page creation over the endpoints merged on gsuif-backend develop
 * (ba12ec80ea77444f059a47ff18d7e1da835ebf7a). There is no idempotency key, so each
 * call sends exactly one POST and nothing here retries.
 */
@Injectable({ providedIn: 'root' })
export class ProjectWriteService {
  private readonly api = inject(ApiClientService);
  private readonly browser = inject(MetadataBrowserService);
  private readonly inline = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);

  createProject(request: CreateProjectRequest): Observable<CreateOutcome<Project>> {
    return this.create<Project>('/api/v1/projects', request);
  }

  createPage(projectId: string, request: CreatePageRequest): Observable<CreateOutcome<Page>> {
    return this.create<Page>(`/api/v1/projects/${encodeURIComponent(projectId)}/pages`, request);
  }

  /**
   * After an unknown outcome: looks for a project with this exact name among the most
   * recently created ones (the list's default first page, newest first). A match shows
   * that such a project exists, not that this request created it.
   */
  findRecentProject(name: string): Observable<Project | null> {
    return this.browser.getProjects().pipe(
      map(page => page.data.find(project => project.name === name.trim()) ?? null)
    );
  }

  /** As `findRecentProject`, for a page within one project. */
  findRecentPage(projectId: string, name: string): Observable<Page | null> {
    return this.browser.getPages(projectId).pipe(
      map(page => page.data.find(item => item.name === name.trim()) ?? null)
    );
  }

  private create<T>(path: string, body: unknown): Observable<CreateOutcome<T>> {
    return this.api.post<T>(path, body, this.inline).pipe(
      map((response: ApiResponse<T>): CreateOutcome<T> => response.status === 'OK' && response.body
        ? { kind: 'created', value: response.body }
        : { kind: 'unknown', message: UNKNOWN_MESSAGE }),
      catchError(error => of(classify<T>(error)))
    );
  }
}

function classify<T>(error: unknown): CreateOutcome<T> {
  if (!(error instanceof HttpErrorResponse) || UNCERTAIN_STATUSES.has(error.status) || error.status >= 500) {
    // A 5xx can follow a committed insert, so it is not proof that nothing was created.
    return { kind: 'unknown', message: UNKNOWN_MESSAGE };
  }

  const exception = toApiException(error, REJECTED);
  switch (error.status) {
    case 401:
      return { kind: 'unauthenticated' };
    case 403:
      return { kind: 'forbidden', message: exception.clientMessage };
    case 404:
      return { kind: 'not-found', message: exception.clientMessage };
    default:
      return { kind: 'invalid', message: exception.clientMessage, fieldErrors: exception.errors ?? {} };
  }
}
