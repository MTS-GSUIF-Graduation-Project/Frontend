import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiException } from '../../../core/models/api-response.model';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingService } from '../../../core/services/loading.service';
import { NotificationService } from '../../../core/services/notification.service';

@Component({
  selector: 'app-login',
  standalone: false,
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly loading = inject(LoadingService);
  private readonly notifications = inject(NotificationService);

  @ViewChild('usernameInput') private readonly usernameInput?: ElementRef<HTMLInputElement>;
  @ViewChild('passwordInput') private readonly passwordInput?: ElementRef<HTMLInputElement>;

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required]
  });

  fieldErrors: Record<string, string> = {};
  get isBusy(): boolean {
    return this.loading.isBusy('login');
  }

  submit(): void {
    this.notifications.clear();
    this.fieldErrors = {};

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }

    this.loading.begin('login');
    this.auth.login(this.form.getRawValue()).pipe(
      finalize(() => this.loading.end('login'))
    ).subscribe({
      error: error => this.handleLoginError(error)
    });
  }

  protected fieldMessage(field: 'username' | 'password'): string {
    const control = this.form.controls[field];

    if (this.fieldErrors[field]) {
      return this.fieldErrors[field];
    }

    if (control.touched && control.hasError('required')) {
      return `${field === 'username' ? 'Username' : 'Password'} is required.`;
    }

    return '';
  }

  private handleLoginError(error: unknown): void {
    const apiError = error instanceof ApiException
      ? error
      : new ApiException(0, 'Unable to reach the server.', null);

    this.fieldErrors = apiError.errors ?? {};
    this.notifications.show(apiError.clientMessage || 'Sign-in failed.');
    this.form.controls.password.reset('');

    if (apiError.statusCode === 400 && Object.keys(this.fieldErrors).length > 0) {
      this.focusFirstInvalid();
    }
  }

  private focusFirstInvalid(): void {
    queueMicrotask(() => {
      if (this.form.controls.username.invalid || this.fieldErrors['username']) {
        this.usernameInput?.nativeElement.focus();
        return;
      }

      if (this.form.controls.password.invalid || this.fieldErrors['password']) {
        this.passwordInput?.nativeElement.focus();
      }
    });
  }
}
