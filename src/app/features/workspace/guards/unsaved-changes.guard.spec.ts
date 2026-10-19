import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CONFIRM_LEAVE, LeaveWarning, unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  let loggedIn: boolean;
  let confirm: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    loggedIn = true;
    confirm = vi.fn(() => false);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn: () => loggedIn } },
        { provide: CONFIRM_LEAVE, useValue: confirm }
      ]
    });
  });

  function leave(warning: string | null): unknown {
    const component: LeaveWarning = { leaveWarning: () => warning };
    return TestBed.runInInjectionContext(() => unsavedChangesGuard(
      component, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot
    ));
  }

  it('lets the user leave when nothing would be lost', () => {
    expect(leave(null)).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('asks before leaving unsaved work and respects the answer', () => {
    expect(leave('You have unsaved metadata changes.')).toBe(false);
    expect(confirm).toHaveBeenCalledWith('You have unsaved metadata changes.');
  });

  it('never blocks the sign-in redirect after the session has ended', () => {
    loggedIn = false;

    expect(leave('You have unsaved metadata changes.')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
  });
});
