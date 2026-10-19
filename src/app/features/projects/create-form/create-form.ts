import { ChangeDetectorRef, DestroyRef, Directive, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Observable } from 'rxjs';
import { LeaveWarning } from '../../../core/guards/unsaved-changes.guard';
import { ApiException } from '../../../core/models/api-response.model';
import { FormDraftService } from '../../../core/services/form-draft.service';
import { CreateOutcome } from '../services/project-write.service';

/** Every creation form has a `name`; the backend requires it and checks its uniqueness. */
export type CreateFields = Record<string, FormControl<string>> & { name: FormControl<string> };

/** Required after trimming, matching the backend's trim-then-@NotBlank checks. */
export function trimmedRequired(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { required: true };
}

/** Maximum length after trimming, matching the backend's trim-then-@Size checks. */
export function trimmedMaxLength(max: number): ValidatorFn {
  return (control: AbstractControl<string>) =>
    control.value.trim().length > max ? { maxlength: { requiredLength: max } } : null;
}

/**
 * Shared lifecycle for the project and page creation forms: one POST per explicit
 * submit, server field errors, an honest unknown outcome with an explicit check and an
 * explicit resubmit, a per-user draft, and a leave warning. Nothing is retried.
 */
@Directive()
export abstract class CreateForm<T, F extends CreateFields> implements OnInit, LeaveWarning {
  abstract readonly form: FormGroup<F>;
  /** Lower-case name of what is created, for messages. */
  abstract readonly noun: string;

  submitting = false;
  /** The last request may or may not have been processed. */
  uncertain = false;
  checking = false;
  existing: T | null = null;
  checkMessage = '';
  formError = '';
  restoredDraft = false;
  serverErrors: Record<string, string> = {};

  protected readonly drafts = inject(FormDraftService);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly changeDetector = inject(ChangeDetectorRef);
  private done = false;

  protected abstract draftContext(): string;
  protected abstract send(values: Record<keyof F & string, string>): Observable<CreateOutcome<T>>;
  protected abstract findExisting(values: Record<keyof F & string, string>): Observable<T | null>;
  protected abstract created(value: T): void;

  ngOnInit(): void {
    const draft = this.drafts.read(this.draftContext());
    if (draft) {
      const restored: Partial<Record<string, string>> = {};
      for (const name of Object.keys(this.form.controls)) {
        if (typeof draft[name] === 'string') {
          restored[name] = draft[name];
        }
      }
      this.form.patchValue(restored as Parameters<FormGroup<F>['patchValue']>[0]);
      this.restoredDraft = Object.values(restored).some(value => value?.trim());
    }

    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.drafts.write(this.draftContext(), this.form.getRawValue() as Record<string, string>);
    });
    for (const [name, control] of Object.entries(this.form.controls)) {
      control.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
        delete this.serverErrors[name];
      });
    }
  }

  get hasInput(): boolean {
    return Object.values(this.form.getRawValue() as Record<string, string>).some(value => value.trim() !== '');
  }

  fieldMessage(name: keyof F & string): string {
    const control = this.form.controls[name];
    if (this.serverErrors[name]) {
      return this.serverErrors[name];
    }
    if (!control.touched) {
      return '';
    }
    if (control.hasError('required')) {
      return 'This field is required.';
    }
    const max = control.getError('maxlength') as { requiredLength: number } | null;
    return max ? `Use at most ${max.requiredLength} characters.` : '';
  }

  submit(): void {
    if (this.submitting || this.uncertain) {
      return;
    }
    this.formError = '';
    this.serverErrors = {};
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting = true;
    this.send(this.values()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(outcome => {
      this.submitting = false;
      this.handle(outcome);
      this.changeDetector.detectChanges();
    });
  }

  /** Explicit, user-chosen resubmission after an unknown outcome. */
  submitAgain(): void {
    if (!this.uncertain || this.submitting) {
      return;
    }
    this.uncertain = false;
    this.existing = null;
    this.checkMessage = '';
    this.submit();
  }

  /** Read-only check after an unknown outcome; it never creates anything. */
  checkExisting(): void {
    if (!this.uncertain || this.checking) {
      return;
    }
    this.checking = true;
    this.checkMessage = '';
    const name = this.values()['name'];
    this.findExisting(this.values()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: found => {
        this.checking = false;
        this.existing = found;
        this.checkMessage = found
          ? `A ${this.noun} named "${name}" exists. This shows that it exists, not that your request created it.`
          : `No ${this.noun} named "${name}" is among the most recently created ${this.noun}s yet.`;
        this.changeDetector.detectChanges();
      },
      error: error => {
        this.checking = false;
        this.checkMessage = error instanceof ApiException ? error.clientMessage : `Unable to check for the ${this.noun}.`;
        this.changeDetector.detectChanges();
      }
    });
  }

  /** Opens the existing record found by `checkExisting`. */
  openExisting(): void {
    if (this.existing) {
      this.finish(this.existing);
    }
  }

  leaveWarning(): string | null {
    if (this.done) {
      return null;
    }
    if (this.submitting) {
      return `A request to create this ${this.noun} is still waiting for the server. If you leave, you will not see whether it was created.`;
    }
    if (this.uncertain) {
      return `The result of your last request is unknown. Check whether the ${this.noun} was created before leaving.`;
    }
    return this.hasInput ? 'You have unsaved input. It is kept as a draft in this browser tab.' : null;
  }

  private handle(outcome: CreateOutcome<T>): void {
    switch (outcome.kind) {
      case 'created':
        this.finish(outcome.value);
        return;
      case 'invalid': {
        const fields = Object.keys(this.form.controls);
        this.serverErrors = Object.fromEntries(Object.entries(outcome.fieldErrors).filter(([name]) => fields.includes(name)));
        const unmatched = Object.keys(outcome.fieldErrors).some(name => !fields.includes(name));
        this.formError = Object.keys(this.serverErrors).length && !unmatched ? '' : outcome.message;
        return;
      }
      case 'forbidden':
        this.formError = `${outcome.message} Your account is not allowed to create this ${this.noun}.`;
        return;
      case 'not-found':
        this.formError = outcome.message;
        return;
      case 'unauthenticated':
        this.formError = 'Your session ended. Sign in again; your input is kept as a draft.';
        return;
      case 'unknown':
        this.uncertain = true;
        this.formError = outcome.message;
        return;
    }
  }

  private finish(value: T): void {
    this.done = true;
    this.drafts.clear(this.draftContext());
    this.created(value);
  }

  private values(): Record<keyof F & string, string> {
    const raw = this.form.getRawValue() as Record<string, string>;
    return Object.fromEntries(Object.entries(raw).map(([name, value]) => [name, value.trim()])) as Record<keyof F & string, string>;
  }
}
