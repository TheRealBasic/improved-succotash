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

export type ComponentSupportLevel = 'full' | 'partial' | 'visual-only';

export type ComponentSupportMetadata = {
  level: ComponentSupportLevel;
  notes?: string;
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
  support: ComponentSupportMetadata;
  defaultProps: Record<string, number | string | boolean>;
  partNumber?: string;
  manufacturer?: string;
  datasheetUrl?: string;
  packageHint?: string;
  footprintHint?: string;
  compatibilityTags?: string[];
  metadata?: {
    aliases?: string[];
    shortcut?: {
      key: string;
      id?: string;
    };
  };
  sidebar?: {
    category: string;
    subcategory: string;
  };
};

export const SIDEBAR_GROUPING = {
  passive: {
    label: 'Passive',
    order: 0,
    subcategories: {
      generic: { label: 'Generic', order: 0 },
      resistive: { label: 'Resistive', order: 1 },
      capacitive: { label: 'Capacitive', order: 2 },
      magnetic: { label: 'Magnetic', order: 3 }
    }
  },
  sources: {
    label: 'Sources',
    order: 1,
    subcategories: {
      dc: { label: 'DC', order: 0 },
      ac: { label: 'AC', order: 1 },
      pulse: { label: 'Pulse', order: 2 },
      reference: { label: 'Reference', order: 3 },
      battery: { label: 'Battery', order: 4 }
    }
  },
  semiconductors: {
    label: 'Semiconductors',
    order: 2,
    subcategories: {
      rectifier: { label: 'Rectifier', order: 0 },
      transistor: { label: 'Transistors', order: 1 }
    }
  },
  ics: {
    label: 'ICs',
    order: 3,
    subcategories: {
      'op-amps': { label: 'Op-Amps', order: 0 },
      timers: { label: 'Timers', order: 1 },
      'logic-74xx-hc-hct': { label: 'Logic (74xx/HC/HCT)', order: 2 },
      'mcu-basics': { label: 'MCU basics', order: 3 }
    }
  },
  relays: {
    label: 'Relays',
    order: 4,
    subcategories: {
      spst_spdt: { label: 'SPST/SPDT', order: 0 },
      reed: { label: 'Reed', order: 1 },
      'solid-state': { label: 'Solid-state', order: 2 }
    }
  },
  power: {
    label: 'Power',
    order: 5,
    subcategories: {
      generic: { label: 'Generic', order: 0 },
      regulation: { label: 'Regulation', order: 1 },
      conversion: { label: 'Conversion', order: 2 },
      charging: { label: 'Charging', order: 3 },
      current: { label: 'Current', order: 4 }
    }
  },
  sensors: {
    label: 'Sensors',
    order: 6,
    subcategories: {
      generic: { label: 'Generic', order: 0 }
    }
  },
  specialty: {
    label: 'Specialty',
    order: 7,
    subcategories: {
      rf: { label: 'RF', order: 0 },
      audio: { label: 'Audio', order: 1 },
      'power-management': { label: 'Power-management', order: 2 },
      hierarchy: { label: 'Hierarchy', order: 3 },
      other: { label: 'Other', order: 4 }
    }
  }
} as const;

type LegacyComponentCatalogItem = Omit<
  ComponentCatalogItem,
  'symbolVariant' | 'pins' | 'editablePropertySchema' | 'solverBehavior' | 'compatibilityTags' | 'support'
> &
  Partial<Pick<ComponentCatalogItem, 'symbolVariant' | 'pins' | 'editablePropertySchema' | 'solverBehavior' | 'compatibilityTags' | 'support'>>;

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
  support: item.support ?? { level: item.tags.includes('fully-simulated') ? 'full' : 'partial' },
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
    tags: ['symbol', 'ohmic', 'generic', 'fully-simulated'],
    pinCount: 2,
    editablePropertySchema: {
      resistance: { type: 'number', label: 'Resistance', unit: 'Ω', min: 0.001 }
    },
    solverBehavior: { model: 'resistor', propertyMap: { resistance: 'resistance' } },
    defaultProps: { resistanceOhms: 1000 },
    metadata: {
      aliases: ['R'],
      shortcut: { key: 'R' }
    },
    sidebar: { category: 'passive', subcategory: 'generic' }
  },
  {
    id: 'capacitor',
    displayName: 'Capacitor',
    kind: 'capacitor',
    category: 'passive',
    subcategory: 'generic',
    description: 'Generic capacitor symbol for charge storage.',
    tags: ['symbol', 'energy-storage', 'generic', 'fully-simulated'],
    pinCount: 2,
    editablePropertySchema: {
      capacitance: { type: 'number', label: 'Capacitance', unit: 'F', min: 0 }
    },
    solverBehavior: { model: 'capacitor', propertyMap: { capacitance: 'capacitance' } },
    defaultProps: { capacitanceFarads: 0.000001 },
    metadata: {
      aliases: ['C'],
      shortcut: { key: 'C' }
    },
    sidebar: { category: 'passive', subcategory: 'generic' }
  },
  {
    id: 'inductor',
    displayName: 'Inductor',
    kind: 'inductor',
    category: 'passive',
    subcategory: 'generic',
    description: 'Generic inductor symbol for magnetic energy storage.',
    tags: ['symbol', 'magnetic', 'generic', 'fully-simulated'],
    pinCount: 2,
    editablePropertySchema: {
      inductance: { type: 'number', label: 'Inductance', unit: 'H', min: 0 }
    },
    solverBehavior: { model: 'inductor', propertyMap: { inductance: 'inductance' } },
    defaultProps: { inductanceHenries: 0.001 },
    metadata: {
      aliases: ['L', 'Coil'],
      shortcut: { key: 'L' }
    },
    sidebar: { category: 'passive', subcategory: 'generic' }
  },
  {
    id: 'potentiometer-trimpot',
    displayName: 'Potentiometer',
    kind: 'resistor',
    category: 'passive',
    subcategory: 'resistive',
    description: 'Three-terminal variable resistor for manual analog tuning.',
    tags: ['passive', 'resistive', 'variable', 'potentiometer', 'trim', 'fully-simulated', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      resistanceOhms: { type: 'number', label: 'Nominal resistance', unit: 'Ω', min: 1 },
      tolerancePct: { type: 'number', label: 'Tolerance', unit: '%', min: 0 },
      tempcoPpmPerC: { type: 'number', label: 'Tempco', unit: 'ppm/°C' },
      wiperPosition: { type: 'number', label: 'Wiper position', min: 0, max: 1 }
    },
    solverBehavior: {
      model: 'resistor',
      propertyMap: { resistanceOhms: 'resistance', tolerancePct: 'resistance.tolerancePct', tempcoPpmPerC: 'resistance.tempcoPpm' }
    },
    defaultProps: { resistanceOhms: 10000, tolerancePct: 10, tempcoPpmPerC: 150, wiperPosition: 0.5 },
    metadata: {
      aliases: ['Pot', 'Variable resistor', 'Rvar'],
      shortcut: { key: 'RP' }
    },
    partNumber: 'B10K',
    manufacturer: 'Bourns',
    datasheetUrl: 'https://example.com/datasheets/b10k.pdf',
    packageHint: 'Panel-mount rotary',
    footprintHint: 'POT-TH-3PIN',
    sidebar: { category: 'passive', subcategory: 'resistive' }
  },
  {
    id: 'trimmer-resistor',
    displayName: 'Trimmer Resistor',
    kind: 'resistor',
    category: 'passive',
    subcategory: 'resistive',
    description: 'Single-turn trimmer potentiometer for calibration adjustments.',
    tags: ['passive', 'resistive', 'trim', 'calibration', 'fully-simulated', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      resistanceOhms: { type: 'number', label: 'Nominal resistance', unit: 'Ω', min: 1 },
      tolerancePct: { type: 'number', label: 'Tolerance', unit: '%', min: 0 },
      tempcoPpmPerC: { type: 'number', label: 'Tempco', unit: 'ppm/°C' }
    },
    solverBehavior: { model: 'resistor', propertyMap: { resistanceOhms: 'resistance' } },
    defaultProps: { resistanceOhms: 5000, tolerancePct: 25, tempcoPpmPerC: 250 },
    metadata: {
      aliases: ['Trimpot', 'Trim pot', 'Preset resistor'],
      shortcut: { key: 'RT' }
    },
    partNumber: '3296W-1-502LF',
    manufacturer: 'Bourns',
    datasheetUrl: 'https://example.com/datasheets/3296w.pdf',
    packageHint: '3296W vertical',
    footprintHint: 'TRIM-3296W',
    sidebar: { category: 'passive', subcategory: 'resistive' }
  },
  {
    id: 'thermistor-ntc',
    displayName: 'NTC Thermistor',
    kind: 'resistor',
    category: 'passive',
    subcategory: 'resistive',
    description: 'Negative temperature coefficient thermistor for sensing and inrush limiting.',
    tags: ['passive', 'resistive', 'thermistor', 'ntc', 'temperature', 'fully-simulated', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      resistanceOhms: { type: 'number', label: 'Resistance @25°C', unit: 'Ω', min: 1 },
      tolerancePct: { type: 'number', label: 'Tolerance', unit: '%', min: 0 },
      betaKelvin: { type: 'number', label: 'Beta constant', unit: 'K', min: 1 },
      nominalTempC: { type: 'number', label: 'Nominal temperature', unit: '°C' }
    },
    solverBehavior: { model: 'resistor', propertyMap: { resistanceOhms: 'resistance', betaKelvin: 'thermal.beta', nominalTempC: 'resistance.nominalTempC' } },
    defaultProps: { resistanceOhms: 10000, tolerancePct: 1, betaKelvin: 3950, nominalTempC: 25 },
    metadata: {
      aliases: ['Inrush limiter', 'NTC', 'Thermistor'],
      shortcut: { key: 'NTC' }
    },
    partNumber: 'NTCLE100E3103JB0',
    manufacturer: 'Vishay',
    datasheetUrl: 'https://example.com/datasheets/ntcle100e3103jb0.pdf',
    packageHint: 'Radial bead',
    footprintHint: 'THERMISTOR-RADIAL',
    sidebar: { category: 'passive', subcategory: 'resistive' }
  },
  {
    id: 'thermistor-ptc',
    displayName: 'PTC Thermistor',
    kind: 'resistor',
    category: 'passive',
    subcategory: 'resistive',
    description: 'Positive temperature coefficient thermistor for resettable protection.',
    tags: ['passive', 'resistive', 'thermistor', 'ptc', 'protection', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      resistanceOhms: { type: 'number', label: 'Cold resistance', unit: 'Ω', min: 0.001 },
      tolerancePct: { type: 'number', label: 'Tolerance', unit: '%', min: 0 },
      tripCurrentAmps: { type: 'number', label: 'Trip current', unit: 'A', min: 0 },
      holdCurrentAmps: { type: 'number', label: 'Hold current', unit: 'A', min: 0 }
    },
    solverBehavior: { model: 'resistor', propertyMap: { resistanceOhms: 'resistance' } },
    defaultProps: { resistanceOhms: 1.5, tolerancePct: 20, tripCurrentAmps: 0.5, holdCurrentAmps: 0.25 },
    metadata: {
      aliases: ['Resettable fuse', 'Polyfuse', 'PPTC'],
      shortcut: { key: 'PTC' }
    },
    partNumber: 'MF-R050',
    manufacturer: 'Bourns',
    datasheetUrl: 'https://example.com/datasheets/mf-r050.pdf',
    packageHint: 'Radial disc',
    footprintHint: 'PPTC-RADIAL',
    sidebar: { category: 'passive', subcategory: 'resistive' }
  },
  {
    id: 'varistor-mov',
    displayName: 'Varistor (MOV)',
    kind: 'resistor',
    category: 'passive',
    subcategory: 'resistive',
    description: 'Voltage-dependent resistor for transient suppression.',
    tags: ['passive', 'resistive', 'varistor', 'mov', 'surge-protection', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      varistorVoltageVolts: { type: 'number', label: 'Varistor voltage', unit: 'V', min: 1 },
      clampVoltageVolts: { type: 'number', label: 'Clamp voltage', unit: 'V', min: 1 },
      surgeCurrentAmps: { type: 'number', label: 'Peak surge current', unit: 'A', min: 0 }
    },
    solverBehavior: { model: 'resistor', propertyMap: { varistorVoltageVolts: 'protection.varistorVoltage' } },
    defaultProps: { varistorVoltageVolts: 470, clampVoltageVolts: 775, surgeCurrentAmps: 4500 },
    metadata: {
      aliases: ['MOV', 'Surge suppressor'],
      shortcut: { key: 'MOV' }
    },
    partNumber: 'V14E300P',
    manufacturer: 'Littelfuse',
    datasheetUrl: 'https://example.com/datasheets/v14e300p.pdf',
    packageHint: '14 mm radial disc',
    footprintHint: 'MOV-14MM',
    sidebar: { category: 'passive', subcategory: 'resistive' }
  },
  {
    id: 'capacitor-electrolytic',
    displayName: 'Electrolytic Capacitor',
    kind: 'capacitor',
    category: 'passive',
    subcategory: 'capacitive',
    description: 'Polarized high-capacitance capacitor for bulk filtering.',
    tags: ['passive', 'capacitive', 'electrolytic', 'polarized', 'fully-simulated', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      capacitanceFarads: { type: 'number', label: 'Capacitance', unit: 'F', min: 0 },
      tolerancePct: { type: 'number', label: 'Tolerance', unit: '%', min: 0 },
      maxVoltageVolts: { type: 'number', label: 'Rated voltage', unit: 'V', min: 0 },
      esrOhms: { type: 'number', label: 'ESR', unit: 'Ω', min: 0 }
    },
    solverBehavior: { model: 'capacitor', propertyMap: { capacitanceFarads: 'capacitance', esrOhms: 'esr' } },
    defaultProps: { capacitanceFarads: 0.000047, tolerancePct: 20, maxVoltageVolts: 25, esrOhms: 0.8 },
    metadata: {
      aliases: ['Electrolytic', 'Polarized capacitor', 'Bulk cap'],
      shortcut: { key: 'CE' }
    },
    partNumber: 'EEU-FR1E470',
    manufacturer: 'Panasonic',
    datasheetUrl: 'https://example.com/datasheets/eeu-fr1e470.pdf',
    packageHint: 'Radial can',
    footprintHint: 'CAP-RADIAL-D8',
    sidebar: { category: 'passive', subcategory: 'capacitive' }
  },
  {
    id: 'capacitor-ceramic',
    displayName: 'Ceramic Capacitor',
    kind: 'capacitor',
    category: 'passive',
    subcategory: 'capacitive',
    description: 'Low-ESR ceramic capacitor for decoupling and filtering.',
    tags: ['passive', 'capacitive', 'ceramic', 'decoupling', 'fully-simulated', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      capacitanceFarads: { type: 'number', label: 'Capacitance', unit: 'F', min: 0 },
      tolerancePct: { type: 'number', label: 'Tolerance', unit: '%', min: 0 },
      dielectric: { type: 'enum', label: 'Dielectric', options: ['C0G', 'X7R', 'X5R', 'Y5V'] },
      tempcoPpmPerC: { type: 'number', label: 'Tempco', unit: 'ppm/°C' }
    },
    solverBehavior: { model: 'capacitor', propertyMap: { capacitanceFarads: 'capacitance' } },
    defaultProps: { capacitanceFarads: 0.0000001, tolerancePct: 10, dielectric: 'X7R', tempcoPpmPerC: 15 },
    metadata: {
      aliases: ['MLCC', 'Ceramic cap'],
      shortcut: { key: 'CC' }
    },
    partNumber: 'GRM188R71H104KA93D',
    manufacturer: 'Murata',
    datasheetUrl: 'https://example.com/datasheets/grm188r71h104ka93d.pdf',
    packageHint: '0603 SMD',
    footprintHint: 'C0603',
    sidebar: { category: 'passive', subcategory: 'capacitive' }
  },
  {
    id: 'capacitor-film',
    displayName: 'Film Capacitor',
    kind: 'capacitor',
    category: 'passive',
    subcategory: 'capacitive',
    description: 'Stable polypropylene film capacitor for timing and snubber networks.',
    tags: ['passive', 'capacitive', 'film', 'timing', 'snubber', 'fully-simulated', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      capacitanceFarads: { type: 'number', label: 'Capacitance', unit: 'F', min: 0 },
      tolerancePct: { type: 'number', label: 'Tolerance', unit: '%', min: 0 },
      maxVoltageVolts: { type: 'number', label: 'Rated voltage', unit: 'V', min: 0 },
      tempcoPpmPerC: { type: 'number', label: 'Tempco', unit: 'ppm/°C' }
    },
    solverBehavior: { model: 'capacitor', propertyMap: { capacitanceFarads: 'capacitance' } },
    defaultProps: { capacitanceFarads: 0.000001, tolerancePct: 5, maxVoltageVolts: 63, tempcoPpmPerC: 100 },
    metadata: {
      aliases: ['Polypropylene capacitor', 'Film cap'],
      shortcut: { key: 'CF' }
    },
    partNumber: 'ECW-F6105JL',
    manufacturer: 'Panasonic',
    datasheetUrl: 'https://example.com/datasheets/ecw-f6105jl.pdf',
    packageHint: 'Radial box',
    footprintHint: 'FILM-RADIAL-10MM',
    sidebar: { category: 'passive', subcategory: 'capacitive' }
  },
  {
    id: 'ferrite-bead',
    displayName: 'Ferrite Bead',
    kind: 'resistor',
    category: 'passive',
    subcategory: 'magnetic',
    description: 'Frequency-dependent impedance bead for EMI suppression.',
    tags: ['passive', 'magnetic', 'emi', 'filter', 'bead', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      dcResistanceOhms: { type: 'number', label: 'DC resistance', unit: 'Ω', min: 0 },
      impedanceAt100MHzOhms: { type: 'number', label: 'Impedance @100MHz', unit: 'Ω', min: 0 },
      currentRatingAmps: { type: 'number', label: 'Current rating', unit: 'A', min: 0 }
    },
    solverBehavior: { model: 'resistor', propertyMap: { dcResistanceOhms: 'resistance' } },
    defaultProps: { dcResistanceOhms: 0.05, impedanceAt100MHzOhms: 120, currentRatingAmps: 2 },
    metadata: {
      aliases: ['EMI bead', 'Chip bead', 'Ferrite'],
      shortcut: { key: 'FB' }
    },
    partNumber: 'BLM18AG121SN1D',
    manufacturer: 'Murata',
    datasheetUrl: 'https://example.com/datasheets/blm18ag121sn1d.pdf',
    packageHint: '0603 SMD',
    footprintHint: 'FB0603',
    sidebar: { category: 'passive', subcategory: 'magnetic' }
  },
  {
    id: 'coupled-inductor',
    displayName: 'Coupled Inductor',
    kind: 'inductor',
    category: 'passive',
    subcategory: 'magnetic',
    description: 'Magnetically coupled inductor element for common-mode and flyback topologies.',
    tags: ['passive', 'magnetic', 'inductor', 'coupled', 'transformer', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      inductanceHenries: { type: 'number', label: 'Primary inductance', unit: 'H', min: 0 },
      tolerancePct: { type: 'number', label: 'Tolerance', unit: '%', min: 0 },
      couplingFactor: { type: 'number', label: 'Coupling factor', min: 0, max: 1 },
      saturationCurrentAmps: { type: 'number', label: 'Saturation current', unit: 'A', min: 0 }
    },
    solverBehavior: { model: 'inductor', propertyMap: { inductanceHenries: 'inductance' } },
    defaultProps: { inductanceHenries: 0.00047, tolerancePct: 20, couplingFactor: 0.98, saturationCurrentAmps: 3 },
    metadata: {
      aliases: ['Common mode choke', 'Coupled choke', 'Dual inductor'],
      shortcut: { key: 'LC' }
    },
    partNumber: '744232090',
    manufacturer: 'Wurth Elektronik',
    datasheetUrl: 'https://example.com/datasheets/744232090.pdf',
    packageHint: 'Shielded SMD power inductor',
    footprintHint: 'L-10X10',
    sidebar: { category: 'passive', subcategory: 'magnetic' }
  },
  {
    id: 'voltage-source',
    displayName: 'Voltage Source',
    kind: 'voltage-source',
    category: 'sources',
    subcategory: 'dc',
    description: 'Ideal two-terminal voltage source.',
    tags: ['source', 'dc', 'generic', 'fully-simulated'],
    pinCount: 2,
    editablePropertySchema: {
      voltage: { type: 'number', label: 'Voltage', unit: 'V' },
      internalResistance: { type: 'number', label: 'Internal resistance', unit: 'Ω', min: 0 },
      rippleAmplitude: { type: 'number', label: 'Ripple amplitude', unit: 'V', min: 0 }
    },
    solverBehavior: { model: 'voltage-source', propertyMap: { voltage: 'voltage', internalResistance: 'nonIdeal.internalResistance', rippleAmplitude: 'nonIdeal.rippleAmplitude' } },
    defaultProps: { voltageVolts: 5 },
    metadata: {
      aliases: ['VSource', 'Supply'],
      shortcut: { key: 'V' }
    },
    sidebar: { category: 'sources', subcategory: 'dc' }
  },
  {
    id: 'current-source',
    displayName: 'Current Source',
    kind: 'current-source',
    category: 'sources',
    subcategory: 'dc',
    description: 'Ideal two-terminal current source.',
    tags: ['source', 'bias', 'generic', 'fully-simulated'],
    pinCount: 2,
    editablePropertySchema: {
      current: { type: 'number', label: 'Current', unit: 'A' },
      internalResistance: { type: 'number', label: 'Internal resistance', unit: 'Ω', min: 0 },
      rippleAmplitude: { type: 'number', label: 'Ripple amplitude', unit: 'A', min: 0 }
    },
    solverBehavior: { model: 'current-source', propertyMap: { current: 'current', internalResistance: 'nonIdeal.internalResistance', rippleAmplitude: 'nonIdeal.rippleAmplitude' } },
    defaultProps: { currentAmps: 0.001 },
    metadata: {
      aliases: ['ISource'],
      shortcut: { key: 'I' }
    },
    sidebar: { category: 'sources', subcategory: 'dc' }
  },
  {
    id: 'ac-voltage-source',
    displayName: 'AC Voltage Source',
    kind: 'ac-voltage-source',
    category: 'sources',
    subcategory: 'ac',
    description: 'Sine-wave source for AC sweeps and sinusoidal excitation.',
    tags: ['source', 'ac', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      amplitudeVolts: { type: 'number', label: 'Amplitude', unit: 'V', min: 0 },
      frequencyHz: { type: 'number', label: 'Frequency', unit: 'Hz', min: 0 },
      dcOffsetVolts: { type: 'number', label: 'DC offset', unit: 'V' }
    },
    solverBehavior: { model: 'ac-voltage-source', propertyMap: { amplitudeVolts: 'voltage', frequencyHz: 'nonIdeal.rippleFrequencyHz' } },
    support: { level: 'partial', notes: 'AC/transient excitation only; DC operating point is not modeled.' },
    defaultProps: { amplitudeVolts: 1, frequencyHz: 1000, dcOffsetVolts: 0 },
    metadata: { aliases: ['Sine source', 'AC source'], shortcut: { key: 'A', id: 'place-ac-source' } },
    sidebar: { category: 'sources', subcategory: 'ac' }
  },
  {
    id: 'pulse-voltage-source',
    displayName: 'Pulse Source',
    kind: 'pulse-voltage-source',
    category: 'sources',
    subcategory: 'pulse',
    description: 'Pulse generator for digital-like transient excitation.',
    tags: ['source', 'pulse', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      lowLevelVolts: { type: 'number', label: 'Low level', unit: 'V' },
      highLevelVolts: { type: 'number', label: 'High level', unit: 'V' },
      frequencyHz: { type: 'number', label: 'Frequency', unit: 'Hz', min: 0 }
    },
    solverBehavior: { model: 'pulse-voltage-source', propertyMap: { highLevelVolts: 'voltage', frequencyHz: 'nonIdeal.rippleFrequencyHz' } },
    support: { level: 'partial', notes: 'Transient-mode behavior only.' },
    defaultProps: { lowLevelVolts: 0, highLevelVolts: 5, frequencyHz: 1000 },
    metadata: { aliases: ['Square source', 'Clock source'], shortcut: { key: 'U', id: 'place-pulse-source' } },
    sidebar: { category: 'sources', subcategory: 'pulse' }
  },
  {
    id: 'reference-source',
    displayName: 'Reference Source',
    kind: 'reference-source',
    category: 'sources',
    subcategory: 'reference',
    description: 'Precision DC reference source.',
    tags: ['source', 'reference', 'fully-simulated', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      voltage: { type: 'number', label: 'Reference voltage', unit: 'V' },
      tempcoPpmPerC: { type: 'number', label: 'Tempco', unit: 'ppm/°C' }
    },
    solverBehavior: { model: 'voltage-source', propertyMap: { voltage: 'voltage' } },
    support: { level: 'full' },
    defaultProps: { voltageVolts: 2.5, tempcoPpmPerC: 10 },
    metadata: { aliases: ['Bandgap reference', 'Vref'], shortcut: { key: 'E', id: 'place-reference-source' } },
    sidebar: { category: 'sources', subcategory: 'reference' }
  },
  {
    id: 'battery-cell',
    displayName: 'Battery Cell',
    kind: 'battery-cell',
    category: 'sources',
    subcategory: 'battery',
    description: 'Single-cell battery source.',
    tags: ['source', 'battery', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      voltage: { type: 'number', label: 'Nominal voltage', unit: 'V' },
      internalResistance: { type: 'number', label: 'Internal resistance', unit: 'Ω', min: 0 }
    },
    solverBehavior: { model: 'voltage-source', propertyMap: { voltage: 'voltage', internalResistance: 'nonIdeal.internalResistance' } },
    support: { level: 'partial', notes: 'Equivalent DC source model only.' },
    defaultProps: { voltageVolts: 3.7, internalResistanceOhms: 0.08 },
    metadata: { aliases: ['Li-ion cell', 'Cell'], shortcut: { key: 'Y', id: 'place-battery-cell' } },
    sidebar: { category: 'sources', subcategory: 'battery' }
  },
  {
    id: 'battery-pack',
    displayName: 'Battery Pack',
    kind: 'battery-pack',
    category: 'sources',
    subcategory: 'battery',
    description: 'Multi-cell battery pack source.',
    tags: ['source', 'battery', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      voltage: { type: 'number', label: 'Pack voltage', unit: 'V' },
      capacityAh: { type: 'number', label: 'Capacity', unit: 'Ah', min: 0 }
    },
    solverBehavior: { model: 'voltage-source', propertyMap: { voltage: 'voltage' } },
    support: { level: 'partial', notes: 'DC equivalent model; no SOC dynamics yet.' },
    defaultProps: { voltageVolts: 12, capacityAh: 2.2 },
    metadata: { aliases: ['Battery'], shortcut: { key: 'K', id: 'place-battery-pack' } },
    sidebar: { category: 'sources', subcategory: 'battery' }
  },
  {
    id: 'battery-coin-cell',
    displayName: 'Coin Cell',
    kind: 'battery-coin-cell',
    category: 'sources',
    subcategory: 'battery',
    description: 'Compact coin-cell battery source.',
    tags: ['source', 'battery', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      voltage: { type: 'number', label: 'Nominal voltage', unit: 'V' },
      internalResistance: { type: 'number', label: 'Internal resistance', unit: 'Ω', min: 0 }
    },
    solverBehavior: { model: 'voltage-source', propertyMap: { voltage: 'voltage', internalResistance: 'nonIdeal.internalResistance' } },
    support: { level: 'partial', notes: 'Static Thevenin approximation.' },
    defaultProps: { voltageVolts: 3, internalResistanceOhms: 10 },
    metadata: { aliases: ['CR2032'], shortcut: { key: 'N', id: 'place-battery-coin' } },
    sidebar: { category: 'sources', subcategory: 'battery' }
  },
  {
    id: 'ldo-regulator',
    displayName: 'LDO Regulator',
    kind: 'ldo-regulator',
    category: 'power',
    subcategory: 'regulation',
    description: 'Linear low-dropout voltage regulator.',
    tags: ['power', 'regulator', 'ldo', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      outputVoltageVolts: { type: 'number', label: 'Output voltage', unit: 'V' },
      dropoutVolts: { type: 'number', label: 'Dropout', unit: 'V', min: 0 }
    },
    solverBehavior: { model: 'ldo-regulator', propertyMap: { outputVoltageVolts: 'voltage' } },
    support: { level: 'partial', notes: 'Idealized regulation only in DC.' },
    defaultProps: { outputVoltageVolts: 3.3, dropoutVolts: 0.2 },
    metadata: { aliases: ['Linear regulator'], shortcut: { key: 'Z', id: 'place-ldo' } },
    sidebar: { category: 'power', subcategory: 'regulation' }
  },
  {
    id: 'buck-regulator',
    displayName: 'Buck Regulator',
    kind: 'buck-regulator',
    category: 'power',
    subcategory: 'conversion',
    description: 'Step-down switching regulator block.',
    tags: ['power', 'buck', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      outputVoltageVolts: { type: 'number', label: 'Output voltage', unit: 'V' },
      efficiencyPct: { type: 'number', label: 'Efficiency', unit: '%', min: 0, max: 100 }
    },
    solverBehavior: { model: 'buck-regulator', propertyMap: { outputVoltageVolts: 'voltage' } },
    support: { level: 'partial', notes: 'Averaged DC model only.' },
    defaultProps: { outputVoltageVolts: 5, efficiencyPct: 90 },
    metadata: { aliases: ['Step-down converter'], shortcut: { key: 'W', id: 'place-buck' } },
    sidebar: { category: 'power', subcategory: 'conversion' }
  },
  {
    id: 'boost-regulator',
    displayName: 'Boost Regulator',
    kind: 'boost-regulator',
    category: 'power',
    subcategory: 'conversion',
    description: 'Step-up switching regulator block.',
    tags: ['power', 'boost', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      outputVoltageVolts: { type: 'number', label: 'Output voltage', unit: 'V' },
      efficiencyPct: { type: 'number', label: 'Efficiency', unit: '%', min: 0, max: 100 }
    },
    solverBehavior: { model: 'boost-regulator', propertyMap: { outputVoltageVolts: 'voltage' } },
    support: { level: 'partial', notes: 'Averaged DC model only.' },
    defaultProps: { outputVoltageVolts: 12, efficiencyPct: 88 },
    metadata: { aliases: ['Step-up converter'], shortcut: { key: 'J', id: 'place-boost' } },
    sidebar: { category: 'power', subcategory: 'conversion' }
  },
  {
    id: 'charge-pump',
    displayName: 'Charge Pump',
    kind: 'charge-pump',
    category: 'power',
    subcategory: 'charging',
    description: 'Switched-capacitor converter macro model.',
    tags: ['power', 'charge-pump', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      targetVoltageVolts: { type: 'number', label: 'Target voltage', unit: 'V' },
      switchingFrequencyHz: { type: 'number', label: 'Switching frequency', unit: 'Hz', min: 0 }
    },
    solverBehavior: { model: 'charge-pump', propertyMap: { targetVoltageVolts: 'voltage' } },
    support: { level: 'visual-only', notes: 'Placement/documentation only. Solver support pending.' },
    defaultProps: { targetVoltageVolts: 9, switchingFrequencyHz: 100000 },
    metadata: { aliases: ['Switched capacitor'], shortcut: { key: 'H', id: 'place-charge-pump' } },
    sidebar: { category: 'power', subcategory: 'charging' }
  },
  {
    id: 'current-regulator',
    displayName: 'Current Regulator',
    kind: 'current-regulator',
    category: 'power',
    subcategory: 'current',
    description: 'Constant-current regulator element.',
    tags: ['power', 'current', 'regulator', 'new'],
    pinCount: 2,
    editablePropertySchema: {
      outputCurrentAmps: { type: 'number', label: 'Output current', unit: 'A', min: 0 },
      complianceVolts: { type: 'number', label: 'Compliance voltage', unit: 'V', min: 0 }
    },
    solverBehavior: { model: 'current-regulator', propertyMap: { outputCurrentAmps: 'current' } },
    support: { level: 'partial', notes: 'DC current-limit behavior only.' },
    defaultProps: { outputCurrentAmps: 0.02, complianceVolts: 20 },
    metadata: { aliases: ['Constant current source'], shortcut: { key: 'X', id: 'place-current-reg' } },
    sidebar: { category: 'power', subcategory: 'current' }
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
    editablePropertySchema: {
      forwardDrop: { type: 'number', label: 'Forward drop', unit: 'V', min: 0 }
    },
    solverBehavior: { model: 'diode', propertyMap: { forwardDrop: 'forwardDrop' } },
    defaultProps: { forwardDropVolts: 0.7 },
    metadata: {
      aliases: ['Rectifier'],
      shortcut: { key: 'O' }
    },
    sidebar: { category: 'semiconductors', subcategory: 'rectifier' }
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
    editablePropertySchema: {
      beta: { type: 'number', label: 'Beta', min: 0 }
    },
    solverBehavior: { model: 'bjt', propertyMap: { beta: 'beta' } },
    defaultProps: { beta: 100 },
    metadata: {
      aliases: ['Transistor'],
      shortcut: { key: 'B' }
    },
    sidebar: { category: 'semiconductors', subcategory: 'transistor' }
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
    editablePropertySchema: {
      thresholdVoltage: { type: 'number', label: 'Threshold voltage', unit: 'V' }
    },
    solverBehavior: { model: 'mosfet', propertyMap: { thresholdVoltage: 'thresholdVoltage' } },
    defaultProps: { thresholdVoltageVolts: 2.5 },
    metadata: {
      aliases: ['FET'],
      shortcut: { key: 'M' }
    },
    sidebar: { category: 'semiconductors', subcategory: 'transistor' }
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
    editablePropertySchema: {
      gain: { type: 'number', label: 'Open-loop gain', min: 1 }
    },
    solverBehavior: { model: 'op-amp', propertyMap: { gain: 'gain' } },
    defaultProps: { openLoopGain: 100000 },
    metadata: {
      aliases: ['Operational Amplifier'],
      shortcut: { key: 'P', id: 'place-opamp' }
    },
    sidebar: { category: 'ics', subcategory: 'op-amps' }
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
    editablePropertySchema: {
      gateType: { type: 'enum', label: 'Gate type', options: ['and', 'or', 'not', 'nand', 'nor', 'xor'] },
      highThreshold: { type: 'number', label: 'Logic high threshold', unit: 'V', min: 0 }
    },
    solverBehavior: { model: 'logic-gate', propertyMap: { gateType: 'gateType', highThreshold: 'bridge.highThreshold' } },
    defaultProps: { family: 'CMOS', gateType: 'nand' },
    metadata: {
      aliases: ['Gate'],
      shortcut: { key: 'T', id: 'place-logic' }
    },
    sidebar: { category: 'ics', subcategory: 'logic-74xx-hc-hct' }
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
    datasheetUrl: 'https://example.com/datasheets/ne555.pdf',
    sidebar: { category: 'ics', subcategory: 'timers' }
  },
  {
    id: 'lm358',
    displayName: 'Dual Op-Amp (LM358)',
    kind: 'op-amp',
    category: 'ics',
    subcategory: 'precision-analog',
    description: 'Dual operational amplifier suitable for single-supply designs.',
    tags: ['ic', 'analog', 'amplifier', 'new'],
    pinCount: 8,
    defaultProps: { openLoopGain: 100000, channels: 2 },
    partNumber: 'LM358',
    manufacturer: 'STMicroelectronics',
    datasheetUrl: 'https://example.com/datasheets/lm358.pdf',
    sidebar: { category: 'ics', subcategory: 'op-amps' }
  },
  {
    id: '74hc00',
    displayName: 'Quad NAND (74HC00)',
    kind: 'logic-gate',
    category: 'interface',
    subcategory: 'logic-family',
    description: 'Quad 2-input NAND gate in HC CMOS family.',
    tags: ['ic', 'digital', 'nand', 'new'],
    pinCount: 14,
    defaultProps: { family: 'HC', gates: 4 },
    partNumber: '74HC00',
    manufacturer: 'Nexperia',
    datasheetUrl: 'https://example.com/datasheets/74hc00.pdf',
    sidebar: { category: 'ics', subcategory: 'logic-74xx-hc-hct' }
  },
  {
    id: 'ad9833',
    displayName: 'DDS Signal Generator (AD9833)',
    kind: 'logic-gate',
    category: 'rf',
    subcategory: 'signal-synthesis',
    description: 'Direct digital synthesis IC for low-power waveform generation.',
    tags: ['rf', 'dds', 'niche', 'new'],
    pinCount: 10,
    defaultProps: { maxFrequencyHz: 12500000 },
    partNumber: 'AD9833',
    manufacturer: 'Analog Devices',
    datasheetUrl: 'https://example.com/datasheets/ad9833.pdf',
    sidebar: { category: 'specialty', subcategory: 'rf' }
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
    defaultProps: { collapsed: true },
    metadata: {
      aliases: ['Macro'],
      shortcut: { key: 'S' }
    },
    sidebar: { category: 'specialty', subcategory: 'hierarchy' }
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
  const aliasesToItem = new Map<string, string>();
  const shortcutKeyToItem = new Map<string, string>();
  const errors: string[] = [];

  for (const item of items) {
    if (ids.has(item.id)) {
      errors.push(`Duplicate component catalog id: ${item.id}`);
    }
    ids.add(item.id);

    if (!validCategories.includes(item.category)) {
      errors.push(`Invalid category "${item.category}" on item "${item.id}"`);
    }

    if (item.metadata?.aliases) {
      for (const alias of item.metadata.aliases) {
        const normalizedAlias = alias.trim().toLowerCase();
        if (!normalizedAlias) {
          continue;
        }

        const previous = aliasesToItem.get(normalizedAlias);
        if (previous && previous !== item.id) {
          errors.push(`Duplicate alias "${alias}" on item "${item.id}" (already used by "${previous}")`);
        } else {
          aliasesToItem.set(normalizedAlias, item.id);
        }
      }
    }

    if (item.metadata?.shortcut?.key) {
      const normalizedShortcut = item.metadata.shortcut.key.trim().toLowerCase();
      if (normalizedShortcut) {
        const previous = shortcutKeyToItem.get(normalizedShortcut);
        if (previous && previous !== item.id) {
          errors.push(
            `Duplicate placement shortcut key "${item.metadata.shortcut.key}" on item "${item.id}" (already used by "${previous}")`
          );
        } else {
          shortcutKeyToItem.set(normalizedShortcut, item.id);
        }
      }
    }

    if (item.sidebar) {
      const sidebarCategory = SIDEBAR_GROUPING[item.sidebar.category as keyof typeof SIDEBAR_GROUPING];
      if (!sidebarCategory) {
        errors.push(`Invalid sidebar category "${item.sidebar.category}" on item "${item.id}"`);
      } else if (!sidebarCategory.subcategories[item.sidebar.subcategory as keyof typeof sidebarCategory.subcategories]) {
        errors.push(`Invalid sidebar subcategory "${item.sidebar.subcategory}" on item "${item.id}"`);
      }
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
