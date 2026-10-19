import { ChangeDetectorRef, Component, DestroyRef, Input, OnChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiException } from '../../../core/models/api-response.model';
import { FailureMessage, STATUS_EXPLANATIONS, describeFailure, failureStageLabel } from '../models/failure-explanations';
import { ArtifactText, BackendPackage, FailedRunDetails, RunDetails } from '../models/generation.model';
import { BackendGenerationService, MAX_VIEWABLE_BYTES } from '../services/backend-generation.service';
import { FileSaverService, safeFileName } from '../services/file-saver.service';
import { PACKAGE_DOWNLOAD } from '../services/generation-ports';

const STATUS_LABELS: Record<string, string> = {
  SUCCESS: 'Succeeded',
  FAILED: 'Failed',
  BUILD_FAILED: 'Build failed',
  IN_PROGRESS: 'In progress',
  INTERRUPTED: 'Interrupted'
};

/** Shows one persisted run. Files are offered only for a committed SUCCESS BACKEND package. */
@Component({
  selector: 'app-run-result',
  standalone: false,
  templateUrl: './run-result.component.html',
  styleUrl: '../workspace.shared.css'
})
export class RunResultComponent implements OnChanges {
  @Input({ required: true }) runId = '';

  run: RunDetails | null = null;
  loading = false;
  errorMessage = '';

  /** Stage and code of a FAILED run, read from the server rather than from the original response. */
  failure: FailedRunDetails | null = null;
  failureLoading = false;
  failureError = '';

  selectedPath: string | null = null;
  viewer: ArtifactText | null = null;
  viewerLoading = false;
  viewerError = '';
  downloadError = '';
  zipBusy = false;

  readonly maxViewableKb = MAX_VIEWABLE_BYTES / 1024;
  readonly zip = inject(PACKAGE_DOWNLOAD);
  private readonly generation = inject(BackendGenerationService);
  private readonly saver = inject(FileSaverService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

  get backendPackage(): BackendPackage | null {
    return this.run?.backendPackage ?? null;
  }

  /** Only a committed, integrity-recorded BACKEND package is offered as files. */
  get filesAvailable(): boolean {
    return this.run?.status === 'SUCCESS' && this.backendPackage !== null;
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  statusExplanation(status: string): string | null {
    return STATUS_EXPLANATIONS[status] ?? null;
  }

  stageLabel(stage: string | null): string {
    return failureStageLabel(stage);
  }

  describe(code: string | null): FailureMessage {
    return describeFailure(code);
  }

  ngOnChanges(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';
    this.generation.getRun(this.runId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: run => {
        this.run = run;
        this.loading = false;
        this.changeDetector.detectChanges();
        if (run.status === 'FAILED') {
          this.loadFailure();
        } else {
          this.failure = null;
          this.failureError = '';
        }
      },
      error: error => {
        this.errorMessage = messageOf(error, 'Unable to load the generation run.');
        this.loading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  loadFailure(): void {
    this.failureLoading = true;
    this.failureError = '';
    this.generation.getFailure(this.runId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: failure => {
        this.failure = failure;
        this.failureLoading = false;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.failure = null;
        this.failureError = messageOf(error, 'Unable to load the failure details.');
        this.failureLoading = false;
        this.changeDetector.detectChanges();
      }
    });
  }

  view(path: string): void {
    this.selectedPath = path;
    this.viewer = null;
    this.viewerError = '';
    this.viewerLoading = true;
    this.generation.readArtifactText(this.runId, path).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: text => {
        if (this.selectedPath === path) {
          this.viewer = text;
          this.viewerLoading = false;
          this.changeDetector.detectChanges();
        }
      },
      error: error => {
        if (this.selectedPath === path) {
          this.viewerError = messageOf(error, 'Unable to load the generated file.');
          this.viewerLoading = false;
          this.changeDetector.detectChanges();
        }
      }
    });
  }

  download(path: string): void {
    this.downloadError = '';
    this.generation.downloadArtifact(this.runId, path).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: blob => this.saver.save(blob, safeFileName(path)),
      error: error => {
        this.downloadError = messageOf(error, 'The file could not be downloaded.');
        this.changeDetector.detectChanges();
      }
    });
  }

  downloadZip(): void {
    if (!this.zip.available || this.zipBusy || !this.filesAvailable) {
      return;
    }
    this.zipBusy = true;
    this.downloadError = '';
    this.zip.downloadZip(this.runId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: file => {
        this.zipBusy = false;
        this.saver.save(file.blob, file.fileName);
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.zipBusy = false;
        this.downloadError = messageOf(error, 'The ZIP could not be downloaded.');
        this.changeDetector.detectChanges();
      }
    });
  }
}

function messageOf(error: unknown, fallback: string): string {
  return error instanceof ApiException ? error.clientMessage : fallback;
}
