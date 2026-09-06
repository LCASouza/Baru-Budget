import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AuthError } from '@supabase/supabase-js';
import { vi } from 'vitest';
import { AuthService } from '../../../core/auth/auth.service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let fixture: ComponentFixture<LoginPage>;
  let element: HTMLElement;
  let signIn: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  async function configure(returnUrl: string | null): Promise<void> {
    signIn = vi.fn().mockResolvedValue(null);
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { signIn } },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
      ],
    }).compileComponents();
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  }

  function type(selector: string, value: string): void {
    const input = element.querySelector<HTMLInputElement>(selector);
    if (!input) {
      throw new Error(`Missing input ${selector}`);
    }
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function submit(): Promise<void> {
    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('does not sign in with an invalid form', async () => {
    await configure(null);
    await submit();
    expect(signIn).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Informe o e-mail.');
  });

  it('signs in and navigates to the dashboard by default', async () => {
    await configure(null);
    type('input[type="email"]', 'lucas@example.com');
    type('input[autocomplete="current-password"]', 'secret-123');
    await submit();
    expect(signIn).toHaveBeenCalledWith({ email: 'lucas@example.com', password: 'secret-123' });
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates to a safe return url after signing in', async () => {
    await configure('/cards');
    type('input[type="email"]', 'lucas@example.com');
    type('input[autocomplete="current-password"]', 'secret-123');
    await submit();
    expect(navigateByUrl).toHaveBeenCalledWith('/cards');
  });

  it('ignores external return urls', async () => {
    await configure('//evil.example');
    type('input[type="email"]', 'lucas@example.com');
    type('input[autocomplete="current-password"]', 'secret-123');
    await submit();
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('shows a message for invalid credentials', async () => {
    await configure(null);
    signIn.mockResolvedValueOnce(
      new AuthError('Invalid login credentials', 400, 'invalid_credentials'),
    );
    type('input[type="email"]', 'lucas@example.com');
    type('input[autocomplete="current-password"]', 'wrong');
    await submit();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'E-mail ou senha inválidos.',
    );
    expect(navigateByUrl).not.toHaveBeenCalled();
  });
});
