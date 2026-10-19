import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ApiException } from '../../../core/models/api-response.model';
import { AuthService } from '../../../core/services/auth.service';
import { Page, Project } from '../models/browser.model';
import { ProjectsModule } from '../projects.module';
import { MetadataBrowserService } from '../services/metadata-browser.service';
import { CreateOutcome, ProjectWriteService } from '../services/project-write.service';
import { PageCreateComponent } from './page-create.component';

describe('PageCreateComponent (mocked services)', () => {
  let fixture: ComponentFixture<PageCreateComponent>;
  let responses: Subject<CreateOutcome<Page>>[];
  let writer: { createPage: ReturnType<typeof vi.fn>; findRecentPage: ReturnType<typeof vi.fn> };
  let getProject: () => Observable<Project>;
  let navigate: ReturnType<typeof vi.fn>;

  async function render(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [ProjectsModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ projectId: 'project-1' }) } } },
        { provide: MetadataBrowserService, useValue: { getProject: () => getProject() } },
        { provide: ProjectWriteService, useValue: writer },
        { provide: AuthService, useValue: { getUsername: () => 'ada', isLoggedIn: () => true } }
      ]
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true) as unknown as ReturnType<typeof vi.fn>;
    fixture = TestBed.createComponent(PageCreateComponent);
    fixture.detectChanges();
  }

  beforeEach(() => {
    sessionStorage.clear();
    responses = [];
    getProject = () => of(project());
    writer = {
      createPage: vi.fn(() => {
        const response = new Subject<CreateOutcome<Page>>();
        responses.push(response);
        return response;
      }),
      findRecentPage: vi.fn()
    };
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement | undefined {
    return Array.from(host().querySelectorAll('button')).find(item => item.textContent?.trim() === label);
  }

  function type(selector: string, value: string): void {
    const field = host().querySelector(selector) as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function resolve(outcome: CreateOutcome<Page>): void {
    const response = responses[responses.length - 1];
    response.next(outcome);
    response.complete();
    fixture.detectChanges();
  }

  it('names the project it adds the page to', async () => {
    await render();

    expect(host().textContent).toContain('Add a page to Orders.');
  });

  it('sends the trimmed page with no route when the route is blank', async () => {
    await render();
    type('#page-name', ' Order list ');
    type('#page-route', '   ');

    button('Create page')?.click();

    expect(writer.createPage).toHaveBeenCalledOnce();
    expect(writer.createPage).toHaveBeenCalledWith('project-1', { name: 'Order list', route: null });
  });

  it('continues to the new page workspace to start its first metadata version', async () => {
    await render();
    type('#page-name', 'Order list');
    type('#page-route', '/orders');

    button('Create page')?.click();
    resolve({ kind: 'created', value: page() });

    expect(writer.createPage).toHaveBeenCalledWith('project-1', { name: 'Order list', route: '/orders' });
    expect(navigate).toHaveBeenCalledWith(['/projects', 'project-1', 'pages', 'page-1', 'workspace']);
    expect(sessionStorage.getItem('gsuif.form-draft.ada.page-create:project-1')).toBeNull();
  });

  it('shows a duplicate route on the route field', async () => {
    await render();
    type('#page-name', 'Order list');
    type('#page-route', '/orders');

    button('Create page')?.click();
    resolve({
      kind: 'invalid',
      message: "RouteUniquenessRule: Page with route '/orders' already exists in project 'project-1'",
      fieldErrors: { route: "RouteUniquenessRule: Page with route '/orders' already exists in project 'project-1'" }
    });

    expect(host().querySelector('#page-route-error')?.textContent).toContain("route '/orders' already exists");
    expect(host().querySelector('#page-name-error')).toBeNull();
    expect((host().querySelector('#page-route') as HTMLInputElement).value).toBe('/orders');
  });

  it('keeps drafts separate per project', async () => {
    sessionStorage.setItem('gsuif.form-draft.ada.page-create:project-2', JSON.stringify({ name: 'Elsewhere', route: '' }));
    await render();

    expect((host().querySelector('#page-name') as HTMLInputElement).value).toBe('');
  });

  it('does not resubmit after an unknown outcome and checks with a read-only lookup', async () => {
    writer.findRecentPage.mockReturnValue(of(null));
    await render();
    type('#page-name', 'Order list');
    button('Create page')?.click();
    resolve({ kind: 'unknown', message: 'Unknown.' });

    button('Check whether it was created')?.click();
    fixture.detectChanges();

    expect(writer.findRecentPage).toHaveBeenCalledWith('project-1', 'Order list');
    expect(host().textContent).toContain('No page named "Order list" is among the most recently created pages yet.');
    expect(writer.createPage).toHaveBeenCalledOnce();
  });

  it('shows the error when the project cannot be loaded, without a form', async () => {
    getProject = () => throwError(() => new ApiException(404, 'Project not found with id: project-1', null));
    await render();

    expect(host().textContent).toContain('Project not found with id: project-1');
    expect(host().querySelector('form')).toBeNull();
  });
});

function project(): Project {
  return {
    id: 'project-1', name: 'Orders', description: null, createdAt: '2026-10-19T09:00:00Z',
    updatedAt: '2026-10-19T09:00:00Z', createdBy: 'ada', lastModifiedBy: 'ada'
  };
}

function page(): Page {
  return {
    id: 'page-1', projectId: 'project-1', name: 'Order list', route: '/orders', createdAt: '2026-10-19T09:00:00Z',
    updatedAt: '2026-10-19T09:00:00Z', createdBy: 'ada', lastModifiedBy: 'ada'
  };
}
