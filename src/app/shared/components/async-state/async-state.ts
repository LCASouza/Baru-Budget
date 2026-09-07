import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { EmptyState } from '../empty-state/empty-state';

/**
 * Every screen answers the same three questions: is it loading, did it fail, is
 * it empty. Copying the trio by hand is how a screen ends up without an error
 * branch, so the order and the appearance live here and the screen only says
 * what each case means.
 */
@Component({
  selector: 'app-async-state',
  imports: [MatButtonModule, MatProgressBarModule, EmptyState],
  templateUrl: './async-state.html',
  styleUrl: './async-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsyncState {
  readonly loading = input(false);
  readonly error = input<unknown>(null);
  readonly empty = input(false);

  /** True once something has been loaded, so a refresh does not blank the screen. */
  readonly loaded = input(false);

  readonly errorTitle = input('Não foi possível carregar');
  readonly errorDescription = input('Verifique a conexão e tente novamente.');
  readonly emptyIcon = input('inbox');
  readonly emptyTitle = input('Nada por aqui');
  readonly emptyDescription = input<string>();

  readonly retry = output<void>();

  protected readonly showLoading = computed(() => this.loading() && !this.loaded());
  protected readonly showError = computed(() => !this.showLoading() && this.error() !== null && this.error() !== undefined);
  protected readonly showEmpty = computed(() => !this.showLoading() && !this.showError() && this.empty());
  protected readonly showContent = computed(() => !this.showLoading() && !this.showError() && !this.showEmpty());
}
