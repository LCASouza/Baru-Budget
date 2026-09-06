import { HouseholdMemberStatus, HouseholdRole } from '../../core/finance/household-role';
import { Tables } from '../../core/supabase/database.types';

export type Household = Tables<'households'>;

export interface HouseholdMember {
  readonly userId: string;
  readonly displayName: string;
  readonly role: HouseholdRole;
  readonly status: HouseholdMemberStatus;
  readonly joinedAt: string;
}

export interface HouseholdWithMembers extends Household {
  readonly members: readonly HouseholdMember[];
}

export function activeMembers(household: HouseholdWithMembers): HouseholdMember[] {
  return household.members.filter((member) => member.status === 'ACTIVE');
}

export function roleOf(household: HouseholdWithMembers, userId: string): HouseholdRole | null {
  return activeMembers(household).find((member) => member.userId === userId)?.role ?? null;
}

export function activeAdminCount(household: HouseholdWithMembers): number {
  return activeMembers(household).filter((member) => member.role === 'ADMIN').length;
}
