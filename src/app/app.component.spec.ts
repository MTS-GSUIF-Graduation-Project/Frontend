import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AppComponent } from './app.component';
import { AppModule } from './app.module';
import { AuthService } from './core/services/auth.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [
        AppModule
      ]
    }).compileComponents();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('creates the shell', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the product name and skip link', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.skip-link')?.textContent).toContain('Skip to content');
    expect(compiled.querySelector('.top-bar__brand')?.textContent).toContain('MetaFrame');
  });

  it('does not render account controls when signed out', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.top-bar__user')).toBeNull();
    expect(compiled.querySelector('button.button--logout')).toBeNull();
    expect(compiled.querySelector('app-theme-toggle')).toBeNull();
    expect(compiled.querySelector('.top-bar__link')?.textContent).toContain('Sign in');
  });

  it('renders the signed-in user and wires logout through AuthService', () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: 'token-123',
      tokenType: 'Bearer',
      username: 'Ada Lovelace',
      roles: ['USER']
    }));
    const auth = TestBed.inject(AuthService);
    const logout = vi.spyOn(auth, 'logout');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const logoutButton = compiled.querySelector<HTMLButtonElement>('button.button--logout');

    expect(compiled.querySelector('.top-bar__user')?.textContent).toContain('Ada Lovelace');
    expect(logoutButton?.textContent).toContain('Logout');
    expect(Array.from(compiled.querySelectorAll('.top-bar__link')).map(link => link.textContent?.trim())).toEqual(['Home', 'Projects']);

    logoutButton?.click();

    expect(logout).toHaveBeenCalledOnce();
    expect(logout).toHaveBeenCalledWith();
  });

  it('renders the SCRUM-70 home route for an authenticated session', async () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: 'token-123',
      tokenType: 'Bearer',
      username: 'Ada Lovelace',
      roles: ['USER']
    }));
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/home');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-home')).not.toBeNull();
    expect(compiled.querySelector('.hero__welcome')?.textContent).toContain('Welcome, Ada Lovelace.');
    expect(compiled.querySelector<HTMLAnchorElement>('.hero__action--primary')?.getAttribute('href')).toBe('/projects');
    expect(compiled.querySelector<HTMLAnchorElement>('.hero__action--secondary')?.getAttribute('href')).toBe('/home#platform-workflow');
    expect(compiled.querySelector('#workflow-title')?.textContent).toContain('From metadata to editable code');
  });
});
