import type { ComponentKind } from '../engine/model';

export type CatalogPlacementKind = Exclude<ComponentKind, 'wire'> | 'subcircuit';

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

export const COMPONENT_CATALOG: ComponentCatalogCategory[] = [
  {
    id: 'passive',
    label: 'Passive',
    entries: [
      { id: 'resistor', kind: 'resistor', label: 'Resistor', aliases: ['R'], tags: ['passive', 'ohmic'], partNumber: 'GEN-R', shortcutId: 'place-resistor' },
      { id: 'capacitor', kind: 'capacitor', label: 'Capacitor', aliases: ['C'], tags: ['passive', 'energy-storage'], partNumber: 'GEN-C', shortcutId: 'place-capacitor' },
      { id: 'inductor', kind: 'inductor', label: 'Inductor', aliases: ['L', 'Coil'], tags: ['passive', 'magnetic'], partNumber: 'GEN-L', shortcutId: 'place-inductor' }
    ]
  },
  {
    id: 'sources',
    label: 'Sources',
    entries: [
      { id: 'voltage-source', kind: 'voltageSource', label: 'Voltage Source', aliases: ['VSource', 'Supply'], tags: ['source', 'dc'], partNumber: 'GEN-VSRC', shortcutId: 'place-voltage' },
      { id: 'current-source', kind: 'currentSource', label: 'Current Source', aliases: ['ISource'], tags: ['source', 'bias'], partNumber: 'GEN-ISRC', shortcutId: 'place-current' }
    ]
  },
  {
    id: 'semiconductors',
    label: 'Semiconductors',
    entries: [
      { id: 'diode', kind: 'diode', label: 'Diode', aliases: ['Rectifier'], tags: ['semiconductor', 'pn-junction'], partNumber: '1N4148', shortcutId: 'place-diode' },
      { id: 'bjt', kind: 'bjt', label: 'BJT', aliases: ['Transistor'], tags: ['semiconductor', 'bipolar'], partNumber: '2N3904', shortcutId: 'place-bjt' },
      { id: 'mosfet', kind: 'mosfet', label: 'MOSFET', aliases: ['FET'], tags: ['semiconductor', 'switch'], partNumber: '2N7002', shortcutId: 'place-mosfet' }
    ]
  },
  {
    id: 'ics',
    label: 'ICs',
    entries: [
      { id: 'op-amp', kind: 'opAmp', label: 'Op-Amp', aliases: ['Operational Amplifier'], tags: ['ic', 'analog'], partNumber: 'LM358', shortcutId: 'place-opamp' },
      { id: 'logic-gate', kind: 'logicGate', label: 'Logic Gate', aliases: ['Gate'], tags: ['ic', 'digital'], partNumber: '74HC00', shortcutId: 'place-logic' }
    ]
  },
  {
    id: 'relays',
    label: 'Relays',
    entries: []
  },
  {
    id: 'sensors',
    label: 'Sensors',
    entries: []
  },
  {
    id: 'power',
    label: 'Power',
    entries: []
  },
  {
    id: 'specialty',
    label: 'Specialty',
    entries: [
      { id: 'subcircuit', kind: 'subcircuit', label: 'Subcircuit', aliases: ['Macro'], tags: ['hierarchy', 'module'], partNumber: 'SUBCKT', shortcutId: 'place-subcircuit' }
    ]
  }
];
