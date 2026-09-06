import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthError } from '@supabase/supabase-js';
import { AuthService } from '../../../core/auth/auth.service';

const DEFAULT_TARGET = '/dashboard';

function signInErrorMessage(error: AuthError): string {
  switch (error.code) {
    case 'invalid_credentials':
      return 'E-mail ou senha inválidos.';
    case 'email_not_confirmed':
      return 'Este e-mail ainda não foi confirmado.';
    case 'over_request_rate_limit':
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    default:
      return 'Não foi possível entrar. Tente novamente.';
  }
}

// Only same-origin absolute paths are accepted as a post-login target.
function safeReturnUrl(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : DEFAULT_TARGET;
}

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly hidePassword = signal(true);

  protected async submit(): Promise<void> {
    if (this.submitting()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      const error = await this.auth.signIn(this.form.getRawValue());
      if (error) {
        this.errorMessage.set(signInErrorMessage(error));
        return;
      }
      await this.router.navigateByUrl(
        safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
      );
    } finally {
      this.submitting.set(false);
    }
  }

  protected togglePassword(): void {
    this.hidePassword.update((hidden) => !hidden);
  }
}
