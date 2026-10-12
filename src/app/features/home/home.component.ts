import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  standalone: false,
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  private readonly auth = inject(AuthService);

  get welcomeMessage(): string {
    const firstName = this.auth.getUsername().trim().split(/\s+/)[0];
    return firstName ? `Welcome, ${firstName}.` : 'Welcome.';
  }
}
