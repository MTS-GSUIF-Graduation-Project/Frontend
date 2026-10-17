import { DOCUMENT } from '@angular/common';
import { Injectable, InjectionToken, inject } from '@angular/core';

export interface ApiConfig {
  /** Origin serving `/api/**`. Empty means the app's own origin (dev proxy or same-origin deployment). */
  baseUrl: string;
}

export const API_CONFIG = new InjectionToken<ApiConfig>('API_CONFIG', {
  providedIn: 'root',
  factory: () => ({ baseUrl: '' })
});

export const LOGIN_PATH = '/api/auth/login';

const API_ROOT = '/api/';
const PUBLIC_PATHS = [LOGIN_PATH];

@Injectable({
  providedIn: 'root'
})
export class ApiEndpoints {
  private readonly baseUrl = inject(API_CONFIG).baseUrl.replace(/\/+$/, '');
  private readonly documentBase = inject(DOCUMENT).baseURI;
  private readonly apiRoot = this.resolve(this.url(API_ROOT));
  private readonly publicPathnames = PUBLIC_PATHS.map(path => this.resolve(this.url(path))?.pathname);

  url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  isProtected(requestUrl: string): boolean {
    const target = this.resolve(requestUrl);

    if (!target || !this.apiRoot || target.origin !== this.apiRoot.origin || !target.pathname.startsWith(this.apiRoot.pathname)) {
      return false;
    }

    return !this.publicPathnames.includes(target.pathname);
  }

  private resolve(url: string): URL | null {
    try {
      return new URL(url, this.documentBase);
    } catch {
      return null;
    }
  }
}
