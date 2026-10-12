import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { NotificationService } from './core/services/notification.service';

const MIN_PROGRESS_MS = 450;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.css'
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationService);
  protected readonly navigating = signal(false);

  private progressStartedAt = 0;
  private progressTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(Router).events.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event instanceof NavigationStart) {
        clearTimeout(this.progressTimer);
        this.progressStartedAt = Date.now();
        this.navigating.set(true);
      } else if (event instanceof NavigationEnd || event instanceof NavigationCancel || event instanceof NavigationError) {
        const remaining = Math.max(0, MIN_PROGRESS_MS - (Date.now() - this.progressStartedAt));
        this.progressTimer = setTimeout(() => this.navigating.set(false), remaining);
      }
    });
  }

  protected get initials(): string {
    return this.auth.getUsername().trim().slice(0, 2).toUpperCase();
  }
}

@Component({
  selector: 'app-protected-placeholder',
  standalone: false,
  template: `
    <section class="route-surface projects-soon" aria-labelledby="page-title">
      <app-page-header title="Projects" description="Coming soon."></app-page-header>
      <p>Browsing projects, pages, and saved metadata versions is not available yet.</p>
    </section>
  `
})
export class ProtectedPlaceholderComponent {
}
