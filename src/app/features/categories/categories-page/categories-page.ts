import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CATEGORY_KIND_LABELS, CategoryKind } from '../../../core/finance/category-kind';
import { describeDataError } from '../../../core/supabase/data-error';
import { confirmAction } from '../../../shared/components/confirm-dialog/confirm-dialog';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';
import { CategoriesStore } from '../categories.store';
import { Category } from '../category.model';
import {
  CategoryFormData,
  CategoryFormDialog,
} from '../category-form-dialog/category-form-dialog';

interface CategorySection {
  readonly kind: CategoryKind;
  readonly title: string;
  readonly icon: string;
  readonly items: readonly Category[];
}

@Component({
  selector: 'app-categories-page',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatProgressBarModule, EmptyState],
  templateUrl: './categories-page.html',
  styleUrl: './categories-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesPage {
  protected readonly store = inject(CategoriesStore);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly sections = computed<readonly CategorySection[]>(() => [
    {
      kind: 'INCOME',
      title: `${CATEGORY_KIND_LABELS.INCOME}s`,
      icon: 'arrow_downward',
      items: this.store.ofKind('INCOME'),
    },
    {
      kind: 'EXPENSE',
      title: `${CATEGORY_KIND_LABELS.EXPENSE}s`,
      icon: 'arrow_upward',
      items: this.store.ofKind('EXPENSE'),
    },
  ]);

  protected openForm(data: CategoryFormData = {}): void {
    this.dialog.open(CategoryFormDialog, { data, maxWidth: 'calc(100vw - 32px)', autoFocus: 'dialog' });
  }

  protected async toggleActive(category: Category): Promise<void> {
    try {
      await this.store.setActive(category.id, !category.active);
    } catch {
      this.snackBar.open('Não foi possível atualizar a categoria.', 'OK', { duration: 5000 });
    }
  }

  protected async remove(category: Category): Promise<void> {
    const confirmed = await confirmAction(this.dialog, {
      title: 'Excluir categoria',
      message: `A categoria "${category.name}" será excluída. Categorias com movimentações não podem ser excluídas; nesse caso, desative-a.`,
      confirmLabel: 'Excluir',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.store.remove(category.id);
      this.snackBar.open('Categoria excluída.', undefined, { duration: 3000 });
    } catch (error) {
      this.snackBar.open(
        describeDataError(error, {
          inUse: 'Esta categoria possui movimentações. Desative-a em vez de excluir.',
          fallback: 'Não foi possível excluir a categoria.',
        }),
        'OK',
        { duration: 6000 },
      );
    }
  }
}
