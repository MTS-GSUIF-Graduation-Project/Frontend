import { HttpClient, HttpContext, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiEndpoints } from '../http/api-endpoints';
import { ApiResponse } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class ApiClientService {
  private readonly http = inject(HttpClient);
  private readonly endpoints = inject(ApiEndpoints);

  get<T>(path: string, context?: HttpContext): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(this.endpoints.url(path), { context });
  }

  post<T>(path: string, body: unknown, context?: HttpContext): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(this.endpoints.url(path), body, { context });
  }

  /** Like `post`, but keeps the full response so callers can read headers. */
  postResponse<T>(path: string, body: unknown, context?: HttpContext): Observable<HttpResponse<ApiResponse<T>>> {
    return this.http.post<ApiResponse<T>>(this.endpoints.url(path), body, { context, observe: 'response' });
  }

  /** Binary download. Error bodies arrive as a Blob; read them with `blobErrorToApiException`. */
  getBlob(path: string, params: Record<string, string> = {}, context?: HttpContext): Observable<Blob> {
    return this.http.get(this.endpoints.url(path), {
      context,
      params: new HttpParams({ fromObject: params }),
      responseType: 'blob'
    });
  }
}
