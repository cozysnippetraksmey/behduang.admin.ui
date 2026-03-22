import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

/** Validates password meets the same rules enforced by the API. */
function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value ?? '';
  const errors: Record<string, boolean> = {};

  if (!/[A-Z]/.test(value)) errors['noUppercase']  = true;
  if (!/[a-z]/.test(value)) errors['noLowercase']  = true;
  if (!/[0-9]/.test(value)) errors['noDigit']      = true;

  return Object.keys(errors).length ? errors : null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css',
})
export class RegisterComponent {
  private readonly fb          = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router      = inject(Router);

  // ─── Form ─────────────────────────────────────────────────────────────────────

  form = this.fb.group({
    name:     [''],
    email:    ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8), passwordStrengthValidator]],
  });

  // ─── UI state ─────────────────────────────────────────────────────────────────

  readonly loading      = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly showPassword = signal(false);

  /** Set to true after a successful registration — shows the "check your email" screen. */
  readonly registered   = signal(false);
  readonly registeredEmail = signal('');

  // ─── Actions ──────────────────────────────────────────────────────────────────

  async onSubmit(): Promise<void> {
    if (this.form.invalid || this.loading()) return;

    this.errorMessage.set(null);
    this.loading.set(true);

    const { name, email, password } = this.form.getRawValue();

    try {
      await this.authService.register({
        email:    email!,
        password: password!,
        ...(name?.trim() ? { name: name.trim() } : {}),
      });
      this.registeredEmail.set(email!);
      this.registered.set(true);
    } catch (err: unknown) {
      this.errorMessage.set(this.extractMessage(err, 'Registration failed. Please try again.'));
    } finally {
      this.loading.set(false);
    }
  }

  goToLogin(): void {
    void this.router.navigate(['/login']);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update((v) => !v);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  private extractMessage(err: unknown, fallback: string): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null && 'error' in err) {
      const apiErr = (err as { error?: { message?: string } }).error;
      if (apiErr?.message) return apiErr.message;
    }
    return fallback;
  }

  // ─── Form helpers (used in template) ──────────────────────────────────────────

  get nameControl()     { return this.form.controls.name; }
  get emailControl()    { return this.form.controls.email; }
  get passwordControl() { return this.form.controls.password; }
}

