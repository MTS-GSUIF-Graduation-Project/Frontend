import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProjectsModule } from '../projects.module';
import { MetadataBrowserService } from '../services/metadata-browser.service';
import { ProjectDetailComponent } from './project-detail.component';

describe('ProjectDetailComponent', () => {
  let fixture: ComponentFixture<ProjectDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ projectId: 'project-71' }) } } },
        {
          provide: MetadataBrowserService,
          useValue: {
            getProject: () => of({
              id: 'project-71', name: 'Graduation UI', description: 'Metadata workspace',
              createdAt: '2026-10-01T08:00:00Z', updatedAt: '2026-10-02T09:00:00Z',
              createdBy: 'ada', lastModifiedBy: 'grace'
            }),
            getPages: () => of({
              data: [{
                id: 'page-9', projectId: 'project-71', name: 'Dashboard', route: '/dashboard',
                createdAt: '2026-10-03T08:00:00Z', updatedAt: '2026-10-04T09:00:00Z',
                createdBy: 'linus', lastModifiedBy: 'margaret'
              }],
              totalPages: 1, totalElements: 1, size: 20, number: 0
            })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ProjectDetailComponent);
    fixture.detectChanges();
  });

  it('renders project and page domain fields without response-envelope fields', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    for (const value of ['Graduation UI', 'Metadata workspace', 'project-71', 'ada', 'grace', 'Dashboard', '/dashboard', 'page-9', 'linus', 'margaret']) {
      expect(text).toContain(value);
    }
    expectEnvelopeFieldsToBeAbsent(text);
  });
});

function expectEnvelopeFieldsToBeAbsent(text: string): void {
  for (const field of ['status', 'clientMessage', 'statusCode', 'body', 'errors']) {
    expect(text).not.toContain(field);
  }
}
