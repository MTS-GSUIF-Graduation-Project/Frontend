import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AppComponent } from './app.component';
import { AppModule } from './app.module';
import { AuthService } from './core/services/auth.service';
import { NotificationService } from './core/services/notification.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [
        AppModule
      ],
      providers: [provideHttpClientTesting()]
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(NotificationService).clear();
    sessionStorage.clear();
    document.documentElement.setAttribute('data-theme', 'light');
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
    expect(compiled.querySelector('.top-bar__avatar')).toBeNull();
    expect(compiled.querySelector('.site-footer')?.textContent).toContain('Metadata-driven UI framework');
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
    expect(logoutButton?.textContent).toContain('Sign out');
    expect(compiled.querySelector('.top-bar__avatar')?.textContent).toContain('AD');
    expect(Array.from(compiled.querySelectorAll('.top-bar__link')).map(link => link.textContent?.trim())).toEqual(['Home', 'Projects']);

    logoutButton?.click();

    expect(logout).toHaveBeenCalledOnce();
    expect(logout).toHaveBeenCalledWith();
  });

  it('renders the public landing page at the root without a session', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(router.url).toBe('/');
    expect(compiled.querySelector('.route-progress')).not.toBeNull();
    expect(compiled.querySelector('app-landing')).not.toBeNull();
    expect(compiled.querySelector('#workflow-title')?.textContent).toContain('From metadata to editable code');
    expect(compiled.querySelector('.top-bar__link')?.textContent).toContain('Sign in');
  });

  it('keeps the login form on its own route and sends unknown paths to the landing page', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/login');
    fixture.detectChanges();
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('app-login form')).not.toBeNull();
    expect(compiled.querySelector('app-landing')).toBeNull();

    await router.navigateByUrl('/does-not-exist');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/');
    expect(compiled.querySelector('app-landing')).not.toBeNull();
    expect(compiled.querySelector('app-login')).toBeNull();
  });

  it('renders the compact home for a valid unexpired session', async () => {
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
    expect(compiled.querySelector('#home-welcome')?.textContent).toContain('Welcome, Ada.');
    expect(compiled.querySelector('.home-card__action')?.textContent).toContain('See status');
    expect(compiled.querySelector('app-landing')).toBeNull();
    expect(compiled.querySelector('#workflow-title')).toBeNull();
  });

  it('redirects /home to login when the session is missing', async () => {
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/home');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/login?returnUrl=%2Fhome');
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

    expect(router.url).toBe('/login?returnUrl=%2Fhome');
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-home')).toBeNull();
  });

  it('keeps the authenticated Home view after the stored JWT is edited until a later navigation', async () => {
    storeSession(jwtWithExp(futureExp()));
    const { router, compiled } = await render('/home');

    storeSession('not-a-jwt');

    expect(router.url).toBe('/home');
    expect(compiled.querySelector('app-home')).not.toBeNull();
    expect(compiled.querySelector('#home-welcome')?.textContent).toContain('Welcome, Ada.');
    expect(sessionStorage.getItem('gsuif.auth')).not.toBeNull();
  });

  it('rejects a malformed stored JWT on the next route navigation', async () => {
    storeSession(jwtWithExp(futureExp()));
    const { router, fixture, compiled } = await render('/home');

    storeSession('not-a-jwt');
    await router.navigateByUrl('/projects');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/login?returnUrl=%2Fprojects');
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
    expect(compiled.querySelector('app-home')).toBeNull();
  });

  it('rejects a malformed stored JWT after a full bootstrap, the way a page refresh does', async () => {
    storeSession(jwtWithExp(futureExp()));
    const signedIn = await render('/home');
    expect(signedIn.compiled.querySelector('app-home')).not.toBeNull();
    signedIn.fixture.destroy();

    storeSession('not-a-jwt');
    await TestBed.inject(Router).navigateByUrl('/');
    const refreshed = await render('/home');

    expect(refreshed.router.url).toBe('/login?returnUrl=%2Fhome');
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
    expect(refreshed.compiled.querySelector('app-home')).toBeNull();
  });

  it('keeps a structurally valid JWT with an unverified signature after navigation and a full bootstrap', async () => {
    storeSession(jwtWithInvalidSignature(futureExp()));
    const signedIn = await render('/home');
    expect(signedIn.router.url).toBe('/home');
    expect(signedIn.compiled.querySelector('app-home')).not.toBeNull();

    await signedIn.router.navigateByUrl('/projects');
    signedIn.fixture.detectChanges();
    await signedIn.fixture.whenStable();
    expect(signedIn.router.url).toBe('/projects');
    expect(sessionStorage.getItem('gsuif.auth')).not.toBeNull();
    signedIn.fixture.destroy();

    const refreshed = await render('/home');
    expect(refreshed.router.url).toBe('/home');
    expect(refreshed.compiled.querySelector('app-home')).not.toBeNull();
    expect(sessionStorage.getItem('gsuif.auth')).not.toBeNull();
  });

  it('clears the session when a protected API rejects a structurally valid JWT', async () => {
    storeSession(jwtWithInvalidSignature(futureExp()));
    const { router, fixture, compiled } = await render('/home');

    TestBed.inject(HttpClient).get('/api/v1/work-orders').subscribe({ error: () => undefined });
    TestBed.inject(HttpTestingController).expectOne('/api/v1/work-orders').flush({
      status: 'UNAUTHORIZED',
      clientMessage: 'Authentication required',
      statusCode: 401,
      body: null,
      errors: null
    }, { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(router.url).toBe('/login?returnUrl=%2Fhome');
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
    expect(compiled.querySelector('app-home')).toBeNull();
    expect(compiled.querySelector('app-notification-banner')?.textContent).toContain('session has expired');
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

    expect(router.url).toBe('/login?returnUrl=%2Fhome');
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

  it('renders the theme toggle when signed out and switches to the dark theme', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const toggle = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.top-bar__account button.theme-toggle');
    expect(toggle).not.toBeNull();

    toggle?.click();
    fixture.detectChanges();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(toggle?.getAttribute('aria-checked')).toBe('true');
  });

  it('renders the theme toggle when signed in', () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: jwtWithExp(futureExp()),
      tokenType: 'Bearer',
      username: 'Ada Lovelace',
      roles: []
    }));
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.top-bar__account button.theme-toggle')).not.toBeNull();
  });

  it('marks only the active nav link with aria-current', async () => {
    sessionStorage.setItem('gsuif.auth', JSON.stringify({
      token: jwtWithExp(futureExp()),
      tokenType: 'Bearer',
      username: 'Ada Lovelace',
      roles: []
    }));
    const fixture = TestBed.createComponent(AppComponent);
    const router = TestBed.inject(Router);

    await router.navigateByUrl('/home');
    fixture.detectChanges();
    await fixture.whenStable();

    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('.top-bar__link'));
    const home = links.find(link => link.textContent?.trim() === 'Home');
    const projects = links.find(link => link.textContent?.trim() === 'Projects');
    expect(home?.getAttribute('aria-current')).toBe('page');
    expect(projects?.hasAttribute('aria-current')).toBe(false);
  });

  it('sends a valid session from /login to /home without looping back', async () => {
    storeSession(jwtWithExp(futureExp()));
    const { router } = await render('/login');

    expect(router.url).toBe('/home');
  });

  it('keeps an invalid session on /login without looping back to /home', async () => {
    storeSession('not-a-jwt');
    const { router, compiled } = await render('/login');

    expect(router.url).toBe('/login');
    expect(compiled.querySelector('app-login form')).not.toBeNull();
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
  });

  it('returns to the originally requested route after a successful login', async () => {
    const { router, fixture } = await render('/projects');
    expect(router.url).toBe('/login?returnUrl=%2Fprojects');

    await submitLogin(fixture, { token: jwtWithExp(futureExp()), tokenType: 'Bearer', username: 'Ada Lovelace', roles: [] });

    expect(router.url).toBe('/projects');
    expect(TestBed.inject(AuthService).isLoggedIn()).toBe(true);
  });

  it('stays on login with feedback when the login token is invalid', async () => {
    const { router, fixture, compiled } = await render('/login');

    await submitLogin(fixture, { token: 'not-a-jwt', tokenType: 'Bearer', username: 'Ada Lovelace', roles: [] });

    expect(router.url).toBe('/login');
    expect(sessionStorage.getItem('gsuif.auth')).toBeNull();
    expect(compiled.querySelector('app-notification-banner')?.textContent).toContain('invalid session');
  });

  it('dismisses the notification from its close button', async () => {
    const { fixture, compiled } = await render('/login');
    TestBed.inject(NotificationService).show('Unable to reach the server.');
    fixture.detectChanges();
    expect(compiled.querySelector('app-notification-banner')?.textContent).toContain('Unable to reach the server.');

    compiled.querySelector<HTMLButtonElement>('.notification__dismiss')!.click();
    fixture.detectChanges();

    expect(compiled.querySelector('app-notification-banner')).toBeNull();
  });

  it('keeps the return URL when the skip link is used on the login page', async () => {
    const { router, fixture, compiled } = await render('/projects');

    compiled.querySelector<HTMLAnchorElement>('.skip-link')!.click();
    await fixture.whenStable();
    expect(router.url).toBe('/login?returnUrl=%2Fprojects#main-content');

    await submitLogin(fixture, { token: jwtWithExp(futureExp()), tokenType: 'Bearer', username: 'Ada Lovelace', roles: [] });

    expect(router.url).toBe('/projects');
  });

  describe('focus after navigation', () => {
    let host: HTMLElement | undefined;

    afterEach(() => {
      host?.remove();
      host = undefined;
    });

    it('focuses the main content when the path changes but not on the initial navigation', async () => {
      const fixture = TestBed.createComponent(AppComponent);
      const router = TestBed.inject(Router);
      host = fixture.nativeElement as HTMLElement;
      document.body.appendChild(host);
      const main = host.querySelector<HTMLElement>('#main-content');
      fixture.detectChanges();

      await router.navigateByUrl('/');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).not.toBe(main);

      await router.navigateByUrl('/login');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.activeElement).toBe(main);
    });

    it('does not move focus when only the fragment changes', async () => {
      const fixture = TestBed.createComponent(AppComponent);
      const router = TestBed.inject(Router);
      host = fixture.nativeElement as HTMLElement;
      document.body.appendChild(host);
      fixture.detectChanges();

      await router.navigateByUrl('/');
      fixture.detectChanges();
      await fixture.whenStable();

      const toggle = host.querySelector<HTMLButtonElement>('button.theme-toggle');
      toggle?.focus();
      expect(document.activeElement).toBe(toggle);

      await router.navigateByUrl('/#platform-workflow');
      fixture.detectChanges();
      await fixture.whenStable();

      expect(router.url).toBe('/#platform-workflow');
      expect(document.activeElement).toBe(toggle);
      expect(document.activeElement).not.toBe(host.querySelector('#main-content'));
    });
  });
});

async function render(url: string): Promise<{ fixture: ComponentFixture<AppComponent>; router: Router; compiled: HTMLElement }> {
  const fixture = TestBed.createComponent(AppComponent);
  const router = TestBed.inject(Router);

  await router.navigateByUrl(url);
  fixture.detectChanges();
  await fixture.whenStable();

  return { fixture, router, compiled: fixture.nativeElement as HTMLElement };
}

async function submitLogin(fixture: ComponentFixture<AppComponent>, body: object): Promise<void> {
  const compiled = fixture.nativeElement as HTMLElement;
  for (const [id, value] of [['username', 'Ada Lovelace'], ['password', 'secret']]) {
    const input = compiled.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
  compiled.querySelector('form')!.dispatchEvent(new Event('submit'));

  TestBed.inject(HttpTestingController).expectOne('/api/auth/login').flush({
    status: 'OK',
    clientMessage: 'Authentication successful',
    statusCode: 200,
    body,
    errors: null
  });
  await fixture.whenStable();
  fixture.detectChanges();
}

function storeSession(token: string): void {
  sessionStorage.setItem('gsuif.auth', JSON.stringify({ token, tokenType: 'Bearer', username: 'Ada Lovelace', roles: [] }));
}

function futureExp(): number {
  return Math.floor(Date.now() / 1000) + 3600;
}

function jwtWithExp(exp: number): string {
  const encode = (value: object): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp })}.sig`;
}

function jwtWithInvalidSignature(exp: number): string {
  const [header, payload] = jwtWithExp(exp).split('.');
  return `${header}.${payload}.dGFtcGVyZWQ`;
}
