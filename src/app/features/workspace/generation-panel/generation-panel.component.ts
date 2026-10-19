import {
  ChangeDetectorRef, Component, DestroyRef, EventEmitter, Input, OnInit, Output, inject
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiException } from '../../../core/models/api-response.model';
import { MetadataVersion } from '../../projects/models/browser.model';
import { newAttemptId } from '../models/attempt-id';
import { BackendGenerationRequest, GenerationOutcome, GenerationSpecification } from '../models/generation.model';
import { BackendGenerationService } from '../services/backend-generation.service';
import { ATTEMPT_RECOVERY } from '../services/generation-ports';
import { PendingAttempt, WorkspaceStorageService } from '../services/workspace-storage.service';

export const RESTORED_ATTEMPT_MESSAGE =
  'A generation request from this browser tab has no confirmed result. It may still be running or may have finished.';

type PanelState =
  | { phase: 'idle' }
  | { phase: 'submitting'; attempt: PendingAttempt }
  | { phase: 'done'; attempt: PendingAttempt; outcome: GenerationOutcome };

/** Outcomes after which the attempt ID can no longer be resolved by resending it. */
const SETTLED: ReadonlySet<GenerationOutcome['kind']> = new Set(['success', 'rejected', 'failed', 'forbidden', 'not-found']);
/** Outcomes where resending the exact original request is meaningful. */
const RETRYABLE: ReadonlySet<GenerationOutcome['kind']> = new Set(['unknown', 'unauthenticated']);

/**
 * Submits BACKEND generation exactly once per user action. It never retries on its own and
 * never replaces an attempt ID without an explicit "Start a new attempt" click.
 */
@Component({
  selector: 'app-generation-panel',
  standalone: false,
  templateUrl: './generation-panel.component.html',
  styleUrl: '../workspace.shared.css'
})
export class GenerationPanelComponent implements OnInit {
  @Input({ required: true }) pageId = '';
  @Input() specification: GenerationSpecification | null = null;
  @Input() blockedReason: string | null = null;
  @Input() currentVersion: MetadataVersion | null = null;
  /** True while a request is waiting for the server. */
  @Output() activeChange = new EventEmitter<boolean>();

  state: PanelState = { phase: 'idle' };
  recoveryMessage = '';
  recoveredRunId: string | null = null;
  checking = false;

  readonly recovery = inject(ATTEMPT_RECOVERY);
  private readonly generation = inject(BackendGenerationService);
  private readonly storage = inject(WorkspaceStorageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

  ngOnInit(): void {
    const pending = this.storage.readAttempt(this.pageId);
    if (pending) {
      this.state = { phase: 'done', attempt: pending, outcome: { kind: 'unknown', message: RESTORED_ATTEMPT_MESSAGE } };
    }
  }

  get submitting(): boolean {
    return this.state.phase === 'submitting';
  }

  get outcome(): GenerationOutcome | null {
    return this.state.phase === 'done' ? this.state.outcome : null;
  }

  get attempt(): PendingAttempt | null {
    return this.state.phase === 'idle' ? null : this.state.attempt;
  }

  /** An unresolved attempt blocks plain "Generate" so it cannot be replaced by accident. */
  get unresolved(): boolean {
    const outcome = this.outcome;
    return outcome !== null && !SETTLED.has(outcome.kind);
  }

  get canRetrySameAttempt(): boolean {
    const outcome = this.outcome;
    return outcome !== null && RETRYABLE.has(outcome.kind);
  }

  get canGenerate(): boolean {
    return !this.submitting && !this.unresolved && !this.blockedReason && this.specification !== null;
  }

  /** True when the retry would send something other than what the editors now hold. */
  get retryDiffersFromEditors(): boolean {
    const attempt = this.attempt;
    if (!attempt || !this.specification) {
      return false;
    }
    const sent = JSON.parse(attempt.requestJson) as BackendGenerationRequest;
    return JSON.stringify(sent.specification) !== JSON.stringify(this.specification);
  }

  generate(): void {
    if (!this.canGenerate || !this.specification) {
      return;
    }
    const request: BackendGenerationRequest = {
      pageId: this.pageId,
      specification: this.specification,
      attemptId: newAttemptId()
    };
    const attempt: PendingAttempt = {
      attemptId: request.attemptId,
      pageId: this.pageId,
      requestJson: JSON.stringify(request),
      submittedAt: new Date().toISOString()
    };
    this.storage.writeAttempt(attempt);
    this.send(attempt);
  }

  /** Re-sends the stored request byte for byte, with the same attempt ID. */
  retrySameAttempt(): void {
    const attempt = this.attempt;
    if (this.submitting || !attempt || !this.canRetrySameAttempt) {
      return;
    }
    this.send(attempt);
  }

  /** Explicitly abandons the unresolved attempt ID and starts over with a new one. */
  startNewAttempt(): void {
    if (this.submitting) {
      return;
    }
    this.storage.clearAttempt(this.pageId);
    this.state = { phase: 'idle' };
    this.recoveryMessage = '';
    this.recoveredRunId = null;
    this.generate();
  }

  checkAttempt(): void {
    const attempt = this.attempt;
    if (!this.recovery.available || !attempt || this.checking) {
      return;
    }
    this.checking = true;
    this.recoveryMessage = '';
    this.recovery.findRun(attempt.attemptId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: lookup => {
        this.checking = false;
        if (lookup.kind === 'found') {
          this.recoveredRunId = lookup.runId;
        } else {
          this.recoveryMessage = 'The server has no record of this attempt, so the original request never started.';
        }
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.checking = false;
        this.recoveryMessage = error instanceof ApiException ? error.clientMessage : 'The attempt could not be checked.';
        this.changeDetector.detectChanges();
      }
    });
  }

  private send(attempt: PendingAttempt): void {
    this.state = { phase: 'submitting', attempt };
    this.recoveryMessage = '';
    this.recoveredRunId = null;
    this.activeChange.emit(true);

    const request = JSON.parse(attempt.requestJson) as BackendGenerationRequest;
    this.generation.generate(request).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(outcome => {
      if (SETTLED.has(outcome.kind)) {
        this.storage.clearAttempt(this.pageId);
      }
      this.state = { phase: 'done', attempt, outcome };
      this.activeChange.emit(false);
      this.changeDetector.detectChanges();
    });
  }
}
