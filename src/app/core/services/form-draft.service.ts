import { Injectable, inject } from '@angular/core';
import { AuthService } from './auth.service';

const PREFIX = 'gsuif.form-draft.';

/**
 * Unsubmitted form input kept in this browser tab's sessionStorage, scoped to the
 * signed-in username and a form context such as `project-create` or
 * `page-create:<projectId>`. Nothing is stored without a signed-in user, and drafts
 * never hold credentials or tokens.
 */
@Injectable({ providedIn: 'root' })
export class FormDraftService {
  private readonly auth = inject(AuthService);

  read(context: string): Record<string, string> | null {
    const key = this.key(context);
    if (!key) {
      return null;
    }
    try {
      const raw = sessionStorage.getItem(key);
      const value: unknown = raw === null ? null : JSON.parse(raw);
      return isStringRecord(value) ? value : null;
    } catch {
      return null;
    }
  }

  write(context: string, values: Record<string, string>): void {
    const key = this.key(context);
    if (!key) {
      return;
    }
    try {
      sessionStorage.setItem(key, JSON.stringify(values));
    } catch {
      // Storage can be unavailable or full; the form itself still works.
    }
  }

  clear(context: string): void {
    const key = this.key(context);
    if (!key) {
      return;
    }
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Nothing to clean up if storage is unavailable.
    }
  }

  private key(context: string): string | null {
    const username = this.auth.getUsername();
    return username ? `${PREFIX}${encodeURIComponent(username)}.${context}` : null;
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.values(value).every(item => typeof item === 'string');
}
