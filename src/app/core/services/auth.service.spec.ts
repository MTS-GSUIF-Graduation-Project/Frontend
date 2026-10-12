import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    sessionStorage.clear();
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        { provide: Router, useValue: router }
      ]
    });

    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('posts login credentials, stores the approved session, and navigates home', () => {
    const consoleSpy = vi.spyOn(console, 'log');

    service.login({ username: 'developer', password: 'secret' }).subscribe(session => {
      expect(session.username).toBe('developer');
    });

    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ username: 'developer', password: 'secret' });

    request.flush({
      status: 'OK',
      clientMessage: 'Authentication successful',
      statusCode: 200,
      body: {
        token: 'jwt-value',
        tokenType: 'Bearer',
        username: 'developer',
        roles: ['ROLE_USER']
      },
      errors: null
    });

    expect(JSON.parse(sessionStorage.getItem('gsuif.auth') ?? '{}')).toEqual({
      token: 'jwt-value',
      tokenType: 'Bearer',
      username: 'developer',
      roles: ['ROLE_USER']
    });
    expect(router.navigate).toHaveBeenCalledWith(['/home']);
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('leaves storage empty on failed login', () => {
    service.login({ username: 'developer', password: 'bad' }).subscribe({
      error: error => {
        expect(error.clientMessage).toBe('Invalid username or password');
      }
    });

    http.expectOne('/api/auth/login').flush({
      status: 'UNAUTHORIZED',
      clientMessage: 'Invalid username or password',
      statusCode: 401,
      body: null,
      errors: null
    }, { status: 401, statusText: 'Unauthorized' });

    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('clears storage on logout and returns to the landing page', () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: 'jwt-value',
      tokenType: 'Bearer',
      username: 'developer',
      roles: []
    }));

    service.logout();

    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('reports login state and roles only from the approved session key', () => {
    expect(service.isLoggedIn()).toBe(false);
    expect(service.getUserRoles()).toEqual([]);
    expect(service.hasRole('ROLE_USER')).toBe(false);

    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: jwtWithExp(futureExp()),
      tokenType: 'Bearer',
      username: 'developer',
      roles: ['ROLE_USER']
    }));

    expect(service.isLoggedIn()).toBe(true);
    expect(service.getUserRoles()).toEqual(['ROLE_USER']);
    expect(service.hasRole('ROLE_USER')).toBe(true);
  });

  it('rejects a missing token', () => {
    expect(service.getToken()).toBeNull();
    expect(service.isLoggedIn()).toBe(false);
  });

  it('clears a stored session that has no token', () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      username: 'developer',
      roles: ['ROLE_USER']
    }));

    expect(service.isLoggedIn()).toBe(false);
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
  });

  it('clears session data that is not JSON', () => {
    sessionStorage.setItem('gsuif.auth', '{');

    expect(service.isLoggedIn()).toBe(false);
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
  });

  it('clears a malformed token', () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: 'not-a-jwt',
      tokenType: 'Bearer',
      username: 'developer',
      roles: ['ROLE_USER']
    }));

    expect(service.getToken()).toBeNull();
    expect(service.isLoggedIn()).toBe(false);
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
  });

  it('clears an expired token', () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: jwtWithExp(Math.floor(Date.now() / 1000) - 60),
      tokenType: 'Bearer',
      username: 'developer',
      roles: ['ROLE_USER']
    }));

    expect(service.isLoggedIn()).toBe(false);
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
  });

  it('keeps a valid unexpired token', () => {
    const token = jwtWithExp(futureExp());
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token,
      tokenType: 'Bearer',
      username: 'developer',
      roles: ['ROLE_USER']
    }));

    expect(service.getToken()).toBe(token);
    expect(service.isLoggedIn()).toBe(true);
    expect(sessionStorage.getItem('gsuif.auth')).not.toBeNull();
  });
});

function futureExp(): number {
  return Math.floor(Date.now() / 1000) + 3600;
}

function jwtWithExp(exp: number): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.sig`;
}
