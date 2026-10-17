import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiException } from '../../../core/models/api-response.model';
import { Page, Project } from '../models/browser.model';
import { MetadataBrowserService } from '../services/metadata-browser.service';

@Component({
  selector: 'app-project-detail',
  standalone: false,
  templateUrl: './project-detail.component.html',
  styleUrl: '../projects.shared.css'
})
export class ProjectDetailComponent implements OnInit {
  project: Project | null = null;
  pages: Page[] = [];
  totalPages = 0;
  loading = true;
  errorMessage = '';

  readonly projectId = inject(ActivatedRoute).snapshot.paramMap.get('projectId') ?? '';
  private readonly browser = inject(MetadataBrowserService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    forkJoin({
      project: this.browser.getProject(this.projectId),
      pages: this.browser.getPages(this.projectId)
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: result => {
        this.project = result.project;
        this.pages = result.pages.data;
        this.totalPages = result.pages.totalElements;
        this.loading = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        if (error instanceof ApiException) {
          this.errorMessage = error.clientMessage;
          this.loading = false;
          this.changeDetector.detectChanges();
        }
      }
    });
  }
}
