import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { FinancialContextService } from '../../core/context/financial-context.service';
import { PeriodService } from '../../core/period/period.service';
import { monthLabel, monthRange, shiftMonth } from '../../core/period/period.model';
import { todayIso } from '../../shared/dates/iso-date';
import { sumAmounts } from '../../shared/money/money';
import { AccountsStore } from '../accounts/accounts.store';
import { CardsStore } from '../cards/cards.store';
import { Transaction } from '../transactions/transaction.model';
import {
  InstallmentPurchaseView,
  buildPurchaseViews,
  commitmentByMonth,
  installmentCompetence,
} from './installment.model';
import { InstallmentPurchaseInput, InstallmentRepository } from './installment.repository';

export const COMMITMENT_MONTHS = 6;

@Injectable({ providedIn: 'root' })
export class InstallmentsStore {
  private readonly context = inject(FinancialContextService);
  private readonly period = inject(PeriodService);
  private readonly repository = inject(InstallmentRepository);
  private readonly cards = inject(CardsStore);
  private readonly accounts = inject(AccountsStore);

  private readonly dataResource = resource({
    params: () => this.context.dataOwnerId() ?? undefined,
    loader: async ({ params: ownerId }) => {
      // Two months back covers card instalments whose invoice is still ahead.
      const from = monthRange(shiftMonth({ year: Number(todayIso().slice(0, 4)), month: Number(todayIso().slice(5, 7)) }, -2)).start;
      const [purchases, installments] = await Promise.all([
        this.repository.listPurchases(ownerId),
        this.repository.listInstallmentsFrom(ownerId, from),
      ]);
      return { purchases, installments };
    },
  });

  private readonly purchases = computed(() =>
    this.dataResource.hasValue() ? this.dataResource.value().purchases : [],
  );
  private readonly upcoming = computed<readonly Transaction[]>(() =>
    this.dataResource.hasValue() ? this.dataResource.value().installments : [],
  );

  readonly views = computed<readonly InstallmentPurchaseView[]>(() =>
    buildPurchaseViews(
      this.purchases(),
      this.cards.nameById(),
      new Map(this.accounts.accounts().map((account) => [account.id, account.name])),
    ),
  );
  readonly ongoing = computed(() => this.views().filter((purchase) => !purchase.done));
  readonly isLoading = this.dataResource.isLoading;
  readonly error = this.dataResource.error;
  readonly loaded = computed(() => this.dataResource.hasValue());

  /** Everything still to pay after today. */
  readonly totalRemaining = computed(() =>
    sumAmounts(this.views().map((purchase) => purchase.remainingAmount)),
  );
  readonly remainingCount = computed(() =>
    this.views().reduce((count, purchase) => count + purchase.remainingCount, 0),
  );

  readonly commitmentByMonth = computed(() =>
    commitmentByMonth(
      this.upcoming(),
      todayIso(),
      (month) => {
        const [year, monthNumber] = month.split('-').map(Number);
        return monthLabel({ year, month: monthNumber });
      },
      COMMITMENT_MONTHS,
    ),
  );

  /** Instalments whose competence falls in the selected period. */
  readonly inSelectedPeriod = computed(() => {
    const range = this.period.range();
    return this.upcoming().filter((transaction) => {
      const competence = installmentCompetence(transaction);
      return (
        transaction.status !== 'CANCELLED' &&
        competence >= range.start &&
        competence <= range.end
      );
    });
  });
  readonly totalInSelectedPeriod = computed(() =>
    sumAmounts(this.inSelectedPeriod().map((transaction) => transaction.amount)),
  );

  private readonly expandedGroupId = signal<string | null>(null);
  private readonly groupResource = resource({
    params: () => this.expandedGroupId() ?? undefined,
    loader: ({ params: groupId }) => this.repository.listGroupInstallments(groupId),
  });

  readonly expanded = this.expandedGroupId.asReadonly();
  readonly groupInstallments = computed<readonly Transaction[]>(() =>
    this.groupResource.hasValue() ? this.groupResource.value() : [],
  );
  readonly groupLoading = this.groupResource.isLoading;

  toggle(groupId: string): void {
    this.expandedGroupId.update((current) => (current === groupId ? null : groupId));
  }

  async create(input: Omit<InstallmentPurchaseInput, 'ownerUserId'>): Promise<void> {
    await this.repository.create({ ...input, ownerUserId: this.requireOwnerId() });
    this.reload();
  }

  async removeGroup(groupId: string): Promise<void> {
    await this.repository.removeGroup(groupId);
    this.expandedGroupId.set(null);
    this.reload();
  }

  reload(): void {
    this.dataResource.reload();
    this.groupResource.reload();
  }

  private requireOwnerId(): string {
    const ownerId = this.context.dataOwnerId();
    if (!ownerId) {
      throw new Error('No authenticated user.');
    }
    return ownerId;
  }
}
