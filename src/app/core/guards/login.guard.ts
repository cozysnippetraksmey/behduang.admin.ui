import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Prevents authenticated admins from accessing the login page.
 * If the user is already logged in and is an admin → redirect to /dashboard.
 *
 * Usage in routes:
 *   { path: 'login', canActivate: [loginGuard], loadComponent: ... }
 */
export const loginGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router      = inject(Router);

  if (authService.isLoggedIn() && authService.isAdmin()) {
    return router.createUrlTree(['/dashboard']);
  }

  return true;
};

