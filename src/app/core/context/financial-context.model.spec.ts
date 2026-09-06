import {
  PERSONAL_CONTEXT,
  buildContextOptions,
  contextIcon,
  contextKey,
  contextLabel,
  resolveContext,
} from './financial-context.model';

const households = [
  { id: 'h1', name: 'Família', role: 'ADMIN' as const, members: [] },
  { id: 'h2', name: 'República', role: 'MEMBER' as const, members: [] },
];
const grants = [
  { ownerId: 'u9', ownerName: 'Pai', permission: 'VIEW' as const },
  { ownerId: 'u8', ownerName: 'Esposa', permission: 'MANAGE' as const },
];

describe('financial-context.model', () => {
  it('builds the options with the personal context first, then households, then shared finances', () => {
    const options = buildContextOptions(households, grants);
    expect(options.map(contextKey)).toEqual([
      'personal',
      'household:h1',
      'household:h2',
      'shared:u9',
      'shared:u8',
    ]);
    expect(options.map(contextLabel)).toEqual([
      'Minhas finanças',
      'Família',
      'República',
      'Finanças de Pai',
      'Finanças de Esposa',
    ]);
    expect(options.map(contextIcon)).toEqual(['person', 'groups', 'groups', 'share', 'share']);
  });

  it('resolves a persisted key and falls back to the personal context', () => {
    const options = buildContextOptions(households, grants);
    expect(resolveContext(options, 'shared:u8')).toMatchObject({ kind: 'shared', permission: 'MANAGE' });
    expect(resolveContext(options, 'household:h2')).toMatchObject({ kind: 'household', role: 'MEMBER' });
    expect(resolveContext(options, 'household:gone')).toBe(PERSONAL_CONTEXT);
    expect(resolveContext(options, null)).toBe(PERSONAL_CONTEXT);
    expect(resolveContext([PERSONAL_CONTEXT], 'shared:u9')).toBe(PERSONAL_CONTEXT);
  });
});
