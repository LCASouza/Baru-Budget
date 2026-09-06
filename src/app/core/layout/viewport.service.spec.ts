import { BreakpointObserver, BreakpointState } from '@angular/cdk/layout';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MOBILE_QUERY, TABLET_QUERY, ViewportService, ViewportSize } from './viewport.service';

function configureViewport(matched: ViewportSize): ViewportService {
  const state: BreakpointState = {
    matches: matched !== 'desktop',
    breakpoints: {
      [MOBILE_QUERY]: matched === 'mobile',
      [TABLET_QUERY]: matched === 'tablet',
    },
  };
  TestBed.configureTestingModule({
    providers: [{ provide: BreakpointObserver, useValue: { observe: () => of(state) } }],
  });
  return TestBed.inject(ViewportService);
}

describe('ViewportService', () => {
  it('reports mobile when the mobile query matches', () => {
    const service = configureViewport('mobile');
    expect(service.size()).toBe('mobile');
    expect(service.isMobile()).toBe(true);
    expect(service.isDesktop()).toBe(false);
  });

  it('reports tablet when the tablet query matches', () => {
    const service = configureViewport('tablet');
    expect(service.size()).toBe('tablet');
    expect(service.isTablet()).toBe(true);
  });

  it('reports desktop when no query matches', () => {
    const service = configureViewport('desktop');
    expect(service.size()).toBe('desktop');
    expect(service.isDesktop()).toBe(true);
    expect(service.isMobile()).toBe(false);
  });
});
