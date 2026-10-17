import { TestBed } from '@angular/core/testing';
import { NOTIFICATION_DURATION_MS, NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = TestBed.inject(NotificationService);
  });

  afterEach(() => vi.useRealTimers());

  it('dismisses a notification automatically after 5 seconds', () => {
    service.show('Unable to reach the server.');

    vi.advanceTimersByTime(NOTIFICATION_DURATION_MS - 1);
    expect(service.message()).toBe('Unable to reach the server.');

    vi.advanceTimersByTime(1);
    expect(service.message()).toBeNull();
    expect(NOTIFICATION_DURATION_MS).toBe(5000);
  });

  it('replaces the previous notification and restarts the timer', () => {
    service.show('First');
    vi.advanceTimersByTime(4000);
    service.show('Second');
    vi.advanceTimersByTime(4000);

    expect(service.message()).toBe('Second');

    vi.advanceTimersByTime(1000);
    expect(service.message()).toBeNull();
  });

  it('dismisses only the notification that matches the id', () => {
    const first = service.show('First');
    service.show('Second');

    service.dismiss(first);
    expect(service.message()).toBe('Second');

    service.dismiss(null);
    expect(service.message()).toBe('Second');
  });

  it('clears immediately', () => {
    const id = service.show('Message');

    service.clear();
    expect(service.message()).toBeNull();

    service.dismiss(id);
    expect(service.message()).toBeNull();
  });
});
