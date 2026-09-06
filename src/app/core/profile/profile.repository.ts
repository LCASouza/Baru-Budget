import { Injectable, inject } from '@angular/core';
import { toDataError } from '../supabase/data-error';
import { SUPABASE_CLIENT } from '../supabase/supabase-client';
import { Profile } from './profile.model';

export interface UserLookup {
  readonly id: string;
  readonly displayName: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async findById(id: string): Promise<Profile | null> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(`Failed to load profile: ${error.message}`);
    }
    return data;
  }

  async findManyByIds(ids: readonly string[]): Promise<Profile[]> {
    if (ids.length === 0) {
      return [];
    }
    const { data, error } = await this.client.from('profiles').select('*').in('id', [...ids]);
    if (error) {
      throw new Error(`Failed to load profiles: ${error.message}`);
    }
    return data;
  }

  async lookupByEmail(email: string): Promise<UserLookup | null> {
    const { data, error } = await this.client.rpc('lookup_user_by_email', {
      email_address: email,
    });
    if (error) {
      throw toDataError(error, 'Failed to look up user');
    }
    const match = data[0];
    return match ? { id: match.id, displayName: match.display_name } : null;
  }

  async updateDisplayName(id: string, displayName: string): Promise<void> {
    const { error } = await this.client
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to update profile');
    }
  }
}
