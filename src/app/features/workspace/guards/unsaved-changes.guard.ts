import { DOCUMENT } from '@angular/common';
import { InjectionToken, inject } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/** Implemented by routes that can hold work the user would lose by leaving. */
export interface LeaveWarning {
  /** A message describing what would be lost, or null when leaving is safe. */
  leaveWarning(): string | null;
}

export const CONFIRM_LEAVE = new InjectionToken<(message: string) => boolean>('CONFIRM_LEAVE', {
  providedIn: 'root',
  factory: () => {
    const view = inject(DOCUMENT).defaultView;
    return (message: string) => view ? view.confirm(message) : true;
  }
});

/**
 * Asks before leaving with unsaved work. After the session ends (for example a 401
 * redirect to sign-in), leaving is always allowed; drafts stay in sessionStorage.
 */
export const unsavedChangesGuard: CanDeactivateFn<LeaveWarning> = component => {
  const warning = component.leaveWarning();
  if (!warning || !inject(AuthService).isLoggedIn()) {
    return true;
  }
  return inject(CONFIRM_LEAVE)(warning);
};
