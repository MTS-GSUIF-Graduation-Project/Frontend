import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  it('allows navigation when authenticated', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn: () => true } },
        { provide: Router, useValue: { parseUrl: vi.fn() } }
      ]
    });

    expect(TestBed.runInInjectionContext(() => authGuard({} as never, {} as never))).toBe(true);
  });

  it('redirects to login when unauthenticated', () => {
    const tree = {} as UrlTree;
    const router = { parseUrl: vi.fn(() => tree) };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { isLoggedIn: () => false } },
        { provide: Router, useValue: router }
      ]
    });

    expect(TestBed.runInInjectionContext(() => authGuard({} as never, {} as never))).toBe(tree);
    expect(router.parseUrl).toHaveBeenCalledWith('/login');
  });

  it('redirects to login and clears an expired session', () => {
    const tree = {} as UrlTree;
    const router = { parseUrl: vi.fn(() => tree) };
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: jwtWithExp(Math.floor(Date.now() / 1000) - 60),
      tokenType: 'Bearer',
      username: 'developer',
      roles: []
    }));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        AuthService,
        { provide: Router, useValue: router }
      ]
    });

    expect(TestBed.runInInjectionContext(() => authGuard({} as never, {} as never))).toBe(tree);
    expect(router.parseUrl).toHaveBeenCalledWith('/login');
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
  });

  it('allows a valid unexpired session to stay on the protected route', () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: jwtWithExp(Math.floor(Date.now() / 1000) + 3600),
      tokenType: 'Bearer',
      username: 'developer',
      roles: []
    }));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
        AuthService,
        { provide: Router, useValue: { parseUrl: vi.fn() } }
      ]
    });

    expect(TestBed.runInInjectionContext(() => authGuard({} as never, {} as never))).toBe(true);
    expect(sessionStorage.getItem('gsuif.auth')).not.toBeNull();
    sessionStorage.clear();
  });
});

function jwtWithExp(exp: number): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.sig`;
}
