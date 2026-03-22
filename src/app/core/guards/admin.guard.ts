import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protects routes that require the 'admin' role.
 *
 * Rules:
 *   - User must be logged in AND have role === 'admin'.
 *   - Non-admins are redirected to /dashboard (they are logged in but not permitted).
 *
 * Usage in routes:
 *   { path: 'products', canActivate: [adminGuard], loadComponent: ... }
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (authService.isLoggedIn() && authService.isAdmin()) {
    return true;
  }

  // Logged in but not an admin → send to dashboard overview (no 403 shown)
  return router.createUrlTree(['/dashboard']);
};

