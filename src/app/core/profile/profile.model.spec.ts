import { profileInitials } from './profile.model';

describe('profileInitials', () => {
  it('uses the first letters of the first and last words', () => {
    expect(profileInitials('Lucas Souza')).toBe('LS');
    expect(profileInitials('Ana Maria de Castro')).toBe('AC');
  });

  it('uses a single letter for single-word names', () => {
    expect(profileInitials('lucas')).toBe('L');
  });

  it('falls back to a placeholder for empty names', () => {
    expect(profileInitials('   ')).toBe('?');
  });
});
