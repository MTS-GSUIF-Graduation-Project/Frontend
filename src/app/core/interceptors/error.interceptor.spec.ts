import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SKIP_ERROR_NOTIFICATION, errorInterceptor } from './error.interceptor';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: { clearSession: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn>; url: string };
  let notifications: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = { clearSession: vi.fn() };
    router = { navigate: vi.fn(), url: '/projects' };
    notifications = { show: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
        { provide: NotificationService, useValue: notifications }
      ]
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('does not redirect, clear auth, or notify for login errors', () => {
    http.post('/api/auth/login', { username: 'developer', password: 'bad' }).subscribe({ error: () => undefined });

    controller.expectOne('/api/auth/login').flush({
      clientMessage: 'Invalid username or password'
    }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('clears auth, redirects with the current route, and notifies for a protected 401', () => {
    http.get('/api/v1/projects').subscribe({ error: () => undefined });

    controller.expectOne('/api/v1/projects').flush({
      clientMessage: 'Authentication required'
    }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.clearSession).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/projects' } });
    expect(notifications.show).toHaveBeenCalledWith('Your session has expired. Please sign in again.');
  });

  it('keeps the original return URL when another protected 401 arrives on the login page', () => {
    router.url = '/login?returnUrl=%2Fprojects';
    http.get('/api/v1/projects').subscribe({ error: () => undefined });

    controller.expectOne('/api/v1/projects').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.clearSession).toHaveBeenCalledOnce();
    expect(notifications.show).toHaveBeenCalledWith('Your session has expired. Please sign in again.');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('keeps the GSUIF session when an external service returns 401', () => {
    http.get('https://maps.example.com/api/v1/tiles').subscribe({ error: () => undefined });

    controller.expectOne('https://maps.example.com/api/v1/tiles').flush({
      clientMessage: 'Bad API key'
    }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('notifies without redirecting for a protected server error', () => {
    http.get('/api/v1/projects').subscribe({ error: () => undefined });

    controller.expectOne('/api/v1/projects').flush({
      clientMessage: 'Projects are temporarily unavailable'
    }, { status: 500, statusText: 'Server Error' });

    expect(notifications.show).toHaveBeenCalledOnce();
    expect(notifications.show).toHaveBeenCalledWith('Projects are temporarily unavailable');
    expect(auth.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('skips the global notification when the caller renders errors inline', () => {
    const context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
    http.post('/api/v1/generation/backend', {}, { context }).subscribe({ error: () => undefined });

    controller.expectOne('/api/v1/generation/backend').flush({
      clientMessage: 'Invalid generation request'
    }, { status: 400, statusText: 'Bad Request' });

    expect(notifications.show).not.toHaveBeenCalled();
    expect(auth.clearSession).not.toHaveBeenCalled();
  });

  it('still clears the session for a 401 on a request that skips notifications', () => {
    const context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
    http.post('/api/v1/generation/backend', {}, { context }).subscribe({ error: () => undefined });

    controller.expectOne('/api/v1/generation/backend').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.clearSession).toHaveBeenCalledOnce();
    expect(notifications.show).toHaveBeenCalledWith('Your session has expired. Please sign in again.');
  });

  it('classifies an HTML 502 by its HTTP status', () => {
    http.get('/api/v1/projects').subscribe({ error: () => undefined });

    controller.expectOne('/api/v1/projects').flush('<html>Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' });

    expect(notifications.show).toHaveBeenCalledWith('The service is temporarily unavailable.');
  });
});
