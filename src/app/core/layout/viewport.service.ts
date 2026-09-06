import { BreakpointObserver } from '@angular/cdk/layout';
import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

export type ViewportSize = 'mobile' | 'tablet' | 'desktop';

export const MOBILE_QUERY = '(max-width: 767.98px)';
export const TABLET_QUERY = '(min-width: 768px) and (max-width: 1023.98px)';

@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly breakpoints = inject(BreakpointObserver);

  readonly size = toSignal(
    this.breakpoints.observe([MOBILE_QUERY, TABLET_QUERY]).pipe(
      map((state): ViewportSize => {
        if (state.breakpoints[MOBILE_QUERY]) {
          return 'mobile';
        }
        if (state.breakpoints[TABLET_QUERY]) {
          return 'tablet';
        }
        return 'desktop';
      }),
    ),
    { initialValue: 'desktop' as ViewportSize },
  );

  readonly isMobile = computed(() => this.size() === 'mobile');
  readonly isTablet = computed(() => this.size() === 'tablet');
  readonly isDesktop = computed(() => this.size() === 'desktop');
}
