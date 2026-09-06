import { Injectable, inject } from '@angular/core';
import { AccessPermission } from '../../core/finance/access-permission';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { GivenGrant, ReceivedGrantView } from './grant.model';

interface GivenRow {
  id: string;
  granted_user_id: string;
  permission: AccessPermission;
  created_at: string;
  grantee: { display_name: string } | null;
}

interface ReceivedRow {
  id: string;
  owner_user_id: string;
  permission: AccessPermission;
  created_at: string;
  owner: { display_name: string } | null;
}

@Injectable({ providedIn: 'root' })
export class GrantRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async listGiven(ownerId: string): Promise<GivenGrant[]> {
    const { data, error } = await this.client
      .from('financial_access_grants')
      .select(
        'id, granted_user_id, permission, created_at, grantee:profiles!financial_access_grants_granted_user_id_fkey(display_name)',
      )
      .eq('owner_user_id', ownerId)
      .is('revoked_at', null)
      .order('created_at')
      .overrideTypes<GivenRow[], { merge: false }>();
    if (error) {
      throw toDataError(error, 'Failed to load given grants');
    }
    return data.map((row) => ({
      id: row.id,
      grantedUserId: row.granted_user_id,
      grantedUserName: row.grantee?.display_name ?? 'Usuário',
      permission: row.permission,
      createdAt: row.created_at,
    }));
  }

  async listReceived(userId: string): Promise<ReceivedGrantView[]> {
    const { data, error } = await this.client
      .from('financial_access_grants')
      .select(
        'id, owner_user_id, permission, created_at, owner:profiles!financial_access_grants_owner_user_id_fkey(display_name)',
      )
      .eq('granted_user_id', userId)
      .is('revoked_at', null)
      .order('created_at')
      .overrideTypes<ReceivedRow[], { merge: false }>();
    if (error) {
      throw toDataError(error, 'Failed to load received grants');
    }
    return data.map((row) => ({
      id: row.id,
      ownerId: row.owner_user_id,
      ownerName: row.owner?.display_name ?? 'Usuário',
      permission: row.permission,
      createdAt: row.created_at,
    }));
  }

  async create(ownerId: string, grantedUserId: string, permission: AccessPermission): Promise<void> {
    const { error } = await this.client
      .from('financial_access_grants')
      .insert({ owner_user_id: ownerId, granted_user_id: grantedUserId, permission });
    if (error) {
      throw toDataError(error, 'Failed to create grant');
    }
  }

  async setPermission(id: string, permission: AccessPermission): Promise<void> {
    const { error } = await this.client
      .from('financial_access_grants')
      .update({ permission })
      .eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to change grant permission');
    }
  }

  // Revocation keeps the row for history; only active grants give access.
  async revoke(id: string): Promise<void> {
    const { error } = await this.client
      .from('financial_access_grants')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to revoke grant');
    }
  }
}
