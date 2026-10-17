import { Component, DestroyRef, ElementRef, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { toApiException } from '../../../core/http/api-error';
import { AuthService, LOGIN_FAILED_MESSAGE } from '../../../core/services/auth.service';
import { LoadingService } from '../../../core/services/loading.service';
import { NotificationService } from '../../../core/services/notification.service';

type LoginField = 'username' | 'password';

const LOGIN_FIELDS: readonly LoginField[] = ['username', 'password'];

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly loading = inject(LoadingService);
  private readonly notifications = inject(NotificationService);

  @ViewChild('usernameInput') private readonly usernameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') private readonly passwordInput?: ElementRef<HTMLInputElement>;

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  fieldErrors: Partial<Record<LoginField, string>> = {};
  private errorToastId: number | null = null;
  private pendingLogin?: Subscription;

  constructor() {
    for (const field of LOGIN_FIELDS) {
      this.form.controls[field].valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.onFieldEdited(field));
    }

    inject(DestroyRef).onDestroy(() => this.pendingLogin?.unsubscribe());
  }

  get isBusy(): boolean {
    return this.loading.isBusy('login');
  }

  submit(): void {
    this.pendingLogin?.unsubscribe();
    this.notifications.clear();
    this.errorToastId = null;
    this.fieldErrors = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    this.loading.begin('login');
    this.pendingLogin = this.auth.login(this.form.getRawValue(), this.route.snapshot.queryParamMap.get('returnUrl')).pipe(
      finalize(() => this.loading.end('login'))
    ).subscribe({
      error: error => this.handleLoginError(error)
    });
  }

  protected fieldMessage(field: LoginField): string {
    const control = this.form.controls[field];
    const serverError = this.fieldErrors[field];

    if (serverError) {
      return serverError;
    }

    if (control.touched && control.hasError('required')) {
      return `${field === 'username' ? 'Username' : 'Password'} is required.`;
    }

    return '';
  }

  private onFieldEdited(field: LoginField): void {
    this.notifications.dismiss(this.errorToastId);
    this.errorToastId = null;

    if (this.fieldErrors[field]) {
      const remaining = { ...this.fieldErrors };
      delete remaining[field];
      this.fieldErrors = remaining;
    }
  }

  private handleLoginError(error: unknown): void {
    const apiError = toApiException(error, LOGIN_FAILED_MESSAGE);
    const errors = apiError.errors ?? {};

    this.fieldErrors = Object.fromEntries(LOGIN_FIELDS.filter(field => errors[field]).map(field => [field, errors[field]]));
    this.form.controls.password.reset('', { emitEvent: false });

    if (Object.keys(this.fieldErrors).length > 0) {
      this.focusFirstInvalid();
    } else {
      this.errorToastId = this.notifications.show(apiError.clientMessage);
    }
  }

  private focusFirstInvalid(): void {
    queueMicrotask(() => {
      if (this.form.controls.username.invalid || this.fieldErrors.username) {
        this.usernameInput?.nativeElement.focus();
        return;
      }

      if (this.form.controls.password.invalid || this.fieldErrors.password) {
        this.passwordInput?.nativeElement.focus();
      }
    });
  }
}
