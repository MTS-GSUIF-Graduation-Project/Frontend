import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ApiException, ApiResponse } from '../../../core/models/api-response.model';
import { ApiClientService } from '../../../core/services/api-client.service';
import { PagedBody, Project } from '../models/browser.model';
import { MetadataBrowserService } from './metadata-browser.service';

describe('MetadataBrowserService', () => {
  let service: MetadataBrowserService;
  let api: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { get: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        MetadataBrowserService,
        { provide: ApiClientService, useValue: api }
      ]
    });
    service = TestBed.inject(MetadataBrowserService);
  });

  it('unwraps page data from a successful envelope', async () => {
    const page: PagedBody<Project> = {
      data: [project()], totalPages: 1, totalElements: 1, size: 20, number: 0
    };
    api.get.mockReturnValue(of(envelope(page)));

    await expect(firstValueFrom(service.getProjects())).resolves.toEqual(page);
    expect(api.get).toHaveBeenCalledWith('/api/v1/projects');
  });

  it('throws an ApiException for a non-OK envelope', async () => {
    api.get.mockReturnValue(of({
      status: 'FORBIDDEN',
      clientMessage: 'Projects are not available to this account.',
      statusCode: 403,
      body: null,
      errors: { role: 'Insufficient access' }
    }));

    await expect(firstValueFrom(service.getProjects())).rejects.toMatchObject({
      constructor: ApiException,
      statusCode: 403,
      clientMessage: 'Projects are not available to this account.',
      errors: { role: 'Insufficient access' }
    });
  });

  it('throws an ApiException when an OK envelope has a null body', async () => {
    api.get.mockReturnValue(of(envelope<PagedBody<Project>>(null)));

    await expect(firstValueFrom(service.getProjects())).rejects.toMatchObject({
      constructor: ApiException,
      statusCode: 200,
      clientMessage: 'Request completed without data.'
    });
  });

  it('converts an HTTP error with the existing API exception helper', async () => {
    api.get.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 503,
      error: { clientMessage: 'Metadata service is restarting.', errors: null }
    })));

    await expect(firstValueFrom(service.getProjects())).rejects.toMatchObject({
      constructor: ApiException,
      statusCode: 503,
      clientMessage: 'Metadata service is restarting.'
    });
  });
});

function envelope<T>(body: T | null): ApiResponse<T> {
  return {
    status: 'OK',
    clientMessage: body === null ? 'Request completed without data.' : 'Projects retrieved',
    statusCode: 200,
    body,
    errors: null
  };
}

function project(): Project {
  return {
    id: 'project-1',
    name: 'Metadata browser',
    description: 'Read-only project',
    createdAt: '2026-10-01T08:00:00Z',
    updatedAt: '2026-10-02T09:00:00Z',
    createdBy: 'ada',
    lastModifiedBy: 'grace'
  };
}
