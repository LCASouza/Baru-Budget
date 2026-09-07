import { Catalog, normalizeName } from './import-plan';
import { CatalogName, DatabaseRow } from './workbook-schema';

/** A catalog that also knows how to write a name back, used by the export. */
export interface NamedCatalog extends Catalog {
  readonly names: ReadonlyMap<string, string>;
}

export type NamedCatalogs = Readonly<Record<CatalogName, NamedCatalog>>;

export function buildCatalog(rows: readonly DatabaseRow[], nameField: string): NamedCatalog {
  const ids = new Set<string>();
  const names = new Map<string, string>();
  const byName = new Map<string, string[]>();

  for (const row of rows) {
    const id = String(row['id'] ?? '');
    if (!id) {
      continue;
    }
    const name = String(row[nameField] ?? '').trim();
    ids.add(id);
    names.set(id, name);
    const key = normalizeName(name);
    if (!key) {
      continue;
    }
    const existing = byName.get(key);
    if (existing) {
      existing.push(id);
    } else {
      byName.set(key, [id]);
    }
  }

  return { ids, names, byName };
}

export interface CatalogSources {
  readonly accounts: readonly DatabaseRow[];
  readonly categories: readonly DatabaseRow[];
  readonly cards: readonly DatabaseRow[];
  readonly households: readonly DatabaseRow[];
  readonly people: readonly DatabaseRow[];
}

export function buildCatalogs(sources: CatalogSources): NamedCatalogs {
  return {
    accounts: buildCatalog(sources.accounts, 'name'),
    categories: buildCatalog(sources.categories, 'name'),
    cards: buildCatalog(sources.cards, 'name'),
    households: buildCatalog(sources.households, 'name'),
    people: buildCatalog(sources.people, 'display_name'),
  };
}

export const EMPTY_CATALOG: NamedCatalog = {
  ids: new Set<string>(),
  names: new Map<string, string>(),
  byName: new Map<string, readonly string[]>(),
};
