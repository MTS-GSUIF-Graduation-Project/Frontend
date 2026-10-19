import { Component, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { ApiException } from '../../../core/models/api-response.model';
import { NotificationService } from '../../../core/services/notification.service';
import { CreateForm, trimmedMaxLength, trimmedRequired } from '../create-form/create-form';
import { Page, Project } from '../models/browser.model';
import { MetadataBrowserService } from '../services/metadata-browser.service';
import { CreateOutcome, ProjectWriteService } from '../services/project-write.service';

type PageFields = { name: FormControl<string>; route: FormControl<string> };

@Component({
  selector: 'app-page-create',
  standalone: false,
  templateUrl: './page-create.component.html',
  styleUrls: ['../projects.shared.css', '../create-form/create-form.css']
})
export class PageCreateComponent extends CreateForm<Page, PageFields> implements OnInit {
  readonly noun = 'page';
  readonly form = new FormGroup<PageFields>({
    name: new FormControl('', { nonNullable: true, validators: [trimmedRequired, trimmedMaxLength(200)] }),
    route: new FormControl('', { nonNullable: true, validators: [trimmedMaxLength(255)] })
  });

  readonly projectId = inject(ActivatedRoute).snapshot.paramMap.get('projectId') ?? '';
  project: Project | null = null;
  loading = true;
  loadError = '';

  private readonly browser = inject(MetadataBrowserService);
  private readonly writer = inject(ProjectWriteService);
  private readonly router = inject(Router);
  private readonly notifications = inject(NotificationService);

  override ngOnInit(): void {
    super.ngOnInit();
    this.loadProject();
  }

  loadProject(): void {
    this.loading = true;
    this.loadError = '';
    this.browser.getProject(this.projectId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: project => {
        this.project = project;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.loadError = error instanceof ApiException ? error.clientMessage : 'Unable to load the project.';
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  protected draftContext(): string {
    return `page-create:${this.projectId}`;
  }

  protected send(values: Record<keyof PageFields, string>): Observable<CreateOutcome<Page>> {
    return this.writer.createPage(this.projectId, { name: values.name, route: values.route || null });
  }

  protected findExisting(values: Record<keyof PageFields, string>): Observable<Page | null> {
    return this.writer.findRecentPage(this.projectId, values.name);
  }

  /** A new page has no metadata yet, so continue in its workspace to start version 1. */
  protected created(page: Page): void {
    this.notifications.show(`Page "${page.name}" created. Start its first metadata version.`);
    void this.router.navigate(page.id
      ? ['/projects', this.projectId, 'pages', page.id, 'workspace']
      : ['/projects', this.projectId]);
  }
}
