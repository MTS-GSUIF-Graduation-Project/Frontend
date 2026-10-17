import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ProjectsModule } from '../projects.module';
import { MetadataBrowserService } from '../services/metadata-browser.service';
import { PageDetailComponent } from './page-detail.component';

describe('PageDetailComponent', () => {
  let fixture: ComponentFixture<PageDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectsModule],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ projectId: 'project-71', pageId: 'page-9' }) } } },
        {
          provide: MetadataBrowserService,
          useValue: {
            getPage: () => of({
              id: 'page-9', projectId: 'project-71', name: 'Dashboard', route: '/dashboard',
              createdAt: '2026-10-03T08:00:00Z', updatedAt: '2026-10-04T09:00:00Z',
              createdBy: 'linus', lastModifiedBy: 'margaret'
            }),
            getVersions: () => of({
              data: [{
                id: 'version-3', pageId: 'page-9', projectId: 'project-71', version: 3,
                schemaVersion: '1.2.0', isCurrent: true, snapshot: { title: 'Overview', widgets: 4 },
                createdAt: '2026-10-05T08:00:00Z', updatedAt: '2026-10-06T09:00:00Z',
                createdBy: 'barbara', lastModifiedBy: 'donald'
              }],
              totalPages: 1, totalElements: 1, size: 20, number: 0
            })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(PageDetailComponent);
    fixture.detectChanges();
  });

  it('renders page and version domain fields plus read-only snapshot JSON without envelope fields', () => {
    const host = fixture.nativeElement as HTMLElement;
    const text = host.textContent ?? '';
    for (const value of ['Dashboard', '/dashboard', 'page-9', 'project-71', 'linus', 'margaret', 'Version 3', 'version-3', '1.2.0', 'barbara', 'donald', 'Overview', 'widgets']) {
      expect(text).toContain(value);
    }
    expect(host.querySelector('pre.snapshot')?.textContent).toContain('"title": "Overview"');
    expectEnvelopeFieldsToBeAbsent(text);
  });
});

function expectEnvelopeFieldsToBeAbsent(text: string): void {
  for (const field of ['status', 'clientMessage', 'statusCode', 'body', 'errors']) {
    expect(text).not.toContain(field);
  }
}
