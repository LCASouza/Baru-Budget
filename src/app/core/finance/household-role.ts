import { Database } from '../supabase/database.types';

export type HouseholdRole = Database['public']['Enums']['household_role'];
export type HouseholdMemberStatus = Database['public']['Enums']['household_member_status'];

export const HOUSEHOLD_ROLES: readonly HouseholdRole[] = ['ADMIN', 'MEMBER'];

export const HOUSEHOLD_ROLE_LABELS: Readonly<Record<HouseholdRole, string>> = {
  ADMIN: 'Administrador',
  MEMBER: 'Membro',
};
