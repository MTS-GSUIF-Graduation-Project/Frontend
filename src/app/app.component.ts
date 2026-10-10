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
}

@Component({
  selector: 'app-protected-placeholder',
  standalone: false,
  template: `
    <section class="route-surface" aria-labelledby="page-title">
      <app-page-header title="Projects"></app-page-header>
      <p>The metadata browser is planned for SCRUM-71.</p>
    </section>
  `
})
export class ProtectedPlaceholderComponent {
}
