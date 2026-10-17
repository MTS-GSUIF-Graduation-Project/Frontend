import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, tap, throwError } from 'rxjs';
import { isUnexpiredJwt } from '../auth/session-token';
import { LOGIN_PATH } from '../http/api-endpoints';
import { toApiException } from '../http/api-error';
import { ApiException, ApiResponse } from '../models/api-response.model';
import { AuthSession, LoginRequest } from '../models/auth.model';
import { ApiClientService } from './api-client.service';

const STORAGE_KEY = 'gsuif.auth';
const DEFAULT_ROUTE = '/home';
export const LOGIN_FAILED_MESSAGE = 'Sign-in failed.';
const INVALID_SESSION_MESSAGE = 'Sign-in failed because the server returned an invalid session. Please try again.';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly apiClient = inject(ApiClientService);
  private readonly router = inject(Router);

  login(credentials: LoginRequest, returnUrl: string | null = null): Observable<AuthSession> {
    return this.apiClient.post<AuthSession>(LOGIN_PATH, credentials).pipe(
      catchError(error => throwError(() => toApiException(error, LOGIN_FAILED_MESSAGE))),
      map(response => this.toSession(response)),
      tap(session => this.writeSession(session)),
      tap(() => void this.router.navigateByUrl(safeReturnUrl(returnUrl)))
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

  private toSession(response: ApiResponse<AuthSession> | null): AuthSession {
    if (response?.status !== 'OK') {
      throw new ApiException(response?.statusCode ?? 0, response?.clientMessage || LOGIN_FAILED_MESSAGE, response?.errors ?? null);
    }

    const session = response.errors === null ? parseSession(response.body) : null;

    if (!session) {
      throw new ApiException(response.statusCode, INVALID_SESSION_MESSAGE, null);
    }

    return session;
  }

  private writeSession(session: AuthSession): void {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  private readSession(): AuthSession | null {
    const raw = sessionStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    let session: AuthSession | null = null;

    try {
      session = parseSession(JSON.parse(raw));
    } catch {
      session = null;
    }

    if (!session) {
      this.clearSession();
    }

    return session;
  }
}

function parseSession(value: unknown): AuthSession | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }

  const { token, tokenType, username, roles } = value as Partial<Record<keyof AuthSession, unknown>>;

  if (
    typeof token !== 'string' || token !== token.trim() || !isUnexpiredJwt(token) ||
    tokenType !== 'Bearer' ||
    typeof username !== 'string' ||
    !Array.isArray(roles) || !roles.every(role => typeof role === 'string')
  ) {
    return null;
  }

  return { token, tokenType, username, roles };
}

function safeReturnUrl(url: string | null): string {
  if (!url || !url.startsWith('/') || url.startsWith('//') || url.startsWith('/\\') || url.split(/[?#]/)[0] === '/login') {
    return DEFAULT_ROUTE;
  }

  return url;
}
