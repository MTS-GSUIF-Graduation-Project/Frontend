import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, tap, throwError } from 'rxjs';
import { isUnexpiredJwt } from '../auth/session-token';
import { ApiException, ApiResponse } from '../models/api-response.model';
import { AuthSession, LoginRequest } from '../models/auth.model';
import { ApiClientService } from './api-client.service';

const STORAGE_KEY = 'gsuif.auth';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiClient = inject(ApiClientService);
  private readonly router = inject(Router);

  login(credentials: LoginRequest): Observable<AuthSession> {
    return this.apiClient.post<AuthSession>('/api/auth/login', credentials).pipe(
      map(response => this.unwrapLogin(response)),
      tap(session => this.writeSession(session)),
      tap(() => void this.router.navigate(['/home'])),
      catchError(error => throwError(() => this.toApiException(error)))
    );
  }

  logout(): void {
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  clearSession(): void {
    sessionStorage.removeItem(STORAGE_KEY);
  }

  isLoggedIn(): boolean {
    return this.getToken() !== null;
  }

  getToken(): string | null {
    return this.readSession()?.token ?? null;
  }

  getUsername(): string {
    return this.readSession()?.username ?? '';
  }

  getUserRoles(): string[] {
    return this.readSession()?.roles ?? [];
  }

  hasRole(role: string): boolean {
    return this.getUserRoles().includes(role);
  }

  private unwrapLogin(response: ApiResponse<AuthSession>): AuthSession {
    if (response.status === 'OK' && response.errors === null && response.body) {
      return response.body;
    }

    throw new ApiException(response.statusCode, response.clientMessage || 'Sign-in failed.', response.errors);
  }

  private writeSession(session: AuthSession): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      token: session.token,
      tokenType: session.tokenType || 'Bearer',
      username: session.username,
      roles: Array.isArray(session.roles) ? session.roles : []
    }));
  }

  private readSession(): AuthSession | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<AuthSession>;
      const token = typeof parsed.token === 'string' ? parsed.token.trim() : '';

      if (!isUnexpiredJwt(token)) {
        this.clearSession();
        return null;
      }

      return {
        token,
        tokenType: typeof parsed.tokenType === 'string' ? parsed.tokenType : 'Bearer',
        username: typeof parsed.username === 'string' ? parsed.username : '',
        roles: Array.isArray(parsed.roles) ? parsed.roles.filter(role => typeof role === 'string') : []
      };
    } catch {
      this.clearSession();
      return null;
    }
  }

  private toApiException(error: unknown): ApiException {
    if (error instanceof ApiException) {
      return error;
    }

    if (typeof error === 'object' && error !== null && 'error' in error) {
      const body = (error as { error?: Partial<ApiResponse<unknown>> }).error;
      return new ApiException(
        typeof body?.statusCode === 'number' ? body.statusCode : 0,
        body?.clientMessage || 'Unable to reach the server.',
        body?.errors ?? null
      );
    }

    return new ApiException(0, 'Unable to reach the server.', null);
  }
}
