import { Injectable, inject } from '@angular/core';
import { HouseholdRole } from '../../core/finance/household-role';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { Household, HouseholdWithMembers } from './household.model';

interface HouseholdRow extends Household {
  members: {
    user_id: string;
    role: HouseholdRole;
    status: 'ACTIVE' | 'INACTIVE';
    joined_at: string;
    profile: { display_name: string } | null;
  }[];
}

const HOUSEHOLD_SELECT =
  '*, members:household_members(user_id, role, status, joined_at, profile:profiles!household_members_user_id_fkey(display_name))';

@Injectable({ providedIn: 'root' })
export class HouseholdRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async listMine(): Promise<HouseholdWithMembers[]> {
    const { data, error } = await this.client
      .from('households')
      .select(HOUSEHOLD_SELECT)
      .order('name')
      .overrideTypes<HouseholdRow[], { merge: false }>();
    if (error) {
      throw toDataError(error, 'Failed to load households');
    }
    return data.map(toHousehold);
  }

  async create(name: string): Promise<Household> {
    const { data, error } = await this.client
      .from('households')
      .insert({ name })
      .select('*')
      .single();
    if (error) {
      throw toDataError(error, 'Failed to create household');
    }
    return data;
  }

  async rename(id: string, name: string): Promise<void> {
    const { error } = await this.client.from('households').update({ name }).eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to rename household');
    }
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from('households').delete().eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to delete household');
    }
  }

  // Re-adding a former member reactivates the existing membership row.
  async addMember(householdId: string, userId: string, role: HouseholdRole): Promise<void> {
    const { error } = await this.client
      .from('household_members')
      .upsert(
        { household_id: householdId, user_id: userId, role, status: 'ACTIVE', joined_at: new Date().toISOString() },
        { onConflict: 'household_id,user_id' },
      );
    if (error) {
      throw toDataError(error, 'Failed to add member');
    }
  }

  async setMemberRole(householdId: string, userId: string, role: HouseholdRole): Promise<void> {
    const { error } = await this.client
      .from('household_members')
      .update({ role })
      .eq('household_id', householdId)
      .eq('user_id', userId);
    if (error) {
      throw toDataError(error, 'Failed to change member role');
    }
  }

  async removeMember(householdId: string, userId: string): Promise<void> {
    const { error } = await this.client
      .from('household_members')
      .update({ status: 'INACTIVE' })
      .eq('household_id', householdId)
      .eq('user_id', userId);
    if (error) {
      throw toDataError(error, 'Failed to remove member');
    }
  }

  async leave(householdId: string): Promise<void> {
    const { error } = await this.client.rpc('leave_household', { household: householdId });
    if (error) {
      throw toDataError(error, 'Failed to leave household');
    }
  }
}

function toHousehold(row: HouseholdRow): HouseholdWithMembers {
  const { members, ...household } = row;
  return {
    ...household,
    members: members
      .map((member) => ({
        userId: member.user_id,
        displayName: member.profile?.display_name ?? 'Usuário',
        role: member.role,
        status: member.status,
        joinedAt: member.joined_at,
      }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR')),
  };
}
