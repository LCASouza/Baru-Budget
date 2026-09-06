import { Injectable, computed, inject, resource } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { CategoryKind } from '../../core/finance/category-kind';
import { Category, CategoryInput } from './category.model';
import { CategoryRepository } from './category.repository';

@Injectable({ providedIn: 'root' })
export class CategoriesStore {
  private readonly auth = inject(AuthService);
  private readonly repository = inject(CategoryRepository);

  private readonly categoriesResource = resource({
    params: () => this.auth.userId() ?? undefined,
    loader: () => this.repository.listAll(),
  });

  readonly categories = computed<readonly Category[]>(() =>
    this.categoriesResource.hasValue() ? this.categoriesResource.value() : [],
  );
  readonly activeCategories = computed(() =>
    this.categories().filter((category) => category.active),
  );
  readonly byId = computed(
    () => new Map(this.categories().map((category) => [category.id, category])),
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

  async create(input: CategoryInput): Promise<void> {
    await this.repository.create(this.requireUserId(), input);
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

  private requireUserId(): string {
    const userId = this.auth.userId();
    if (!userId) {
      throw new Error('No authenticated user.');
    }
    return userId;
  }
}
