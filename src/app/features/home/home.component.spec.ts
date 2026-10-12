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

  it('renders the compact welcome, projects panel, and explanation', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('.home__welcome')?.textContent).toContain('Welcome, Ada Lovelace.');
    expect(compiled.textContent).toContain('Open a project to view its pages and metadata versions.');
    expect(compiled.querySelector('#projects-title')?.textContent).toContain('Projects');
    expect(compiled.textContent).toContain('Browse projects, pages, and saved metadata versions.');
    expect(compiled.querySelector('button')?.textContent).toContain('Coming soon');
    expect(compiled.querySelector('a[href="/projects"]')).toBeNull();
    expect(compiled.querySelector('summary')?.textContent).toContain('How GSUIF works');
    expect(compiled.querySelector('#capabilities-title')).toBeNull();
    expect(compiled.querySelector('#workflow-title')).toBeNull();
    expect(compiled.querySelector('#final-cta-title')).toBeNull();
  });

  it('uses the documented fallback when the username is blank', () => {
    auth.getUsername.mockReturnValue('   ');
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.home__welcome')?.textContent).toContain('Welcome.');
  });
});
