import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { AuthResult, LoginRequest, RegisterRequest, RegisterResponse, SetPasswordRequest, TokenPair, UserProfile } from '../models/auth.model';

/**
 * Lightweight session-presence flag stored in localStorage.
 * Value is always '1' — it carries NO sensitive data.
 * Purpose: avoid an unnecessary 401 round-trip on app start when the user
 * has never logged in (HttpOnly cookies are invisible to JS, so we need
 * a side-channel hint to know whether to attempt a silent refresh).
 *
 * Security note: an attacker who can write to localStorage can set this flag,
 * but that only causes one extra (failing) HTTP request — no token is exposed.
 */
const SESSION_FLAG_KEY = 'behdaung_session';

/**
 * Central authentication service for the Behdaung Admin UI.
 *
 * Token storage strategy (after HttpOnly cookie upgrade):
 *   - Access token  → in-memory Signal (XSS-proof; lost on page reload)
 *   - Refresh token → HttpOnly cookie set by the API server
 *       • JS can never read it (immune to XSS theft)
 *       • Sent automatically by the browser on every /auth/* request
 *       • withCredentials: true must be set on all auth HTTP calls
 *   - Session flag  → localStorage key 'behdaung_session' = '1'
 *       • Not a secret — just tells initialize() whether to attempt silent refresh
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http   = inject(HttpClient);
  private readonly router = inject(Router);

  // ─── State (private, writable) ───────────────────────────────────────────────

  private readonly _accessToken  = signal<string | null>(null);
  private readonly _currentUser  = signal<UserProfile | null>(null);
  private readonly _initializing = signal(true);

  // ─── Public signals (read-only) ──────────────────────────────────────────────

  readonly accessToken  = this._accessToken.asReadonly();
  readonly currentUser  = this._currentUser.asReadonly();
  readonly initializing = this._initializing.asReadonly();

  readonly isLoggedIn = computed(() => this._accessToken() !== null);
  readonly isAdmin    = computed(() => this._currentUser()?.role === 'admin');

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  /**
   * Called by APP_INITIALIZER before the app renders.
   * Attempts a silent token refresh using the HttpOnly cookie (if one exists).
   * The SESSION_FLAG is a non-secret hint that avoids a pointless 401 when
   * the user has never logged in.
   */
  async initialize(): Promise<void> {
    const hasSession = localStorage.getItem(SESSION_FLAG_KEY) === '1';
    if (hasSession) {
      try {
        await this.silentRefresh();
      } catch {
        // Cookie expired / revoked — clear local state and go to login
        this.clearSession();
      }
    }
    this._initializing.set(false);
  }

  // ─── Auth operations ──────────────────────────────────────────────────────────

  /**
   * Logs in with email and password.
   * The API sets the HttpOnly refresh token cookie in the response.
   */
  async loginWithEmailPassword(credentials: LoginRequest): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<AuthResult>(
        `${environment.apiUrl}/auth/login`,
        credentials,
        { withCredentials: true },
      ),
    );
    this.applySession(result);
  }

  /**
   * Logs in with a Google ID token (from the Google Identity Services SDK).
   * The API sets the HttpOnly refresh token cookie in the response.
   */
  async loginWithGoogleIdToken(idToken: string): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<AuthResult>(
        `${environment.apiUrl}/auth/google`,
        { idToken },
        { withCredentials: true },
      ),
    );
    this.applySession(result);
  }

  /**
   * Registers a new account with email + password.
   * Returns a success message — the user must verify their email before logging in.
   */
  async register(request: RegisterRequest): Promise<RegisterResponse> {
    return firstValueFrom(
      this.http.post<RegisterResponse>(`${environment.apiUrl}/auth/register`, request),
    );
  }

  /**
   * Re-sends the verification email to the given address.
   * The API enforces a 5-minute cooldown per user.
   */
  async resendVerification(email: string): Promise<void> {
    await firstValueFrom(
      this.http.post(`${environment.apiUrl}/auth/resend-verification`, { email }),
    );
  }

  /**
   * Exchanges the HttpOnly refresh token cookie for a new token pair.
   * No request body needed — the browser sends the cookie automatically.
   * Called by APP_INITIALIZER (session restore) and by the HTTP interceptor (401 retry).
   */
  async silentRefresh(): Promise<void> {
    const tokens = await firstValueFrom(
      this.http.post<TokenPair>(
        `${environment.apiUrl}/auth/refresh`,
        {},                          // empty body — cookie is the credential
        { withCredentials: true },   // sends the HttpOnly cookie cross-origin
      ),
    );

    this._accessToken.set(tokens.accessToken);
    this.decodeAndSetUser(tokens.accessToken);
    // The API sets a new rotated refresh token cookie in the response automatically.
  }

  /**
   * Logs out the current session.
   * Sends withCredentials so the server can read and revoke the HttpOnly cookie,
   * then responds with Set-Cookie: behdaung_rt=; Max-Age=0 to clear it.
   *
   * @param everywhere - Pass true to revoke ALL sessions for this user.
   */
  async logout(everywhere = false): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(
          `${environment.apiUrl}/auth/logout`,
          { everywhere },            // no refreshToken in body — cookie is used by server
          { withCredentials: true },
        ),
      );
    } catch {
      // Best-effort: still clear local state even if the API call fails
    }
    this.clearSession();
    await this.router.navigate(['/login']);
  }

  /**
   * Sets or updates the password for the current user.
   * Requires a valid access token (Bearer header added by the interceptor).
   */
  async setPassword(request: SetPasswordRequest): Promise<void> {
    await firstValueFrom(
      this.http.patch(
        `${environment.apiUrl}/auth/me/password`,
        request,
        { withCredentials: true },
      ),
    );
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  private applySession(result: AuthResult): void {
    this._accessToken.set(result.tokens.accessToken);
    this._currentUser.set(result.user);
    // Refresh token is in the HttpOnly cookie set by the server — do not store here.
    // Set the session flag so initialize() knows to attempt silent refresh on next load.
    localStorage.setItem(SESSION_FLAG_KEY, '1');
  }

  private clearSession(): void {
    this._accessToken.set(null);
    this._currentUser.set(null);
    localStorage.removeItem(SESSION_FLAG_KEY);
  }

  /**
   * Decodes the JWT access token payload (client-side, no signature check needed —
   * the API already verified it when issuing). Populates the _currentUser signal.
   */
  private decodeAndSetUser(token: string): void {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return;

      const payload = JSON.parse(
        atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')),
      );

      this._currentUser.set({
        id:      payload.sub,
        email:   payload.email,
        name:    payload.name    ?? null,
        picture: payload.picture ?? null,
        role:    payload.role,
      });
    } catch {
      // Malformed token — ignore
    }
  }
}

