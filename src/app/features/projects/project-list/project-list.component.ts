import { ChangeDetectorRef, Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiException } from '../../../core/models/api-response.model';
import { Project } from '../models/browser.model';
import { MetadataBrowserService } from '../services/metadata-browser.service';

@Component({
  selector: 'app-project-list',
  standalone: false,
  templateUrl: './project-list.component.html',
  styleUrl: '../projects.shared.css'
})
export class ProjectListComponent implements OnInit {
  projects: Project[] = [];
  totalElements = 0;
  loading = true;
  errorMessage = '';

  private readonly browser = inject(MetadataBrowserService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.browser.getProjects().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: page => {
        this.projects = page.data;
        this.totalElements = page.totalElements;
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
