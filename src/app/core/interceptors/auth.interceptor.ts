import { inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * HTTP interceptor that:
 *   1. Attaches the Bearer access token to every outgoing API request.
 *   2. On a 401 response, attempts a silent token refresh (one retry).
 *   3. If the refresh also fails, logs the user out.
 *
 * Registered via `withInterceptors([authInterceptor])` in app.config.ts.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const authService = inject(AuthService);
  const accessToken = authService.accessToken();

  // Attach token if available
  const authReq = accessToken ? addAuthHeader(req, accessToken) : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && accessToken) {
        // Access token expired — try a silent refresh, then replay the original request once
        return from(authService.silentRefresh()).pipe(
          switchMap(() => {
            const newToken = authService.accessToken();
            return next(addAuthHeader(req, newToken ?? ''));
          }),
          catchError((refreshError) => {
            // Refresh token also expired/invalid — force logout
            authService.logout();
            return throwError(() => refreshError);
          }),
        );
      }
      return throwError(() => error);
    }),
  );
};

function addAuthHeader(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({
    headers: req.headers.set('Authorization', `Bearer ${token}`),
  });
}

