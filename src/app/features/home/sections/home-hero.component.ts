import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-home-hero',
  standalone: false,
  templateUrl: './home-hero.component.html',
  styleUrl: './home-hero.component.css'
})
export class HomeHeroComponent {
  @Input({ required: true }) welcomeMessage = 'Welcome.';
}
