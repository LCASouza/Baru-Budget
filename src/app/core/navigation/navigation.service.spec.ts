import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { NavigationService } from './navigation.service';

@Component({ template: '' })
class EmptyPage {}

describe('NavigationService', () => {
  let service: NavigationService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'dashboard', title: 'Dashboard', component: EmptyPage },
          { path: 'loans', title: 'Empréstimos', component: EmptyPage },
        ]),
      ],
    });
    service = TestBed.inject(NavigationService);
    router = TestBed.inject(Router);
  });

  it('exposes the url and title of the active route', async () => {
    await router.navigateByUrl('/loans');
    expect(service.currentUrl()).toBe('/loans');
    expect(service.currentTitle()).toBe('Empréstimos');
  });

  it('flags secondary routes for the mobile "Mais" item', async () => {
    await router.navigateByUrl('/loans');
    expect(service.isSecondaryRouteActive()).toBe(true);

    await router.navigateByUrl('/dashboard');
    expect(service.isSecondaryRouteActive()).toBe(false);
  });
});
