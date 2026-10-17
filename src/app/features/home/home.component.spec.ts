import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/services/auth.service';
import { HomeComponent } from './home.component';
import { HomeModule } from './home.module';

describe('HomeComponent', () => {
  const auth = { getUsername: vi.fn() };

  beforeEach(async () => {
    auth.getUsername.mockReturnValue('Ada Lovelace');

    await TestBed.configureTestingModule({
      imports: [HomeModule],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth }
      ]
    }).compileComponents();
  });

  it('renders the compact dashboard with the projects card', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.home__breadcrumb')?.textContent).toContain('Home');
    expect(compiled.querySelector('#home-welcome')?.textContent).toContain('Welcome, Ada.');
    expect(compiled.querySelector('.home__support')?.textContent?.trim()).toBe(
      'Open a project to view its pages and metadata versions.'
    );
    expect(compiled.querySelector('#projects-title')?.textContent).toContain('Projects');
    expect(compiled.querySelector('.home-card__body p')?.textContent?.trim()).toBe(
      'Browse your projects, pages, and saved metadata versions.'
    );
    expect(compiled.querySelector<HTMLAnchorElement>('.home-card__action')?.getAttribute('href')).toBe('/projects');
    expect(compiled.querySelector('.home-card__action')?.textContent).toContain('View projects');
    expect(compiled.querySelector('.home-help')?.textContent).toContain('New to GSUIF?');
    expect(compiled.querySelector('.home-help a')?.textContent).toContain('How GSUIF works');
    expect(compiled.querySelector<HTMLAnchorElement>('.home-help a')?.getAttribute('href')).toBe('/');
    expect(compiled.querySelector('.hero')).toBeNull();
    expect(compiled.querySelector('#workflow-title')).toBeNull();
  });

  it('uses the documented fallback when the username is blank', () => {
    auth.getUsername.mockReturnValue('   ');
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('#home-welcome')?.textContent).toContain('Welcome.');
  });
});
