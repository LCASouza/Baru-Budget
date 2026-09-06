import { Injectable, computed, inject, resource } from '@angular/core';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { CategoryKind } from '../../core/finance/category-kind';
import { Category, CategoryInput } from './category.model';
import { CategoryRepository } from './category.repository';

@Injectable({ providedIn: 'root' })
export class CategoriesStore {
  private readonly context = inject(FinancialContextService);
  private readonly repository = inject(CategoryRepository);

  // Categories of the context owner plus, in a household context, the categories
  // of the other members that row level security lets the user see (the ones used
  // by household transactions), so their names can be displayed.
  private readonly categoriesResource = resource({
    params: () => {
      const ownerId = this.context.dataOwnerId();
      if (!ownerId) {
        return undefined;
      }
      const memberIds = this.context.currentHousehold()?.members.map((m) => m.userId) ?? [];
      return { ownerIds: [...new Set([ownerId, ...memberIds])] };
    },
    loader: ({ params }) => this.repository.listByOwners(params.ownerIds),
  });

  /** Every category loaded, including visible categories of household members. */
  readonly visibleCategories = computed<readonly Category[]>(() =>
    this.categoriesResource.hasValue() ? this.categoriesResource.value() : [],
  );
  /** Categories owned by the context owner. */
  readonly categories = computed(() => {
    const ownerId = this.context.dataOwnerId();
    return this.visibleCategories().filter((category) => category.owner_user_id === ownerId);
  });
  readonly activeCategories = computed(() =>
    this.categories().filter((category) => category.active),
  );
  readonly byId = computed(
    () => new Map(this.visibleCategories().map((category) => [category.id, category])),
  );
  readonly isLoading = this.categoriesResource.isLoading;
  readonly error = this.categoriesResource.error;
  readonly loaded = computed(() => this.categoriesResource.hasValue());

  ofKind(kind: CategoryKind): readonly Category[] {
    return this.categories().filter((category) => category.kind === kind);
  }

  activeOfKind(kind: CategoryKind): readonly Category[] {
    return this.activeCategories().filter((category) => category.kind === kind);
  }

  visibleOfKind(kind: CategoryKind): readonly Category[] {
    return this.visibleCategories().filter((category) => category.kind === kind);
  }

  async create(input: CategoryInput): Promise<void> {
    await this.repository.create(this.requireOwnerId(), input);
    this.reload();
  }

  async rename(id: string, name: string): Promise<void> {
    await this.repository.rename(id, name);
    this.reload();
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.repository.setActive(id, active);
    this.reload();
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(id);
    this.reload();
  }

  reload(): void {
    this.categoriesResource.reload();
  }

  private requireOwnerId(): string {
    const ownerId = this.context.dataOwnerId();
    if (!ownerId) {
      throw new Error('No authenticated user.');
    }
    return ownerId;
  }
}
