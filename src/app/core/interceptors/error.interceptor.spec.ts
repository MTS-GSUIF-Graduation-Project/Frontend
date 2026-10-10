import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { errorInterceptor } from './error.interceptor';
import { AuthService } from '../services/auth.service';
import { NotificationService } from '../services/notification.service';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: { clearSession: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let notifications: { show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = { clearSession: vi.fn() };
    router = { navigate: vi.fn() };
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

  it('does not redirect or clear auth for login 401', () => {
    http.post('/api/auth/login', { username: 'developer', password: 'bad' }).subscribe({ error: () => undefined });

    controller.expectOne('/api/auth/login').flush({
      clientMessage: 'Invalid username or password'
    }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(notifications.show).not.toHaveBeenCalled();
  });

  it('clears auth, redirects, and notifies for non-login 401', () => {
    http.get('/api/v1/projects').subscribe({ error: () => undefined });

    controller.expectOne('/api/v1/projects').flush({
      clientMessage: 'Access denied'
    }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.clearSession).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(notifications.show).toHaveBeenCalledWith('Access denied');
  });

  it('notifies without redirecting for a non-login server error', () => {
    http.get('/api/v1/projects').subscribe({ error: () => undefined });

    controller.expectOne('/api/v1/projects').flush({
      clientMessage: 'Projects are temporarily unavailable'
    }, { status: 500, statusText: 'Server Error' });

    expect(notifications.show).toHaveBeenCalledOnce();
    expect(notifications.show).toHaveBeenCalledWith('Projects are temporarily unavailable');
    expect(auth.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('leaves login validation errors for LoginComponent to notify once', () => {
    http.post('/api/auth/login', { username: '', password: '' }).subscribe({ error: () => undefined });

    controller.expectOne('/api/auth/login').flush({
      clientMessage: 'Validation failed'
    }, { status: 400, statusText: 'Bad Request' });

    expect(notifications.show).not.toHaveBeenCalled();
    expect(auth.clearSession).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
