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

  it('renders the expanded Home sections and approved navigation targets', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const primaryCta = compiled.querySelector<HTMLAnchorElement>('.hero__action--primary');
    const secondaryCta = compiled.querySelector<HTMLAnchorElement>('.hero__action--secondary');
    const finalCta = compiled.querySelector<HTMLAnchorElement>('.final-cta__action');

    expect(compiled.querySelector('.hero__welcome')?.textContent).toContain('Welcome, Ada Lovelace.');
    expect(compiled.querySelector('#capabilities-title')?.textContent).toContain('What GSUIF does');
    expect(compiled.querySelector('#workflow-title')?.textContent).toContain('From metadata to editable code');
    expect(compiled.querySelector('#final-cta-title')?.textContent).toContain('Explore your metadata structure.');
    expect(primaryCta?.getAttribute('href')).toBe('/projects');
    expect(secondaryCta?.getAttribute('href')).toMatch(/#platform-workflow$/);
    expect(finalCta?.getAttribute('href')).toBe('/projects');
    expect(compiled.querySelector('#platform-workflow')).not.toBeNull();
  });

  it('uses the documented fallback when the username is blank', () => {
    auth.getUsername.mockReturnValue('   ');
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).querySelector('.hero__welcome')?.textContent).toContain('Welcome.');
  });
});
