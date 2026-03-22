import {
  Component,
  inject,
  signal,
  AfterViewInit,
  OnInit,
  ElementRef,
  ViewChild,
  NgZone,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements AfterViewInit, OnInit {
  private readonly fb          = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);
  private readonly route       = inject(ActivatedRoute);
  private readonly ngZone      = inject(NgZone);

  @ViewChild('googleBtn') googleBtnRef!: ElementRef<HTMLDivElement>;

  // ─── Form ─────────────────────────────────────────────────────────────────────

  form = this.fb.group({
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  // ─── UI state ─────────────────────────────────────────────────────────────────

  readonly loading      = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);

  /** Green success banner — shown when returning from a verified email link. */
  readonly successMessage = signal<string | null>(null);
  /** Blue info / warning banner — shown for token errors from the verify-email redirect. */
  readonly infoMessage    = signal<string | null>(null);

  /** Shown when the API returns 403 (email not verified) on login. */
  readonly showResend     = signal(false);
  readonly resendLoading  = signal(false);
  readonly resendSuccess  = signal(false);

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;

    // Success: user just clicked the verification link in their email
    if (params.get('emailVerified') === 'true') {
      this.successMessage.set('✅ Email verified! You can now sign in.');
    }

    // Error redirects from GET /auth/verify-email
    const error = params.get('error');
    if (error === 'token_expired') {
      this.infoMessage.set('⏳ Your verification link has expired. Request a new one below.');
      this.showResend.set(true);
    } else if (error === 'token_used') {
      this.infoMessage.set('✔️ This link has already been used. Please sign in.');
    } else if (error === 'invalid_token') {
      this.infoMessage.set('❌ Invalid verification link. Please request a new one below.');
      this.showResend.set(true);
    }
  }

  ngAfterViewInit(): void {
    this.initGoogleSignIn();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;

    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.showResend.set(false);
    this.resendSuccess.set(false);
    this.loading.set(true);

    try {
      const { email, password } = this.form.getRawValue();
      await this.authService.loginWithEmailPassword({ email: email!, password: password! });
      await this.redirectAfterLogin();
    } catch (err: unknown) {
      if (err instanceof HttpErrorResponse && err.status === 403) {
        this.errorMessage.set('Your email address has not been verified yet.');
        this.showResend.set(true);
      } else {
        this.errorMessage.set(this.extractMessage(err, 'Invalid email or password.'));
      }
    } finally {
      this.loading.set(false);
    }
  }

  async onResendVerification(): Promise<void> {
    const email = this.form.getRawValue().email;
    if (!email || this.resendLoading()) return;

    this.resendLoading.set(true);
    this.resendSuccess.set(false);

    try {
      await this.authService.resendVerification(email);
      this.resendSuccess.set(true);
    } catch (err: unknown) {
      this.errorMessage.set(this.extractMessage(err, 'Could not resend. Please try again later.'));
    } finally {
      this.resendLoading.set(false);
    }
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  // ─── Google Sign-In ───────────────────────────────────────────────────────────

  private initGoogleSignIn(): void {
    if (typeof google === 'undefined') {
      // Script not yet loaded — wait for it
      (window as Window & { onGoogleLibraryLoad?: () => void }).onGoogleLibraryLoad =
        () => this.ngZone.run(() => this.renderGoogleButton());
      return;
    }
    this.renderGoogleButton();
  }

  private renderGoogleButton(): void {
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response) => {
        // Google calls this outside Angular's zone — we must re-enter it
        this.ngZone.run(() => this.handleGoogleCallback(response.credential));
      },
    });

    if (this.googleBtnRef?.nativeElement) {
      google.accounts.id.renderButton(this.googleBtnRef.nativeElement, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width: 360,
      });
    }
  }

  private async handleGoogleCallback(idToken: string): Promise<void> {
    this.errorMessage.set(null);
    this.loading.set(true);

    try {
      await this.authService.loginWithGoogleIdToken(idToken);
      await this.redirectAfterLogin();
    } catch (err: unknown) {
      this.errorMessage.set(this.extractMessage(err, 'Google sign-in failed. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────


  private async redirectAfterLogin(): Promise<void> {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
    await this.router.navigateByUrl(returnUrl);
  }

  private extractMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null && 'error' in err) {
      const apiErr = (err as { error?: { message?: string } }).error;
      if (apiErr?.message) return apiErr.message;
    }
    return fallback;
  }

  // ─── Form helpers (used in template) ──────────────────────────────────────────

  get emailControl() { return this.form.controls.email; }
  get passwordControl() { return this.form.controls.password; }
}

