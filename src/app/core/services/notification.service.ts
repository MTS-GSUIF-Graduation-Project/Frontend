import { Injectable, computed, signal } from '@angular/core';

export const NOTIFICATION_DURATION_MS = 5000;

interface ActiveNotification {
  id: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly active = signal<ActiveNotification | null>(null);
  private nextId = 1;
  private timer: ReturnType<typeof setTimeout> | undefined;

  readonly message = computed(() => this.active()?.message ?? null);

  show(message: string): number {
    const id = this.nextId++;
    clearTimeout(this.timer);
    this.active.set({ id, message });
    this.timer = setTimeout(() => this.dismiss(id), NOTIFICATION_DURATION_MS);
    return id;
  }

  /** Dismisses the notification only if it is still the one identified by `id`. */
  dismiss(id: number | null): void {
    if (id !== null && this.active()?.id === id) {
      this.clear();
    }
  }

  clear(): void {
    clearTimeout(this.timer);
    this.active.set(null);
  }
}
