import type { ComponentCatalogTypeId } from '../engine/model';

export type CatalogPlacementKind = ComponentCatalogTypeId | 'subcircuit';

export const COMPONENT_CATEGORY_ORDER = [
  'passive',
  'sources',
  'semiconductors',
  'ics',
  'power',
  'sensors',
  'specialty',
  'rf',
  'timing',
  'interface'
] as const;

export type ComponentCategory = (typeof COMPONENT_CATEGORY_ORDER)[number];

export type ComponentPropertyValueType = 'number' | 'string' | 'boolean' | 'enum';

export type ComponentEditableProperty = {
  type: ComponentPropertyValueType;
  label: string;
  min?: number;
  max?: number;
  unit?: string;
  options?: string[];
};

export type ComponentPinMetadata = {
  id: string;
  label: string;
  index: number;
  role?: 'input' | 'output' | 'bidirectional' | 'power' | 'passive' | 'control';
};

export type ComponentSolverBehavior = {
  model: string;
  propertyMap?: Record<string, string>;
  pinMap?: Record<string, string>;
};

export type ComponentCatalogItem = {
  id: string;
  displayName: string;
  kind: CatalogPlacementKind;
  category: ComponentCategory;
  subcategory: string;
  description: string;
  tags: string[];
  pinCount: number;
  symbolVariant: string;
  pins: ComponentPinMetadata[];
  editablePropertySchema: Record<string, ComponentEditableProperty>;
  solverBehavior: ComponentSolverBehavior;
  defaultProps: Record<string, number | string | boolean>;
  partNumber?: string;
  manufacturer?: string;
  datasheetUrl?: string;
  packageHint?: string;
  footprintHint?: string;
  compatibilityTags?: string[];
};

type LegacyComponentCatalogItem = Omit<
  ComponentCatalogItem,
  'symbolVariant' | 'pins' | 'editablePropertySchema' | 'solverBehavior' | 'compatibilityTags'
> &
  Partial<Pick<ComponentCatalogItem, 'symbolVariant' | 'pins' | 'editablePropertySchema' | 'solverBehavior' | 'compatibilityTags'>>;

const buildDefaultPins = (pinCount: number): ComponentPinMetadata[] =>
  Array.from({ length: pinCount }, (_, index) => ({
    id: `pin-${index + 1}`,
    label: `Pin ${index + 1}`,
    index
  }));

const buildDefaultEditablePropertySchema = (
  defaultProps: Record<string, number | string | boolean>
): Record<string, ComponentEditableProperty> =>
  Object.fromEntries(
    Object.entries(defaultProps).map(([key, value]) => {
      const inferredType = typeof value;
      return [
        key,
        {
          type: inferredType === 'number' || inferredType === 'string' || inferredType === 'boolean' ? inferredType : 'string',
          label: key
        }
      ];
    })
  );

const migrateCatalogItem = (item: LegacyComponentCatalogItem): ComponentCatalogItem => ({
  ...item,
  symbolVariant: item.symbolVariant ?? 'generic',
  pins: item.pins ?? buildDefaultPins(item.pinCount),
  editablePropertySchema: item.editablePropertySchema ?? buildDefaultEditablePropertySchema(item.defaultProps),
  solverBehavior: item.solverBehavior ?? {
    model: item.kind,
    propertyMap: Object.fromEntries(Object.keys(item.defaultProps).map((key) => [key, key]))
  },
  compatibilityTags: item.compatibilityTags ?? [item.kind, item.category]
});

const COMPONENT_CATALOG_ITEMS_LEGACY: LegacyComponentCatalogItem[] = [
  {
    id: 'resistor',
    displayName: 'Resistor',
    kind: 'resistor',
    category: 'passive',
    subcategory: 'generic',
    description: 'Generic two-terminal resistor symbol.',
    tags: ['symbol', 'ohmic', 'generic'],
    pinCount: 2,
    defaultProps: { resistanceOhms: 1000 }
  },
  {
    id: 'capacitor',
    displayName: 'Capacitor',
    kind: 'capacitor',
    category: 'passive',
    subcategory: 'generic',
    description: 'Generic capacitor symbol for charge storage.',
    tags: ['symbol', 'energy-storage', 'generic'],
    pinCount: 2,
    defaultProps: { capacitanceFarads: 0.000001 }
  },
  {
    id: 'inductor',
    displayName: 'Inductor',
    kind: 'inductor',
    category: 'passive',
    subcategory: 'generic',
    description: 'Generic inductor symbol for magnetic energy storage.',
    tags: ['symbol', 'magnetic', 'generic'],
    pinCount: 2,
    defaultProps: { inductanceHenries: 0.001 }
  },
  {
    id: 'voltage-source',
    displayName: 'Voltage Source',
    kind: 'voltage-source',
    category: 'sources',
    subcategory: 'dc',
    description: 'Ideal two-terminal voltage source.',
    tags: ['source', 'dc', 'generic'],
    pinCount: 2,
    defaultProps: { voltageVolts: 5 }
  },
  {
    id: 'current-source',
    displayName: 'Current Source',
    kind: 'current-source',
    category: 'sources',
    subcategory: 'dc',
    description: 'Ideal two-terminal current source.',
    tags: ['source', 'bias', 'generic'],
    pinCount: 2,
    defaultProps: { currentAmps: 0.001 }
  },
  {
    id: 'diode',
    displayName: 'Diode',
    kind: 'diode',
    category: 'semiconductors',
    subcategory: 'rectifier',
    description: 'Generic diode symbol with standard silicon defaults.',
    tags: ['pn-junction', 'generic', 'rectifier'],
    pinCount: 2,
    defaultProps: { forwardDropVolts: 0.7 }
  },
  {
    id: 'bjt',
    displayName: 'BJT',
    kind: 'bjt',
    category: 'semiconductors',
    subcategory: 'transistor',
    description: 'Generic NPN bipolar junction transistor symbol.',
    tags: ['transistor', 'generic', 'bipolar'],
    pinCount: 3,
    defaultProps: { beta: 100 }
  },
  {
    id: 'mosfet',
    displayName: 'MOSFET',
    kind: 'mosfet',
    category: 'semiconductors',
    subcategory: 'transistor',
    description: 'Generic enhancement-mode MOSFET symbol.',
    tags: ['transistor', 'generic', 'switch'],
    pinCount: 3,
    defaultProps: { thresholdVoltageVolts: 2.5 }
  },
  {
    id: 'op-amp',
    displayName: 'Op-Amp',
    kind: 'op-amp',
    category: 'ics',
    subcategory: 'generic',
    description: 'Generic operational amplifier macro model.',
    tags: ['ic', 'analog', 'generic'],
    pinCount: 5,
    defaultProps: { openLoopGain: 100000 }
  },
  {
    id: 'logic-gate',
    displayName: 'Logic Gate',
    kind: 'logic-gate',
    category: 'ics',
    subcategory: 'generic',
    description: 'Generic digital logic gate.',
    tags: ['ic', 'digital', 'generic'],
    pinCount: 3,
    defaultProps: { family: 'CMOS', gateType: 'nand' }
  },
  {
    id: 'ne555',
    displayName: 'Timer IC (NE555)',
    kind: 'op-amp',
    category: 'timing',
    subcategory: 'timer',
    description: 'Classic NE555 timer for astable/monostable pulse generation.',
    tags: ['ic', 'timer', 'pulse-generator'],
    pinCount: 8,
    defaultProps: { mode: 'astable', frequencyHz: 1000 },
    partNumber: 'NE555',
    manufacturer: 'Texas Instruments',
    datasheetUrl: 'https://example.com/datasheets/ne555.pdf'
  },
  {
    id: 'lm358',
    displayName: 'Dual Op-Amp (LM358)',
    kind: 'op-amp',
    category: 'ics',
    subcategory: 'precision-analog',
    description: 'Dual operational amplifier suitable for single-supply designs.',
    tags: ['ic', 'analog', 'amplifier'],
    pinCount: 8,
    defaultProps: { openLoopGain: 100000, channels: 2 },
    partNumber: 'LM358',
    manufacturer: 'STMicroelectronics',
    datasheetUrl: 'https://example.com/datasheets/lm358.pdf'
  },
  {
    id: '74hc00',
    displayName: 'Quad NAND (74HC00)',
    kind: 'logic-gate',
    category: 'interface',
    subcategory: 'logic-family',
    description: 'Quad 2-input NAND gate in HC CMOS family.',
    tags: ['ic', 'digital', 'nand'],
    pinCount: 14,
    defaultProps: { family: 'HC', gates: 4 },
    partNumber: '74HC00',
    manufacturer: 'Nexperia',
    datasheetUrl: 'https://example.com/datasheets/74hc00.pdf'
  },
  {
    id: 'ad9833',
    displayName: 'DDS Signal Generator (AD9833)',
    kind: 'logic-gate',
    category: 'rf',
    subcategory: 'signal-synthesis',
    description: 'Direct digital synthesis IC for low-power waveform generation.',
    tags: ['rf', 'dds', 'niche'],
    pinCount: 10,
    defaultProps: { maxFrequencyHz: 12500000 },
    partNumber: 'AD9833',
    manufacturer: 'Analog Devices',
    datasheetUrl: 'https://example.com/datasheets/ad9833.pdf'
  },
  {
    id: 'subcircuit',
    displayName: 'Subcircuit',
    kind: 'subcircuit',
    category: 'specialty',
    subcategory: 'hierarchy',
    description: 'Reusable grouped macro that encapsulates a section of a circuit.',
    tags: ['hierarchy', 'macro', 'module'],
    pinCount: 0,
    defaultProps: { collapsed: true }
  }
];

export const COMPONENT_CATALOG_ITEMS: ComponentCatalogItem[] = COMPONENT_CATALOG_ITEMS_LEGACY.map(migrateCatalogItem);

export const componentCatalogSort = (left: ComponentCatalogItem, right: ComponentCatalogItem): number => {
  const categoryOrder = COMPONENT_CATEGORY_ORDER.indexOf(left.category) - COMPONENT_CATEGORY_ORDER.indexOf(right.category);
  if (categoryOrder !== 0) {
    return categoryOrder;
  }

  const subcategoryOrder = left.subcategory.localeCompare(right.subcategory);
  if (subcategoryOrder !== 0) {
    return subcategoryOrder;
  }

  const partSpecificity = Number(Boolean(left.partNumber)) - Number(Boolean(right.partNumber));
  if (partSpecificity !== 0) {
    return partSpecificity;
  }

  return left.displayName.localeCompare(right.displayName);
};

export const validateComponentCatalog = (
  items: ComponentCatalogItem[],
  validCategories: readonly ComponentCategory[] = COMPONENT_CATEGORY_ORDER
): void => {
  const ids = new Set<string>();
  const errors: string[] = [];

  for (const item of items) {
    if (ids.has(item.id)) {
      errors.push(`Duplicate component catalog id: ${item.id}`);
    }
    ids.add(item.id);

    if (!validCategories.includes(item.category)) {
      errors.push(`Invalid category "${item.category}" on item "${item.id}"`);
    }

    const isHighVolume = Boolean(item.partNumber);
    if (isHighVolume) {
      if (!item.symbolVariant.trim()) {
        errors.push(`High-volume item "${item.id}" is missing symbolVariant`);
      }
      if (!item.solverBehavior.model.trim()) {
        errors.push(`High-volume item "${item.id}" is missing solverBehavior.model`);
      }
      if (item.pins.length === 0) {
        errors.push(`High-volume item "${item.id}" requires explicit pin metadata`);
      }
      if (Object.keys(item.editablePropertySchema).length === 0) {
        errors.push(`High-volume item "${item.id}" requires editablePropertySchema`);
      }
    }

    if (item.pins.length !== item.pinCount) {
      errors.push(`Pin metadata count mismatch on item "${item.id}": expected ${item.pinCount}, got ${item.pins.length}`);
    }

    for (const [propertyName, schema] of Object.entries(item.editablePropertySchema)) {
      if (!schema || typeof schema !== 'object') {
        errors.push(`Malformed property schema for "${propertyName}" on item "${item.id}"`);
        continue;
      }

      if (!schema.label || typeof schema.label !== 'string') {
        errors.push(`Property schema "${propertyName}" on item "${item.id}" must include a string label`);
      }

      const validType = schema.type === 'number' || schema.type === 'string' || schema.type === 'boolean' || schema.type === 'enum';
      if (!validType) {
        errors.push(`Property schema "${propertyName}" on item "${item.id}" has invalid type`);
      }

      if (schema.type === 'enum' && (!Array.isArray(schema.options) || schema.options.length === 0)) {
        errors.push(`Enum schema "${propertyName}" on item "${item.id}" must define options`);
      }

      if (schema.type !== 'enum' && schema.options !== undefined) {
        errors.push(`Property schema "${propertyName}" on item "${item.id}" can only define options for enum type`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Component catalog validation failed:\n${errors.join('\n')}`);
  }
};

validateComponentCatalog(COMPONENT_CATALOG_ITEMS);

export const SORTED_COMPONENT_CATALOG_ITEMS = [...COMPONENT_CATALOG_ITEMS].sort(componentCatalogSort);
