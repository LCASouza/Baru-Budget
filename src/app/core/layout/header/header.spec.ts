import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../auth/auth.service';
import { CurrentProfileService } from '../../profile/current-profile.service';
import { Header } from './header';

registerLocaleData(localePt);

describe('Header', () => {
  let fixture: ComponentFixture<Header>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { signOut: vi.fn().mockResolvedValue(undefined) } },
        {
          provide: CurrentProfileService,
          useValue: {
            initials: signal('LS'),
            displayName: signal('Lucas Souza'),
            email: signal('lucas@example.com'),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Header);
    fixture.componentRef.setInput('title', 'Dashboard');
    fixture.componentRef.setInput('size', 'desktop');
    fixture.detectChanges();
  });

  it('shows the page title and the profile initials', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.header__title')?.textContent?.trim()).toBe('Dashboard');
    expect(element.querySelector('.header__initials')?.textContent?.trim()).toBe('LS');
  });

  it('shows the new transaction button only outside mobile', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.header__new')).not.toBeNull();
    fixture.componentRef.setInput('size', 'mobile');
    fixture.detectChanges();
    expect(element.querySelector('.header__new')).toBeNull();
  });
});
