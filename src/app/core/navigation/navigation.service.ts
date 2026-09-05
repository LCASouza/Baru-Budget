import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { SECONDARY_NAV_ITEMS } from './nav-items';

function deepestTitle(route: ActivatedRouteSnapshot): string | undefined {
  let current: ActivatedRouteSnapshot | null = route;
  let title: string | undefined;
  while (current) {
    title = current.title ?? title;
    current = current.firstChild;
  }
  return title;
}

@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly router = inject(Router);

  readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  readonly currentTitle = computed(() => {
    this.currentUrl();
    return deepestTitle(this.router.routerState.snapshot.root) ?? '';
  });

  readonly isSecondaryRouteActive = computed(() => {
    const url = this.currentUrl();
    return SECONDARY_NAV_ITEMS.some((item) => url.startsWith(item.path));
  });
}
