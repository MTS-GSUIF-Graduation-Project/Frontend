import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { PagedBody, Project } from '../models/browser.model';
import { ProjectsModule } from '../projects.module';
import { MetadataBrowserService } from '../services/metadata-browser.service';
import { ProjectListComponent } from './project-list.component';

describe('ProjectListComponent', () => {
  let fixture: ComponentFixture<ProjectListComponent>;
  let getProjects: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getProjects = vi.fn().mockReturnValue(of(projectPage()));

    await TestBed.configureTestingModule({
      imports: [ProjectsModule],
      providers: [
        provideRouter([]),
        {
          provide: MetadataBrowserService,
          useValue: {
            getProjects
          }
        }
      ]
    }).compileComponents();

  });

  it('renders project domain fields without response-envelope fields', () => {
    render();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Graduation UI');
    expect(text).toContain('Metadata workspace');
    expect(text).toContain('project-71');
    expect(text).toContain('ada');
    expect(text).toContain('grace');
    expectEnvelopeFieldsToBeAbsent(text);
  });

  it('shows the empty state and leaves loading after an empty page completes', () => {
    const response = new Subject<PagedBody<Project>>();
    getProjects.mockReturnValue(response);

    render();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading projects.');

    response.next({ data: [], totalPages: 0, totalElements: 0, size: 20, number: 0 });
    response.complete();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No projects yet. Create a project');
    expect(text).not.toContain('Loading projects.');
  });

  it('offers project creation whether or not projects exist', () => {
    render();

    const link = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('a'))
      .find(item => item.textContent?.trim() === 'Create project');
    expect(link?.getAttribute('href')).toBe('/projects/new');
  });

  function render(): void {
    fixture = TestBed.createComponent(ProjectListComponent);
    fixture.detectChanges();
  }
});

function projectPage(): object {
  return {
    data: [{
      id: 'project-71', name: 'Graduation UI', description: 'Metadata workspace',
      createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-02T09:00:00Z',
      createdBy: 'ada', lastModifiedBy: 'grace'
    }],
    totalPages: 1, totalElements: 1, size: 20, number: 0
  };
}

function expectEnvelopeFieldsToBeAbsent(text: string): void {
  for (const field of ['status', 'clientMessage', 'statusCode', 'body', 'errors']) {
    expect(text).not.toContain(field);
  }
}
