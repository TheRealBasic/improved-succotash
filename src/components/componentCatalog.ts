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
  partNumber?: string;
  shortcutId?: string;
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

const ENTRY_METADATA: Record<string, { aliases: string[]; shortcutId?: string }> = {
  resistor: { aliases: ['R'], shortcutId: 'place-resistor' },
  capacitor: { aliases: ['C'], shortcutId: 'place-capacitor' },
  inductor: { aliases: ['L', 'Coil'], shortcutId: 'place-inductor' },
  'voltage-source': { aliases: ['VSource', 'Supply'], shortcutId: 'place-voltage' },
  'current-source': { aliases: ['ISource'], shortcutId: 'place-current' },
  diode: { aliases: ['Rectifier'], shortcutId: 'place-diode' },
  bjt: { aliases: ['Transistor'], shortcutId: 'place-bjt' },
  mosfet: { aliases: ['FET'], shortcutId: 'place-mosfet' },
  'op-amp': { aliases: ['Operational Amplifier'], shortcutId: 'place-opamp' },
  'logic-gate': { aliases: ['Gate'], shortcutId: 'place-logic' },
  subcircuit: { aliases: ['Macro'], shortcutId: 'place-subcircuit' }
};

type SidebarGroupingMap = Record<string, { label: string; order: number; subcategories: Record<string, { label: string; order: number }> }>;

const SIDEBAR_GROUPING_MAP = SIDEBAR_GROUPING as SidebarGroupingMap;

const categoryOrder = (id: string): number => SIDEBAR_GROUPING_MAP[id]?.order ?? Number.MAX_SAFE_INTEGER;

const subcategoryOrder = (categoryId: string, subcategoryId: string): number =>
  SIDEBAR_GROUPING_MAP[categoryId]?.subcategories[subcategoryId]?.order ?? Number.MAX_SAFE_INTEGER;

const categoryLabel = (id: string): string => SIDEBAR_GROUPING_MAP[id]?.label ?? id;

const subcategoryLabel = (categoryId: string, subcategoryId: string): string =>
  SIDEBAR_GROUPING_MAP[categoryId]?.subcategories[subcategoryId]?.label ?? subcategoryId;

export const COMPONENT_CATALOG: ComponentCatalogCategory[] = Object.entries(
  SORTED_COMPONENT_CATALOG_ITEMS.reduce<Record<string, Record<string, ComponentCatalogEntry[]>>>((grouped, item) => {
    const sidebarPath = resolveSidebarPath(item);
    grouped[sidebarPath.categoryId] ??= {};
    grouped[sidebarPath.categoryId][sidebarPath.subcategoryId] ??= [];
    const metadata = ENTRY_METADATA[item.id];
    grouped[sidebarPath.categoryId][sidebarPath.subcategoryId].push({
      id: item.id,
      kind: item.kind,
      label: item.displayName,
      aliases: metadata?.aliases ?? [item.partNumber ?? item.displayName],
      tags: item.tags,
      partNumber: item.partNumber,
      shortcutId: metadata?.shortcutId
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
