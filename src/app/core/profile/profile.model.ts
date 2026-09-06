import { Tables } from '../supabase/database.types';

export type Profile = Tables<'profiles'>;

export function profileInitials(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  const letters = words.length === 1 ? [words[0][0]] : [words[0][0], words[words.length - 1][0]];
  return letters.join('').toUpperCase();
}
