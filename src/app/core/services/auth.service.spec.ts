import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { ApiException } from '../models/api-response.model';
import { AuthSession } from '../models/auth.model';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;
  let router: { navigate: ReturnType<typeof vi.fn>; navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    sessionStorage.clear();
    router = { navigate: vi.fn(), navigateByUrl: vi.fn() };

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

  it('posts login credentials, stores the validated session, and navigates home', () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const token = jwtWithExp(futureExp());
    let session: AuthSession | undefined;

    service.login({ username: 'developer', password: 'secret' }).subscribe(value => session = value);

    const request = http.expectOne('/api/auth/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ username: 'developer', password: 'secret' });

    request.flush(loginResponse({ token, tokenType: 'Bearer', username: 'developer', roles: ['ROLE_USER'] }));

    expect(session?.username).toBe('developer');
    expect(JSON.parse(sessionStorage.getItem('gsuif.auth') ?? '{}')).toEqual({
      token,
      tokenType: 'Bearer',
      username: 'developer',
      roles: ['ROLE_USER']
    });
    expect(service.isLoggedIn()).toBe(true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('navigates to a safe internal return URL after login', () => {
    login('/projects?tab=pages', validBody());

    expect(router.navigateByUrl).toHaveBeenCalledWith('/projects?tab=pages');
  });

  it.each([
    'https://evil.test/home',
    '//evil.test/home',
    '/\\evil.test',
    'javascript:alert(1)',
    '/login?returnUrl=/home'
  ])('ignores the unsafe return URL %s', returnUrl => {
    login(returnUrl, validBody());

    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });

  it.each([
    ['a missing token', { tokenType: 'Bearer', username: 'developer', roles: [] }],
    ['a malformed token', { token: 'jwt-value', tokenType: 'Bearer', username: 'developer', roles: [] }],
    ['an expired token', { token: jwtWithExp(Math.floor(Date.now() / 1000) - 60), tokenType: 'Bearer', username: 'developer', roles: [] }],
    ['an unexpected token type', { token: jwtWithExp(futureExp()), tokenType: 'Basic', username: 'developer', roles: [] }],
    ['missing roles', { token: jwtWithExp(futureExp()), tokenType: 'Bearer', username: 'developer' }],
    ['a padded token', { token: ` ${jwtWithExp(futureExp())} `, tokenType: 'Bearer', username: 'developer', roles: [] }]
  ])('rejects a login response with %s without storing or navigating', (_label, body) => {
    const error = login(null, body);

    expect(error).toBeInstanceOf(ApiException);
    expect(error?.clientMessage).toBe('Sign-in failed because the server returned an invalid session. Please try again.');
    expectNoSession();
  });

  it('rejects an unexpected login envelope without storing or navigating', () => {
    let error: ApiException | undefined;
    service.login({ username: 'developer', password: 'secret' }).subscribe({ error: value => error = value });

    http.expectOne('/api/auth/login').flush({ token: jwtWithExp(futureExp()) });

    expect(error?.clientMessage).toBe('Sign-in failed.');
    expectNoSession();
  });

  it('rejects an OK envelope that also carries errors', () => {
    let error: ApiException | undefined;
    service.login({ username: 'developer', password: 'secret' }).subscribe({ error: value => error = value });

    http.expectOne('/api/auth/login').flush({ ...loginResponse(validBody()), errors: { token: 'unexpected' } });

    expect(error?.clientMessage).toBe('Sign-in failed because the server returned an invalid session. Please try again.');
    expectNoSession();
  });

  it('leaves storage empty on failed login', () => {
    let error: ApiException | undefined;
    service.login({ username: 'developer', password: 'bad' }).subscribe({ error: value => error = value });

    http.expectOne('/api/auth/login').flush({
      status: 'UNAUTHORIZED',
      clientMessage: 'Invalid username or password',
      statusCode: 401,
      body: null,
      errors: null
    }, { status: 401, statusText: 'Unauthorized' });

    expect(error?.statusCode).toBe(401);
    expect(error?.clientMessage).toBe('Invalid username or password');
    expectNoSession();
  });

  it('classifies an HTML 500 login failure by its HTTP status', () => {
    let error: ApiException | undefined;
    service.login({ username: 'developer', password: 'secret' }).subscribe({ error: value => error = value });

    http.expectOne('/api/auth/login').flush('<html>Internal Server Error</html>', { status: 500, statusText: 'Server Error' });

    expect(error?.statusCode).toBe(500);
    expect(error?.clientMessage).toBe('An unexpected server error occurred.');
    expectNoSession();
  });

  it('reports a network failure as unreachable', () => {
    let error: ApiException | undefined;
    service.login({ username: 'developer', password: 'secret' }).subscribe({ error: value => error = value });

    http.expectOne('/api/auth/login').error(new ProgressEvent('error'));

    expect(error?.statusCode).toBe(0);
    expect(error?.clientMessage).toBe('Unable to reach the server.');
    expectNoSession();
  });

  function login(returnUrl: string | null, body: unknown): ApiException | undefined {
    let error: ApiException | undefined;
    service.login({ username: 'developer', password: 'secret' }, returnUrl).subscribe({ error: value => error = value });
    http.expectOne('/api/auth/login').flush(loginResponse(body));
    return error;
  }

  function expectNoSession(): void {
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
    expect(service.isLoggedIn()).toBe(false);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  }

  it('clears storage on logout', () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: 'jwt-value',
      tokenType: 'Bearer',
      username: 'developer',
      roles: []
    }));

    service.logout();

    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
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

  it('keeps a structurally valid JWT whose signature is not verified client-side', () => {
    const token = jwtWithInvalidSignature(futureExp());
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

function validBody(): AuthSession {
  return { token: jwtWithExp(futureExp()), tokenType: 'Bearer', username: 'developer', roles: ['ROLE_USER'] };
}

function loginResponse(body: unknown): object {
  return { status: 'OK', clientMessage: 'Authentication successful', statusCode: 200, body, errors: null };
}

function jwtWithExp(exp: number): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.sig`;
}

function jwtWithInvalidSignature(exp: number): string {
  const [header, payload] = jwtWithExp(exp).split('.');
  return `${header}.${payload}.dGFtcGVyZWQ`;
}
