import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiException } from '../../../core/models/api-response.model';
import { MetadataVersion, Page } from '../models/browser.model';
import { MetadataBrowserService } from '../services/metadata-browser.service';

@Component({
  selector: 'app-page-detail',
  standalone: false,
  templateUrl: './page-detail.component.html',
  styleUrl: '../projects.shared.css'
})
export class PageDetailComponent implements OnInit {
  page: Page | null = null;
  versions: MetadataVersion[] = [];
  totalVersions = 0;
  loading = true;
  errorMessage = '';

  private readonly route = inject(ActivatedRoute);
  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly pageId = this.route.snapshot.paramMap.get('pageId') ?? '';
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
      page: this.browser.getPage(this.projectId, this.pageId),
      versions: this.browser.getVersions(this.pageId)
    }).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: result => {
        this.page = result.page;
        this.versions = result.versions.data;
        this.totalVersions = result.versions.totalElements;
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
