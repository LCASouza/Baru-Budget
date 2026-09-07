import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AsyncState } from './async-state';

@Component({
  imports: [AsyncState],
  template: `
    <app-async-state
      [loading]="loading()"
      [loaded]="loaded()"
      [error]="error()"
      [empty]="empty()"
      emptyTitle="Nada aqui"
      (retry)="retried = retried + 1"
    >
      <p class="content">conteúdo</p>
      <button emptyAction type="button">Criar</button>
    </app-async-state>
  `,
})
class Host {
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal<unknown>(null);
  readonly empty = signal(false);
  retried = 0;
}

describe('AsyncState', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  const text = () => fixture.nativeElement.textContent as string;
  const has = (selector: string) => fixture.nativeElement.querySelector(selector) !== null;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Host] }).compileComponents();
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows the content when nothing else applies', () => {
    expect(has('.content')).toBe(true);
    expect(has('mat-progress-bar')).toBe(false);
  });

  it('shows the progress bar only on the first load', () => {
    host.loading.set(true);
    fixture.detectChanges();
    expect(has('mat-progress-bar')).toBe(true);

    host.loaded.set(true);
    fixture.detectChanges();
    expect(has('mat-progress-bar')).toBe(false);
    expect(has('.content')).toBe(true);
  });

  it('puts the error ahead of the empty state', () => {
    host.error.set(new Error('falhou'));
    host.empty.set(true);
    fixture.detectChanges();
    expect(text()).toContain('Não foi possível carregar');
    expect(text()).not.toContain('Nada aqui');
  });

  it('asks to retry when the button is pressed', () => {
    host.error.set(new Error('falhou'));
    fixture.detectChanges();
    fixture.nativeElement.querySelector('button')?.click();
    expect(host.retried).toBe(1);
  });

  it('shows the empty state with its action', () => {
    host.empty.set(true);
    fixture.detectChanges();
    expect(text()).toContain('Nada aqui');
    expect(text()).toContain('Criar');
    expect(has('.content')).toBe(false);
  });

  it('treats an undefined error as no error', () => {
    host.error.set(undefined);
    fixture.detectChanges();
    expect(has('.content')).toBe(true);
  });
});
