import { Component, inject } from '@angular/core';
import { AuthService } from './core/services/auth.service';
import { NotificationService } from './core/services/notification.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  standalone: false,
  styleUrl: './app.component.css'
})
export class AppComponent {
  protected readonly auth = inject(AuthService);
  protected readonly notifications = inject(NotificationService);

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
