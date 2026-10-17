import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { toApiException } from '../../../core/http/api-error';
import { ApiException, ApiResponse } from '../../../core/models/api-response.model';
import { ApiClientService } from '../../../core/services/api-client.service';
import { MetadataVersion, Page, PagedBody, Project } from '../models/browser.model';

@Injectable({ providedIn: 'root' })
export class MetadataBrowserService {
  private readonly api = inject(ApiClientService);

  getProjects(): Observable<PagedBody<Project>> {
    return this.read<PagedBody<Project>>('/api/v1/projects', 'Unable to load projects.');
  }

  getProject(projectId: string): Observable<Project> {
    return this.read<Project>(`/api/v1/projects/${encodeURIComponent(projectId)}`, 'Unable to load the project.');
  }

  getPages(projectId: string): Observable<PagedBody<Page>> {
    return this.read<PagedBody<Page>>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/pages`,
      'Unable to load pages.'
    );
  }

  getPage(projectId: string, pageId: string): Observable<Page> {
    return this.read<Page>(
      `/api/v1/projects/${encodeURIComponent(projectId)}/pages/${encodeURIComponent(pageId)}`,
      'Unable to load the page.'
    );
  }

  getVersions(pageId: string): Observable<PagedBody<MetadataVersion>> {
    return this.read<PagedBody<MetadataVersion>>(
      `/api/v1/pages/${encodeURIComponent(pageId)}/metadata`,
      'Unable to load version history.'
    );
  }

  private read<T>(path: string, fallbackMessage: string): Observable<T> {
    return this.api.get<T>(path).pipe(
      map(response => this.unwrap(response, fallbackMessage)),
      catchError(error => throwError(() => toApiException(error, fallbackMessage)))
    );
  }

  private unwrap<T>(response: ApiResponse<T>, fallbackMessage: string): T {
    if (response.status !== 'OK' || response.body === null) {
      throw toApiException(
        new ApiException(
          response.statusCode,
          response.clientMessage?.trim() || fallbackMessage,
          response.errors
        ),
        fallbackMessage
      );
    }

    return response.body;
  }
}
