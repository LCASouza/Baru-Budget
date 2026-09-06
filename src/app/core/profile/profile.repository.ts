import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT } from '../supabase/supabase-client';
import { Profile } from './profile.model';

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
}
