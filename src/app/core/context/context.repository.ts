import { Injectable, inject } from '@angular/core';
import { toDataError } from '../supabase/data-error';
import { SUPABASE_CLIENT } from '../supabase/supabase-client';
import { HouseholdSummary, ReceivedGrant } from './financial-context.model';

interface MembershipRow {
  role: HouseholdSummary['role'];
  household: {
    id: string;
    name: string;
    members: {
      user_id: string;
      status: string;
      profile: { display_name: string } | null;
    }[];
  } | null;
}

interface ReceivedGrantRow {
  owner_user_id: string;
  permission: ReceivedGrant['permission'];
  owner: { display_name: string } | null;
}

@Injectable({ providedIn: 'root' })
export class ContextRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async listMyHouseholds(userId: string): Promise<HouseholdSummary[]> {
    const { data, error } = await this.client
      .from('household_members')
      .select(
        'role, household:households(id, name, members:household_members(user_id, status, profile:profiles!household_members_user_id_fkey(display_name)))',
      )
      .eq('user_id', userId)
      .eq('status', 'ACTIVE')
      .overrideTypes<MembershipRow[], { merge: false }>();
    if (error) {
      throw toDataError(error, 'Failed to load households');
    }
    return data
      .filter((row) => row.household !== null)
      .map((row) => {
        const household = row.household as NonNullable<MembershipRow['household']>;
        return {
          id: household.id,
          name: household.name,
          role: row.role,
          members: household.members
            .filter((member) => member.status === 'ACTIVE')
            .map((member) => ({
              userId: member.user_id,
              displayName: member.profile?.display_name ?? 'Usuário',
            })),
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async listReceivedGrants(userId: string): Promise<ReceivedGrant[]> {
    const { data, error } = await this.client
      .from('financial_access_grants')
      .select(
        'owner_user_id, permission, owner:profiles!financial_access_grants_owner_user_id_fkey(display_name)',
      )
      .eq('granted_user_id', userId)
      .is('revoked_at', null)
      .overrideTypes<ReceivedGrantRow[], { merge: false }>();
    if (error) {
      throw toDataError(error, 'Failed to load received grants');
    }
    return data
      .map((row) => ({
        ownerId: row.owner_user_id,
        ownerName: row.owner?.display_name ?? 'Usuário',
        permission: row.permission,
      }))
      .sort((a, b) => a.ownerName.localeCompare(b.ownerName, 'pt-BR'));
  }
}
