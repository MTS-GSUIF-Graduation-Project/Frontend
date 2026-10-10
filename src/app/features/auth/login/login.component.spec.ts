import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { throwError } from 'rxjs';
import { SharedModule } from '../../../shared/shared.module';
import { ApiException } from '../../../core/models/api-response.model';
import { AuthService } from '../../../core/services/auth.service';
import { LoadingService } from '../../../core/services/loading.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let auth: { login: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = { login: vi.fn() };

    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [ReactiveFormsModule, SharedModule],
      providers: [
        LoadingService,
        { provide: AuthService, useValue: auth }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
  });

  it('shows required validation and does not submit empty fields', () => {
    clickSubmit();
    fixture.detectChanges();

    expect(auth.login).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Username is required.');
    expect(fixture.nativeElement.textContent).toContain('Password is required.');
  });

  it('submits the form values to AuthService', () => {
    auth.login.mockReturnValue({ pipe: () => ({ subscribe: () => undefined }) });
    fixture.componentInstance.form.setValue({ username: 'developer', password: 'secret' });

    clickSubmit();

    expect(auth.login).toHaveBeenCalledWith({ username: 'developer', password: 'secret' });
  });

  it('disables the submit button while loading', () => {
    const loading = TestBed.inject(LoadingService);

    loading.begin('login');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Signing in');

    loading.end('login');
  });

  it('shows the backend login message once through the shared notification service', () => {
    const notifications = TestBed.inject(NotificationService);
    auth.login.mockReturnValue(throwError(() => new ApiException(401, 'Backend credential text', null)));
    fixture.componentInstance.form.setValue({ username: 'developer', password: 'bad' });

    clickSubmit();
    fixture.detectChanges();

    expect(notifications.message()).toBe('Backend credential text');
    expect(fixture.nativeElement.querySelector('.form-error')).toBeNull();
  });

  function clickSubmit(): void {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
  }
});
