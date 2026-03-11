import {
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

const CATEGORY_LABELS: Record<string, string> = {
  passive: 'Passive',
  sources: 'Sources',
  semiconductors: 'Semiconductors',
  ics: 'ICs',
  relays: 'Relays',
  power: 'Power',
  sensors: 'Sensors',
  specialty: 'Specialty'
};

const SUBCATEGORY_LABELS: Record<string, string> = {
  generic: 'Generic',
  dc: 'DC',
  rectifier: 'Rectifier',
  transistor: 'Transistors',
  'op-amps': 'Op-Amps',
  timers: 'Timers',
  'logic-74xx-hc-hct': 'Logic (74xx/HC/HCT)',
  'mcu-basics': 'MCU basics',
  spst_spdt: 'SPST/SPDT',
  reed: 'Reed',
  'solid-state': 'Solid-state',
  rf: 'RF',
  audio: 'Audio',
  'power-management': 'Power-management',
  hierarchy: 'Hierarchy',
  other: 'Other'
};

const CATEGORY_ORDER = ['passive', 'sources', 'semiconductors', 'ics', 'relays', 'power', 'sensors', 'specialty'] as const;

const resolveSidebarPath = (item: ComponentCatalogItem): { categoryId: string; subcategoryId: string } => {
  if (item.tags.includes('timer')) {
    return { categoryId: 'ics', subcategoryId: 'timers' };
  }

  if (item.category === 'ics' && (item.tags.includes('analog') || item.kind === 'opAmp')) {
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

const orderForCategory = (id: string): number => {
  const index = CATEGORY_ORDER.indexOf(id as (typeof CATEGORY_ORDER)[number]);
  return index === -1 ? CATEGORY_ORDER.length : index;
};

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
  .sort(([left], [right]) => orderForCategory(left) - orderForCategory(right))
  .map(([id, subcategoryMap]) => ({
    id,
    label: CATEGORY_LABELS[id] ?? id,
    subcategories: Object.entries(subcategoryMap)
      .sort(([left], [right]) => (SUBCATEGORY_LABELS[left] ?? left).localeCompare(SUBCATEGORY_LABELS[right] ?? right))
      .map(([subcategoryId, entries]) => ({
        id: `${id}::${subcategoryId}`,
        label: SUBCATEGORY_LABELS[subcategoryId] ?? subcategoryId,
        entries
      }))
  }));
