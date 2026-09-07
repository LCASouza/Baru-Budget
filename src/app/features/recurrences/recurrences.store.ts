import { Injectable, computed, inject, resource } from '@angular/core';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { PeriodService } from '../../core/period/period.service';
import { AccountsStore } from '../accounts/accounts.store';
import { CardsStore } from '../cards/cards.store';
import { CategoriesStore } from '../categories/categories.store';
import { Transaction } from '../transactions/transaction.model';
import { RecurrenceType, monthKey } from './recurrence';
import {
  RecurrenceInput,
  RecurrenceTemplate,
  RecurrenceView,
  buildRecurrenceViews,
  expectedTotal,
  missingCount,
} from './recurrence.model';
import { RecurrenceRepository } from './recurrence.repository';

@Injectable({ providedIn: 'root' })
export class RecurrencesStore {
  private readonly context = inject(FinancialContextService);
  private readonly period = inject(PeriodService);
  private readonly repository = inject(RecurrenceRepository);
  private readonly categories = inject(CategoriesStore);
  private readonly accounts = inject(AccountsStore);
  private readonly cards = inject(CardsStore);

  private readonly dataResource = resource({
    params: () => {
      const ownerId = this.context.dataOwnerId();
      return ownerId ? { ownerId, month: monthKey(this.period.month()) } : undefined;
    },
    loader: async ({ params }) => {
      const [templates, instances] = await Promise.all([
        this.repository.listTemplates(params.ownerId),
        this.repository.listInstances(params.ownerId, params.month),
      ]);
      return { templates, instances };
    },
  });

  private readonly templates = computed<readonly RecurrenceTemplate[]>(() =>
    this.dataResource.hasValue() ? this.dataResource.value().templates : [],
  );
  private readonly instances = computed<readonly Transaction[]>(() =>
    this.dataResource.hasValue() ? this.dataResource.value().instances : [],
  );

  private readonly views = computed(() =>
    buildRecurrenceViews(
      this.templates(),
      this.instances(),
      this.period.month(),
      new Map(this.categories.visibleCategories().map((c) => [c.id, c.name])),
      new Map(this.accounts.accounts().map((a) => [a.id, a.name])),
      this.cards.nameById(),
    ),
  );

  readonly isLoading = this.dataResource.isLoading;
  readonly error = this.dataResource.error;
  readonly loaded = computed(() => this.dataResource.hasValue());
  readonly canManage = this.context.canManage;

  viewsOf(type: RecurrenceType): readonly RecurrenceView[] {
    return this.views().filter((view) => view.type === type);
  }

  missingOf(type: RecurrenceType): number {
    return missingCount(this.viewsOf(type));
  }

  expectedTotalOf(type: RecurrenceType): number {
    return expectedTotal(this.viewsOf(type));
  }

  readonly totalMissing = computed(() => missingCount(this.views()));

  async create(type: RecurrenceType, input: RecurrenceInput): Promise<void> {
    await this.repository.create(this.requireOwnerId(), type, input);
    this.reload();
  }

  async update(id: string, type: RecurrenceType, input: RecurrenceInput): Promise<void> {
    await this.repository.update(id, type, input);
    this.reload();
  }

  async setActive(id: string, type: RecurrenceType, active: boolean): Promise<void> {
    await this.repository.setActive(id, type, active);
    this.reload();
  }

  async remove(id: string, type: RecurrenceType): Promise<void> {
    await this.repository.remove(id, type);
    this.reload();
  }

  /** Generates the missing instances of the selected month. */
  async generate(): Promise<number> {
    const created = await this.repository.generate(
      this.requireOwnerId(),
      monthKey(this.period.month()),
    );
    this.reload();
    return created;
  }

  reload(): void {
    this.dataResource.reload();
  }

  private requireOwnerId(): string {
    const ownerId = this.context.dataOwnerId();
    if (!ownerId) {
      throw new Error('No authenticated user.');
    }
    return ownerId;
  }
}
