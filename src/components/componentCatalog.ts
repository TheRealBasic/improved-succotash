import {
  SIDEBAR_GROUPING,
  SORTED_COMPONENT_CATALOG_ITEMS,
  type CatalogPlacementKind,
  type ComponentCatalogItem
} from '../data/componentCatalog';

export type ComponentCatalogEntry = {
  id: string;
  kind: CatalogPlacementKind;
  label: string;
  aliases: string[];
  tags: string[];
  categoryId: string;
  subcategoryId: string;
  pinCount: number;
  manufacturer?: string;
  fullySimulated: boolean;
  supportLevel: 'full' | 'partial' | 'visual-only';
  supportNotes?: string;
  isNew: boolean;
  partNumber?: string;
  shortcutId?: string;
  searchTokens: string[];
};

export type ComponentCatalogSubcategory = {
  id: string;
  label: string;
  entries: ComponentCatalogEntry[];
};

export type ComponentCatalogCategory = {
  id: string;
  label: string;
  subcategories: ComponentCatalogSubcategory[];
};

const resolveLegacySidebarPath = (item: ComponentCatalogItem): { categoryId: string; subcategoryId: string } => {
  if (item.tags.includes('timer')) {
    return { categoryId: 'ics', subcategoryId: 'timers' };
  }

  if (item.category === 'ics' && (item.tags.includes('analog') || item.kind === 'op-amp')) {
    return { categoryId: 'ics', subcategoryId: 'op-amps' };
  }

  if (item.tags.includes('digital') || item.id === '74hc00' || item.id === 'logic-gate') {
    return { categoryId: 'ics', subcategoryId: 'logic-74xx-hc-hct' };
  }

  if (item.category === 'timing' || item.category === 'interface') {
    return { categoryId: 'ics', subcategoryId: item.category === 'timing' ? 'timers' : 'logic-74xx-hc-hct' };
  }

  if (item.category === 'rf') {
    return { categoryId: 'specialty', subcategoryId: 'rf' };
  }

  if (item.category === 'specialty') {
    return { categoryId: 'specialty', subcategoryId: 'power-management' };
  }

  return { categoryId: item.category, subcategoryId: item.subcategory || 'other' };
};

const resolveSidebarPath = (item: ComponentCatalogItem): { categoryId: string; subcategoryId: string } => {
  if (item.sidebar) {
    return {
      categoryId: item.sidebar.category,
      subcategoryId: item.sidebar.subcategory
    };
  }

  return resolveLegacySidebarPath(item);
};


type SidebarGroupingMap = Record<string, { label: string; order: number; subcategories: Record<string, { label: string; order: number }> }>;

const SIDEBAR_GROUPING_MAP = SIDEBAR_GROUPING as SidebarGroupingMap;

const categoryOrder = (id: string): number => SIDEBAR_GROUPING_MAP[id]?.order ?? Number.MAX_SAFE_INTEGER;

const subcategoryOrder = (categoryId: string, subcategoryId: string): number =>
  SIDEBAR_GROUPING_MAP[categoryId]?.subcategories[subcategoryId]?.order ?? Number.MAX_SAFE_INTEGER;

const categoryLabel = (id: string): string => SIDEBAR_GROUPING_MAP[id]?.label ?? id;

const subcategoryLabel = (categoryId: string, subcategoryId: string): string =>
  SIDEBAR_GROUPING_MAP[categoryId]?.subcategories[subcategoryId]?.label ?? subcategoryId;

const normalizeSearchToken = (value: string): string => value.trim().toLowerCase();

const indexedSearchTokens = (item: ComponentCatalogItem, aliases: string[]): string[] =>
  Array.from(
    new Set(
      [item.id, item.displayName, ...aliases, ...item.tags, item.partNumber ?? '']
        .map(normalizeSearchToken)
        .filter(Boolean)
    )
  );

export const buildComponentCatalog = (items: ComponentCatalogItem[]): ComponentCatalogCategory[] =>
  Object.entries(
    items.reduce<Record<string, Record<string, ComponentCatalogEntry[]>>>((grouped, item) => {
      const aliases = item.metadata?.aliases ?? [item.partNumber ?? item.displayName];
      const sidebarPath = resolveSidebarPath(item);
      grouped[sidebarPath.categoryId] ??= {};
      grouped[sidebarPath.categoryId][sidebarPath.subcategoryId] ??= [];
      grouped[sidebarPath.categoryId][sidebarPath.subcategoryId].push({
        id: item.id,
        kind: item.kind,
        label: item.displayName,
        aliases,
        tags: item.tags,
        categoryId: sidebarPath.categoryId,
        subcategoryId: `${sidebarPath.categoryId}::${sidebarPath.subcategoryId}`,
        pinCount: item.pinCount,
        manufacturer: item.manufacturer,
        fullySimulated: item.tags.includes('fully-simulated') || (item.support?.level ?? 'partial') === 'full',
        supportLevel: item.support?.level ?? (item.tags.includes('fully-simulated') ? 'full' : 'partial'),
        supportNotes: item.support?.notes,
        isNew: item.tags.includes('new'),
        partNumber: item.partNumber,
        shortcutId: item.metadata?.shortcut ? item.metadata.shortcut.id ?? `place-${item.id}` : undefined,
        searchTokens: indexedSearchTokens(item, aliases)
      });
      return grouped;
    }, {})
  )
    .sort(([left], [right]) => categoryOrder(left) - categoryOrder(right) || left.localeCompare(right))
    .map(([id, subcategoryMap]) => ({
      id,
      label: categoryLabel(id),
      subcategories: Object.entries(subcategoryMap)
        .sort(
          ([left], [right]) =>
            subcategoryOrder(id, left) - subcategoryOrder(id, right) ||
            subcategoryLabel(id, left).localeCompare(subcategoryLabel(id, right))
        )
        .map(([subcategoryId, entries]) => ({
          id: `${id}::${subcategoryId}`,
          label: subcategoryLabel(id, subcategoryId),
          entries
        }))
    }));

export const COMPONENT_CATALOG: ComponentCatalogCategory[] = buildComponentCatalog(SORTED_COMPONENT_CATALOG_ITEMS);
