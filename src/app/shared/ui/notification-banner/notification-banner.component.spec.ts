import { TestBed } from '@angular/core/testing';
import { NotificationBannerComponent } from './notification-banner.component';

describe('NotificationBannerComponent', () => {
  it('renders the message and emits dismissed from the close button', () => {
    TestBed.configureTestingModule({ declarations: [NotificationBannerComponent] });
    const fixture = TestBed.createComponent(NotificationBannerComponent);
    const dismissed = vi.fn();
    fixture.componentRef.setInput('message', 'Unable to reach the server.');
    fixture.componentInstance.dismissed.subscribe(dismissed);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const button = element.querySelector<HTMLButtonElement>('.notification__dismiss');

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Unable to reach the server.');
    expect(button?.getAttribute('aria-label')).toBe('Dismiss notification');

    button?.click();

    expect(dismissed).toHaveBeenCalledOnce();
  });
});
