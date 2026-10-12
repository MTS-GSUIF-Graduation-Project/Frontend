import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { LandingComponent } from './landing.component';
import { LandingModule } from './landing.module';

describe('LandingComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingModule],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('renders the landing sections and approved navigation targets', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const primaryCta = compiled.querySelector<HTMLAnchorElement>('.hero__action--primary');
    const secondaryCta = compiled.querySelector<HTMLAnchorElement>('.hero__action--secondary');
    const finalCta = compiled.querySelector<HTMLAnchorElement>('.final-cta__action');

    expect(compiled.querySelector('#hero-title')?.textContent).toContain('Metadata becomes structure.');
    expect(compiled.querySelector('.hero__welcome')).toBeNull();
    expect(compiled.querySelector('#capabilities-title')?.textContent).toContain('What GSUIF does');
    expect(compiled.querySelector('#workflow-title')?.textContent).toContain('From metadata to editable code');
    expect(compiled.querySelector('#final-cta-title')?.textContent).toContain('Explore your metadata structure.');
    expect(primaryCta?.getAttribute('href')).toBe('/projects');
    expect(secondaryCta?.getAttribute('href')).toMatch(/#platform-workflow$/);
    expect(finalCta?.getAttribute('href')).toBe('/projects');
    expect(compiled.querySelector('#platform-workflow')).not.toBeNull();
  });
});
