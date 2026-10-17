import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: { getToken: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auth = { getToken: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth }
      ]
    });

    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('adds Authorization to protected GSUIF API requests', () => {
    auth.getToken.mockReturnValue('jwt-value');
    const absoluteUrl = `${new URL(document.baseURI).origin}/api/v1/projects/7`;

    expect(authorizationFor('/api/v1/projects')).toBe('Bearer jwt-value');
    expect(authorizationFor(absoluteUrl)).toBe('Bearer jwt-value');
  });

  it('does not add Authorization without a token', () => {
    auth.getToken.mockReturnValue(null);

    expect(authorizationFor('/api/v1/projects')).toBeNull();
  });

  it('never sends the GSUIF token to external or non-API URLs', () => {
    auth.getToken.mockReturnValue('jwt-value');

    expect(authorizationFor('https://maps.example.com/api/v1/tiles')).toBeNull();
    expect(authorizationFor('//cdn.example.com/api/v1/config')).toBeNull();
    expect(authorizationFor('/assets/config.json')).toBeNull();
    expect(auth.getToken).not.toHaveBeenCalled();
  });

  it('does not add Authorization to the public login endpoint', () => {
    auth.getToken.mockReturnValue('jwt-value');

    expect(authorizationFor('/api/auth/login')).toBeNull();
  });

  function authorizationFor(url: string): string | null {
    http.get(url).subscribe();
    const request = controller.expectOne(url);
    const header = request.request.headers.get('Authorization');
    request.flush({});
    return header;
  }
});
