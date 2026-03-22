import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protects routes that require an authenticated admin.
 *
 * Rules:
 *   - User must be logged in (valid access token in memory).
 *   - User must have the 'admin' role.
 *   - Saves the attempted URL as a query param so the login page can redirect back.
 *
 * Usage in routes:
 *   { path: 'dashboard', canActivate: [authGuard], component: DashboardComponent }
 */
export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (authService.isLoggedIn() && authService.isAdmin()) {
    return true;
  }

  // Redirect to login, preserve the intended destination
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};

