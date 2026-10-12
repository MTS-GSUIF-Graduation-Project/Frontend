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
    expect(compiled.querySelector('.top-bar__brand')?.textContent).toContain('GSUIF');
  });

  it('does not render account controls when signed out', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.top-bar__user')).toBeNull();
    expect(compiled.querySelector('button.button--logout')).toBeNull();
    expect(compiled.querySelector('app-theme-toggle')).not.toBeNull();
    expect(compiled.querySelector('.top-bar__link')?.textContent).toContain('Sign in');
  });

  it('renders the signed-in user and wires logout through AuthService', () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: jwtWithExp(futureExp()),
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

  it('renders the landing home for a valid unexpired session', async () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: jwtWithExp(futureExp()),
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
    expect(router.url).toBe('/home');
    expect(compiled.querySelector('app-home')).not.toBeNull();
    expect(compiled.querySelector('.hero__welcome')?.textContent).toContain('Welcome, Ada Lovelace.');
    expect(compiled.querySelector('#capabilities-title')?.textContent).toContain('What GSUIF does');
    expect(compiled.querySelector('#workflow-title')?.textContent).toContain('From metadata to editable code');
    expect(compiled.querySelector('#final-cta-title')?.textContent).toContain('Explore your metadata structure.');
  });

  it('redirects /home to login when the session is missing', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/home');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/login');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-home')).toBeNull();
  });

  it('redirects /home to login and clears a malformed session', async () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: 'not-a-jwt',
      tokenType: 'Bearer',
      username: 'Ada Lovelace',
      roles: []
    }));
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/home');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/login');
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-home')).toBeNull();
  });

  it('redirects /home to login and clears an expired session', async () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: jwtWithExp(Math.floor(Date.now() / 1000) - 60),
      tokenType: 'Bearer',
      username: 'Ada Lovelace',
      roles: []
    }));
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/home');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/login');
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-home')).toBeNull();
  });

  it('shows that projects are coming soon', async () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: jwtWithExp(futureExp()),
      tokenType: 'Bearer',
      username: 'Ada Lovelace',
      roles: []
    }));
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/projects');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Coming soon.');
    expect(compiled.textContent).toContain('not available yet');
    expect(compiled.textContent).not.toContain('Recent projects');
  });
});

function futureExp(): number {
  return Math.floor(Date.now() / 1000) + 3600;
}

function jwtWithExp(exp: number): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.sig`;
}
