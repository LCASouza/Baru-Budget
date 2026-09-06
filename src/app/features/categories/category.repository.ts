import { Injectable, inject } from '@angular/core';
import { toDataError } from '../../core/supabase/data-error';
import { SUPABASE_CLIENT } from '../../core/supabase/supabase-client';
import { Category, CategoryInput } from './category.model';

@Injectable({ providedIn: 'root' })
export class CategoryRepository {
  private readonly client = inject(SUPABASE_CLIENT);

  async listAll(): Promise<Category[]> {
    const { data, error } = await this.client
      .from('categories')
      .select('*')
      .order('kind')
      .order('name');
    if (error) {
      throw toDataError(error, 'Failed to load categories');
    }
    return data;
  }

  async create(ownerUserId: string, input: CategoryInput): Promise<Category> {
    const { data, error } = await this.client
      .from('categories')
      .insert({ owner_user_id: ownerUserId, kind: input.kind, name: input.name })
      .select('*')
      .single();
    if (error) {
      throw toDataError(error, 'Failed to create category');
    }
    return data;
  }

  async rename(id: string, name: string): Promise<void> {
    const { error } = await this.client.from('categories').update({ name }).eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to update category');
    }
  }

  async setActive(id: string, active: boolean): Promise<void> {
    const { error } = await this.client.from('categories').update({ active }).eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to update category');
    }
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from('categories').delete().eq('id', id);
    if (error) {
      throw toDataError(error, 'Failed to delete category');
    }
  }
}
