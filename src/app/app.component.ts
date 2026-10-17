import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
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

  @ViewChild('mainContent') private mainContent?: ElementRef<HTMLElement>;

  private progressStartedAt = 0;
  private progressTimer: ReturnType<typeof setTimeout> | undefined;
  private previousPath: string | undefined;

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

      if (event instanceof NavigationEnd) {
        const path = event.urlAfterRedirects.split(/[?#]/)[0];
        if (this.previousPath !== undefined && path !== this.previousPath) {
          this.mainContent?.nativeElement.focus({ preventScroll: true });
        }
        this.previousPath = path;
      }
    });
  }

  protected get initials(): string {
    return this.auth.getUsername().trim().slice(0, 2).toUpperCase();
  }
}
