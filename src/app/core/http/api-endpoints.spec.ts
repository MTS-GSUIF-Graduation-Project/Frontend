import { TestBed } from '@angular/core/testing';
import { API_CONFIG, ApiEndpoints } from './api-endpoints';

describe('ApiEndpoints', () => {
  const appOrigin = new URL(document.baseURI).origin;

  function create(baseUrl?: string): ApiEndpoints {
    TestBed.configureTestingModule({
      providers: baseUrl === undefined ? [] : [{ provide: API_CONFIG, useValue: { baseUrl } }]
    });

    return TestBed.inject(ApiEndpoints);
  }

  it('treats same-origin /api requests as protected by default', () => {
    const endpoints = create();

    expect(endpoints.url('/api/v1/projects')).toBe('/api/v1/projects');
    expect(endpoints.isProtected('/api/v1/projects')).toBe(true);
    expect(endpoints.isProtected(`${appOrigin}/api/v1/projects`)).toBe(true);
  });

  it('does not treat the public login endpoint as protected', () => {
    const endpoints = create();

    expect(endpoints.isProtected('/api/auth/login')).toBe(false);
    expect(endpoints.isProtected(`${appOrigin}/api/auth/login`)).toBe(false);
  });

  it('rejects external, look-alike, and non-API URLs', () => {
    const endpoints = create();

    expect(endpoints.isProtected('https://evil.test/api/v1/projects')).toBe(false);
    expect(endpoints.isProtected('//evil.test/api/v1/projects')).toBe(false);
    expect(endpoints.isProtected(`https://evil.test/?next=${appOrigin}/api/`)).toBe(false);
    expect(endpoints.isProtected(`https://evil.test/${appOrigin}/api/v1/projects`)).toBe(false);
    expect(endpoints.isProtected('/apiary')).toBe(false);
    expect(endpoints.isProtected('/api/../assets/logo.png')).toBe(false);
    expect(endpoints.isProtected('/api/%2e%2e/assets/logo.png')).toBe(false);
    expect(endpoints.isProtected('/assets/i18n/en.json')).toBe(false);
    expect(endpoints.isProtected('/API/v1/projects')).toBe(false);
  });

  it('rejects backslash and userinfo tricks that point at another host', () => {
    const endpoints = create();
    const host = new URL(document.baseURI).host;

    expect(endpoints.isProtected('/\\evil.test/api/v1/projects')).toBe(false);
    expect(endpoints.isProtected('\\\\evil.test/api/v1/projects')).toBe(false);
    expect(endpoints.isProtected(`https://${host}@evil.test/api/v1/projects`)).toBe(false);
  });

  it('does not exempt look-alikes of the public login path', () => {
    const endpoints = create();

    expect(endpoints.isProtected('/api/auth/login/extra')).toBe(true);
    expect(endpoints.isProtected('/api/auth/login?next=/home')).toBe(false);
  });

  it('uses a configured API origin for both URL building and trust decisions', () => {
    const endpoints = create('https://api.gsuif.test/');

    expect(endpoints.url('/api/v1/projects')).toBe('https://api.gsuif.test/api/v1/projects');
    expect(endpoints.isProtected('https://api.gsuif.test/api/v1/projects')).toBe(true);
    expect(endpoints.isProtected('https://api.gsuif.test/api/auth/login')).toBe(false);
    expect(endpoints.isProtected('http://api.gsuif.test/api/v1/projects')).toBe(false);
    expect(endpoints.isProtected('https://api.gsuif.test.evil.test/api/v1/projects')).toBe(false);
    expect(endpoints.isProtected('/api/v1/projects')).toBe(false);
  });
});
