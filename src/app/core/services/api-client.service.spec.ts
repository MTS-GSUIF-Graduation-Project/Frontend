import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiClientService } from './api-client.service';

describe('ApiClientService', () => {
  let service: ApiClientService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(ApiClientService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('returns the GET ApiResponse envelope without unwrapping it', () => {
    service.get<{ name: string }>('/api/v1/projects/1').subscribe(response => {
      expect(response.status).toBe('OK');
      expect(response.body).toEqual({ name: 'Metadata browser' });
    });

    http.expectOne('/api/v1/projects/1').flush({
      status: 'OK',
      clientMessage: 'Project retrieved',
      statusCode: 200,
      body: { name: 'Metadata browser' },
      errors: null
    });
  });

  it('returns the ApiResponse envelope without unwrapping it', () => {
    service.post<{ token: string }>('/api/auth/login', { username: 'developer', password: 'secret' }).subscribe(response => {
      expect(response.body).toEqual({ token: 'stored-token' });
      expect(response.clientMessage).toBe('Authentication successful');
    });

    http.expectOne('/api/auth/login').flush({
      status: 'OK',
      clientMessage: 'Authentication successful',
      statusCode: 200,
      body: { token: 'stored-token' },
      errors: null
    });
  });
});
