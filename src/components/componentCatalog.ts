import { SORTED_COMPONENT_CATALOG_ITEMS, type CatalogPlacementKind } from '../data/componentCatalog';

export type ComponentCatalogEntry = {
  id: string;
  kind: CatalogPlacementKind;
  label: string;
  aliases: string[];
  tags: string[];
  partNumber?: string;
  shortcutId?: string;
};

export type ComponentCatalogCategory = {
  id: string;
  label: string;
  entries: ComponentCatalogEntry[];
};

const CATEGORY_LABELS: Record<string, string> = {
  passive: 'Passive',
  sources: 'Sources',
  semiconductors: 'Semiconductors',
  ics: 'ICs',
  power: 'Power',
  sensors: 'Sensors',
  specialty: 'Specialty',
  rf: 'RF',
  timing: 'Timing',
  interface: 'Interface'
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

export const COMPONENT_CATALOG: ComponentCatalogCategory[] = Object.entries(
  SORTED_COMPONENT_CATALOG_ITEMS.reduce<Record<string, ComponentCatalogEntry[]>>((grouped, item) => {
    grouped[item.category] ??= [];
    const metadata = ENTRY_METADATA[item.id];
    grouped[item.category].push({
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
).map(([id, entries]) => ({ id, label: CATEGORY_LABELS[id] ?? id, entries }));
