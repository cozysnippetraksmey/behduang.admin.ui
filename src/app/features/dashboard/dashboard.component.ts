import { Component, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly authService = inject(AuthService);

  readonly currentUser   = this.authService.currentUser;
  readonly logoutLoading = signal(false);

  async onLogout(): Promise<void> {
    this.logoutLoading.set(true);
    await this.authService.logout();
  }

  async onLogoutEverywhere(): Promise<void> {
    this.logoutLoading.set(true);
    await this.authService.logout(true);
  }
}
