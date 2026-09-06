import { AccessPermission } from '../finance/access-permission';
import { HouseholdRole } from '../finance/household-role';

export interface HouseholdMemberSummary {
  readonly userId: string;
  readonly displayName: string;
}

export interface HouseholdSummary {
  readonly id: string;
  readonly name: string;
  readonly role: HouseholdRole;
  readonly members: readonly HouseholdMemberSummary[];
}

export interface ReceivedGrant {
  readonly ownerId: string;
  readonly ownerName: string;
  readonly permission: AccessPermission;
}

export type FinancialContext =
  | { readonly kind: 'personal' }
  | {
      readonly kind: 'shared';
      readonly ownerId: string;
      readonly ownerName: string;
      readonly permission: AccessPermission;
    }
  | {
      readonly kind: 'household';
      readonly householdId: string;
      readonly name: string;
      readonly role: HouseholdRole;
    };

export const PERSONAL_CONTEXT: FinancialContext = { kind: 'personal' };

export function contextKey(context: FinancialContext): string {
  switch (context.kind) {
    case 'personal':
      return 'personal';
    case 'shared':
      return `shared:${context.ownerId}`;
    case 'household':
      return `household:${context.householdId}`;
  }
}

export function contextLabel(context: FinancialContext): string {
  switch (context.kind) {
    case 'personal':
      return 'Minhas finanças';
    case 'shared':
      return `Finanças de ${context.ownerName}`;
    case 'household':
      return context.name;
  }
}

export function contextIcon(context: FinancialContext): string {
  switch (context.kind) {
    case 'personal':
      return 'person';
    case 'shared':
      return 'share';
    case 'household':
      return 'groups';
  }
}

export function buildContextOptions(
  households: readonly HouseholdSummary[],
  grants: readonly ReceivedGrant[],
): FinancialContext[] {
  return [
    PERSONAL_CONTEXT,
    ...households.map(
      (household): FinancialContext => ({
        kind: 'household',
        householdId: household.id,
        name: household.name,
        role: household.role,
      }),
    ),
    ...grants.map(
      (grant): FinancialContext => ({
        kind: 'shared',
        ownerId: grant.ownerId,
        ownerName: grant.ownerName,
        permission: grant.permission,
      }),
    ),
  ];
}

// Falls back to the personal context when the persisted option no longer exists
// (household removed, grant revoked).
export function resolveContext(
  options: readonly FinancialContext[],
  key: string | null,
): FinancialContext {
  return options.find((option) => contextKey(option) === key) ?? PERSONAL_CONTEXT;
}
