import type { CircuitState } from '../../../model';

type FixtureExpectation = {
  diagnosticCodes?: string[];
  valueKeys?: string[];
};

export type ComponentCircuitFixture = {
  name: string;
  family: 'passive' | 'active' | 'digital' | 'diagnostic';
  circuit: CircuitState;
  expectations: FixtureExpectation;
};

const baseNodes = [{ id: 'gnd', reference: true }, { id: 'n1' }] as const;

export const COMPONENT_CIRCUIT_FIXTURES: ComponentCircuitFixture[] = [
  {
    name: 'passive-divider',
    family: 'passive',
    circuit: {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }, { id: 'n2' }],
      components: [
        { id: 'vs', kind: 'source2p', catalogTypeId: 'voltage-source', from: 'n1', to: 'gnd', voltage: { value: 12, known: true, computed: false, unit: 'V' } },
        { id: 'r1', kind: 'passive2p', catalogTypeId: 'resistor', from: 'n1', to: 'n2', resistance: { value: 4, known: true, computed: false, unit: 'Ω', constraints: { nonZero: true } } },
        { id: 'r2', kind: 'passive2p', catalogTypeId: 'resistor', from: 'n2', to: 'gnd', resistance: { value: 2, known: true, computed: false, unit: 'Ω', constraints: { nonZero: true } } }
      ]
    },
    expectations: { valueKeys: ['node:n1:voltage', 'component:r1:current'] }
  },
  {
    name: 'diode-dc-path',
    family: 'active',
    circuit: {
      nodes: [...baseNodes],
      components: [
        { id: 'vs', kind: 'source2p', catalogTypeId: 'voltage-source', from: 'n1', to: 'gnd', voltage: { value: 5, known: true, computed: false, unit: 'V' } },
        { id: 'd1', kind: 'switch', catalogTypeId: 'diode', from: 'n1', to: 'gnd', forwardDrop: { value: 0.7, known: true, computed: false, unit: 'V' }, onResistance: { value: 10, known: true, computed: false, unit: 'Ω' }, offResistance: { value: 1e6, known: true, computed: false, unit: 'Ω' } }
      ]
    },
    expectations: { valueKeys: ['component:d1:current'] }
  },
  {
    name: 'bjt-dc-path',
    family: 'active',
    circuit: {
      nodes: [...baseNodes],
      components: [
        { id: 'vs', kind: 'source2p', catalogTypeId: 'voltage-source', from: 'n1', to: 'gnd', voltage: { value: 5, known: true, computed: false, unit: 'V' } },
        { id: 'q1', kind: 'switch', catalogTypeId: 'bjt', from: 'n1', to: 'gnd', beta: { value: 100, known: true, computed: false, unit: 'A' }, vbeOn: { value: 0.7, known: true, computed: false, unit: 'V' } }
      ]
    },
    expectations: { valueKeys: ['component:q1:current'] }
  },
  {
    name: 'mosfet-dc-path',
    family: 'active',
    circuit: {
      nodes: [...baseNodes],
      components: [
        { id: 'vs', kind: 'source2p', catalogTypeId: 'voltage-source', from: 'n1', to: 'gnd', voltage: { value: 5, known: true, computed: false, unit: 'V' } },
        { id: 'm1', kind: 'switch', catalogTypeId: 'mosfet', from: 'n1', to: 'gnd', thresholdVoltage: { value: 2, known: true, computed: false, unit: 'V' }, onResistance: { value: 5, known: true, computed: false, unit: 'Ω' } }
      ]
    },
    expectations: { valueKeys: ['component:m1:current'] }
  },
  {
    name: 'op-amp-output-clamp',
    family: 'active',
    circuit: {
      nodes: [...baseNodes],
      components: [
        { id: 'vs', kind: 'source2p', catalogTypeId: 'voltage-source', from: 'n1', to: 'gnd', voltage: { value: 1, known: true, computed: false, unit: 'V' } },
        { id: 'u1', kind: 'amplifier', catalogTypeId: 'op-amp', from: 'n1', to: 'gnd', gain: { value: 1e5, known: true, computed: false, unit: 'V' }, outputLimitHigh: { value: 12, known: true, computed: false, unit: 'V' }, outputLimitLow: { value: -12, known: true, computed: false, unit: 'V' } }
      ]
    },
    expectations: { valueKeys: ['component:u1:output'] }
  },
  {
    name: 'logic-gate-bridge',
    family: 'digital',
    circuit: {
      nodes: [...baseNodes],
      components: [
        { id: 'vs', kind: 'source2p', catalogTypeId: 'voltage-source', from: 'n1', to: 'gnd', voltage: { value: 5, known: true, computed: false, unit: 'V' } },
        { id: 'g1', kind: 'digital', catalogTypeId: 'logic-gate', from: 'n1', to: 'gnd', gateType: 'not', bridge: { highThreshold: { value: 3, known: true, computed: false, unit: 'V' }, lowThreshold: { value: 1, known: true, computed: false, unit: 'V' }, highLevel: { value: 5, known: true, computed: false, unit: 'V' }, lowLevel: { value: 0, known: true, computed: false, unit: 'V' } } }
      ]
    },
    expectations: { valueKeys: ['component:g1:logic_output'] }
  },
  {
    name: 'underdetermined-capacitor-only',
    family: 'diagnostic',
    circuit: {
      nodes: [...baseNodes],
      components: [
        { id: 'c1', kind: 'passive2p', catalogTypeId: 'capacitor', from: 'n1', to: 'gnd', capacitance: { value: 2e-6, known: true, computed: false, unit: 'F' } }
      ]
    },
    expectations: { diagnosticCodes: ['underdetermined'] }
  },
  {
    name: 'conflicting-voltage-sources',
    family: 'diagnostic',
    circuit: {
      nodes: [...baseNodes],
      components: [
        { id: 'vs-5', kind: 'source2p', catalogTypeId: 'voltage-source', from: 'n1', to: 'gnd', voltage: { value: 5, known: true, computed: false, unit: 'V' } },
        { id: 'vs-9', kind: 'source2p', catalogTypeId: 'voltage-source', from: 'n1', to: 'gnd', voltage: { value: 9, known: true, computed: false, unit: 'V' } }
      ]
    },
    expectations: { diagnosticCodes: ['overdetermined'] }
  },
  {
    name: 'missing-constitutive-value',
    family: 'diagnostic',
    circuit: {
      nodes: [...baseNodes],
      components: [
        { id: 'l1', kind: 'passive2p', catalogTypeId: 'inductor', from: 'n1', to: 'gnd', inductance: { known: true, computed: false, unit: 'H' } }
      ]
    },
    expectations: { diagnosticCodes: ['missing_constitutive_value'] }
  }
];
