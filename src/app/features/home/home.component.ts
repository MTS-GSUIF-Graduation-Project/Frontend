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
    const username = this.auth.getUsername().trim();
    return username ? `Welcome, ${username}.` : 'Welcome.';
  }
}
