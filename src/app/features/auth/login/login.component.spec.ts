import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { NEVER, Subject, throwError } from 'rxjs';
import { SharedModule } from '../../../shared/shared.module';
import { ApiException } from '../../../core/models/api-response.model';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingService } from '../../../core/services/loading.service';
import { NOTIFICATION_DURATION_MS, NotificationService } from '../../../core/services/notification.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let auth: { login: ReturnType<typeof vi.fn> };
  let notifications: NotificationService;

  beforeEach(async () => {
    vi.useFakeTimers();
    auth = { login: vi.fn() };

    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [ReactiveFormsModule, SharedModule],
      providers: [
        LoadingService,
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl: '/projects' }) } } }
      ]
    }).compileComponents();

    notifications = TestBed.inject(NotificationService);
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    notifications.clear();
    vi.useRealTimers();
  });

  it('shows required validation and does not submit empty fields', () => {
    clickSubmit();
    fixture.detectChanges();

    expect(auth.login).not.toHaveBeenCalled();
    expect(text()).toContain('Username is required.');
    expect(text()).toContain('Password is required.');
  });

  it('submits the form values and the return URL to AuthService', () => {
    auth.login.mockReturnValue(NEVER);
    fillCredentials();

    clickSubmit();

    expect(auth.login).toHaveBeenCalledWith({ username: 'developer', password: 'secret' }, '/projects');
  });

  it('disables the submit button while loading', () => {
    const loading = TestBed.inject(LoadingService);

    loading.begin('login');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Signing in');

    loading.end('login');
  });

  it('shows a request-level failure once as a toast, not inline', () => {
    failLogin(new ApiException(401, 'Invalid username or password', null));

    expect(notifications.message()).toBe('Invalid username or password');
    expect(fixture.nativeElement.querySelector('.field-error')).toBeNull();
    expect(input('password').value).toBe('');
  });

  it('classifies a server failure by HTTP status', () => {
    failLogin(new HttpErrorResponse({ status: 502, error: '<html>Bad Gateway</html>' }));

    expect(notifications.message()).toBe('The service is temporarily unavailable.');
  });

  it('dismisses the failure toast automatically after 5 seconds', () => {
    failLogin(new ApiException(0, 'Unable to reach the server.', null));

    vi.advanceTimersByTime(NOTIFICATION_DURATION_MS - 1);
    expect(notifications.message()).toBe('Unable to reach the server.');

    vi.advanceTimersByTime(1);
    expect(notifications.message()).toBeNull();
  });

  it.each(['username', 'password'] as const)('dismisses the failure toast as soon as %s is edited', field => {
    failLogin(new ApiException(401, 'Invalid username or password', null));

    type(field, 'x');

    expect(notifications.message()).toBeNull();
  });

  it('does not dismiss an unrelated notification when a credential is edited', () => {
    failLogin(new ApiException(401, 'Invalid username or password', null));
    notifications.show('Your session has expired. Please sign in again.');

    type('username', 'x');

    expect(notifications.message()).toBe('Your session has expired. Please sign in again.');
  });

  it('clears the previous failure toast when a new attempt starts', () => {
    failLogin(new ApiException(401, 'Invalid username or password', null));
    auth.login.mockReturnValue(NEVER);
    fillCredentials();

    clickSubmit();

    expect(notifications.message()).toBeNull();
  });

  it('ignores a stale response from an earlier attempt', () => {
    const first = new Subject<never>();
    const second = new Subject<never>();
    auth.login.mockReturnValueOnce(first).mockReturnValueOnce(second);
    fillCredentials();

    clickSubmit();
    clickSubmit();
    first.error(new ApiException(0, 'Unable to reach the server.', null));

    expect(first.observed).toBe(false);
    expect(notifications.message()).toBeNull();
    expect(TestBed.inject(LoadingService).isBusy('login')).toBe(true);

    second.error(new ApiException(401, 'Invalid username or password', null));
    expect(notifications.message()).toBe('Invalid username or password');
    expect(TestBed.inject(LoadingService).isBusy('login')).toBe(false);
  });

  it('shows server field errors inline and clears only the edited field', () => {
    failLogin(new ApiException(400, 'Validation failed', {
      username: 'Username must be at least 3 characters',
      password: 'Password is too short'
    }));

    expect(notifications.message()).toBeNull();
    expect(text()).toContain('Username must be at least 3 characters');
    expect(text()).toContain('Password is too short');
    expect(input('username').getAttribute('aria-invalid')).toBe('true');

    type('password', 'longer-secret');

    expect(text()).not.toContain('Password is too short');
    expect(text()).toContain('Username must be at least 3 characters');

    type('username', 'developer');

    expect(text()).not.toContain('Username must be at least 3 characters');
    expect(input('username').getAttribute('aria-invalid')).toBe('false');
  });

  it('keeps client-side required validation after a server field error is cleared', () => {
    failLogin(new ApiException(400, 'Validation failed', { username: 'Unknown user' }));

    type('username', '');
    fixture.componentInstance.form.controls.username.markAsTouched();
    fixture.detectChanges();

    expect(text()).not.toContain('Unknown user');
    expect(text()).toContain('Username is required.');
  });

  function failLogin(error: unknown): void {
    auth.login.mockReturnValue(throwError(() => error));
    fillCredentials();
    clickSubmit();
    fixture.detectChanges();
  }

  function fillCredentials(): void {
    fixture.componentInstance.form.setValue({ username: 'developer', password: 'secret' });
  }

  function type(field: 'username' | 'password', value: string): void {
    const element = input(field);
    element.value = value;
    element.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function input(field: 'username' | 'password'): HTMLInputElement {
    return fixture.nativeElement.querySelector(`#${field}`) as HTMLInputElement;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function clickSubmit(): void {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
  }
});
