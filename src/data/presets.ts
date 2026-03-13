import type { CircuitComponent, SubcircuitDefinition } from '../engine/model';
import type { CanvasNodePosition } from '../components/CircuitCanvas';

export type EditorCircuit = {
  nodes: CanvasNodePosition[];
  components: CircuitComponent[];
  subcircuits?: SubcircuitDefinition[];
};

const baseReferenceNode: CanvasNodePosition = { id: 'n-ref', x: 180, y: 280, reference: true };

export const circuitPresets: Record<string, EditorCircuit> = {
  starter: {
    nodes: [
      baseReferenceNode,
      { id: 'n-a', x: 340, y: 280 }
    ],
    components: [
      {
        id: 'src-1',
        kind: 'source2p',
        catalogTypeId: 'voltage-source',
        from: 'n-a',
        to: 'n-ref',
        label: 'V1',
        voltage: { value: 5, known: true, computed: false, unit: 'V', constraints: { nonZero: true } }
      }
    ]
  },
  voltageDivider: {
    nodes: [
      baseReferenceNode,
      { id: 'n-top', x: 220, y: 140 },
      { id: 'n-mid', x: 420, y: 140 }
    ],
    components: [
      {
        id: 'vd-v1',
        kind: 'source2p',
        catalogTypeId: 'voltage-source',
        from: 'n-top',
        to: 'n-ref',
        label: 'V1',
        voltage: { value: 12, known: true, computed: false, unit: 'V', constraints: { nonZero: true } }
      },
      {
        id: 'vd-r1',
        kind: 'passive2p',
        catalogTypeId: 'resistor',
        from: 'n-top',
        to: 'n-mid',
        label: 'R1',
        resistance: { value: 1000, known: true, computed: false, unit: 'Ω', constraints: { min: 0.001, nonZero: true } }
      },
      {
        id: 'vd-r2',
        kind: 'passive2p',
        catalogTypeId: 'resistor',
        from: 'n-mid',
        to: 'n-ref',
        label: 'R2',
        resistance: { value: 2000, known: true, computed: false, unit: 'Ω', constraints: { min: 0.001, nonZero: true } }
      }
    ]
  },
  currentLoop: {
    nodes: [
      baseReferenceNode,
      { id: 'n-right', x: 500, y: 280 }
    ],
    components: [
      {
        id: 'cl-i1',
        kind: 'source2p',
        catalogTypeId: 'current-source',
        from: 'n-right',
        to: 'n-ref',
        label: 'I1',
        current: { value: 0.02, known: true, computed: false, unit: 'A' }
      },
      {
        id: 'cl-r1',
        kind: 'passive2p',
        catalogTypeId: 'resistor',
        from: 'n-right',
        to: 'n-ref',
        label: 'R1',
        resistance: { value: 470, known: true, computed: false, unit: 'Ω', constraints: { min: 0.001, nonZero: true } }
      }
    ]
  },
  thermistorSensorDemo: {
    nodes: [baseReferenceNode, { id: 'n-sense', x: 320, y: 180 }, { id: 'n-out', x: 500, y: 180 }],
    components: [
      { id: 'th-src', kind: 'sensor', catalogTypeId: 'sensor-thermistor-probe', from: 'n-sense', to: 'n-ref', label: 'TH', sensitivity: { value: 0.01, known: true, computed: false, unit: 'V' }, offset: { value: 0.5, known: true, computed: false, unit: 'V' }, inputSignal: { value: 60, known: true, computed: false, unit: 'V' }, supplyMin: { value: 0, known: true, computed: false, unit: 'V' }, supplyMax: { value: 3.3, known: true, computed: false, unit: 'V' }, outputClampBehavior: 'saturate' },
      { id: 'th-r', kind: 'passive2p', catalogTypeId: 'resistor', from: 'n-sense', to: 'n-out', label: 'Rload', resistance: { value: 1000, known: true, computed: false, unit: 'Ω', constraints: { min: 0.001, nonZero: true } } },
      { id: 'th-rg', kind: 'passive2p', catalogTypeId: 'resistor', from: 'n-out', to: 'n-ref', label: 'Rg', resistance: { value: 1000, known: true, computed: false, unit: 'Ω', constraints: { min: 0.001, nonZero: true } } }
    ]
  },
  ldrSensorDemo: {
    nodes: [baseReferenceNode, { id: 'n-ldr', x: 320, y: 180 }],
    components: [
      { id: 'ldr-src', kind: 'sensor', catalogTypeId: 'sensor-ldr', from: 'n-ldr', to: 'n-ref', label: 'LDR', sensitivity: { value: 0.004, known: true, computed: false, unit: 'V' }, offset: { value: 0.1, known: true, computed: false, unit: 'V' }, inputSignal: { value: 500, known: true, computed: false, unit: 'V' }, supplyMin: { value: 0, known: true, computed: false, unit: 'V' }, supplyMax: { value: 5, known: true, computed: false, unit: 'V' }, outputClampBehavior: 'saturate' },
      { id: 'ldr-r', kind: 'passive2p', catalogTypeId: 'resistor', from: 'n-ldr', to: 'n-ref', label: 'R1', resistance: { value: 10000, known: true, computed: false, unit: 'Ω', constraints: { min: 0.001, nonZero: true } } }
    ]
  },
  hallSensorDemo: {
    nodes: [baseReferenceNode, { id: 'n-hall', x: 320, y: 180 }],
    components: [
      { id: 'hall-src', kind: 'sensor', catalogTypeId: 'sensor-hall', from: 'n-hall', to: 'n-ref', label: 'Hall', sensitivity: { value: 0.02, known: true, computed: false, unit: 'V' }, offset: { value: 1.65, known: true, computed: false, unit: 'V' }, inputSignal: { value: 10, known: true, computed: false, unit: 'V' }, supplyMin: { value: 0, known: true, computed: false, unit: 'V' }, supplyMax: { value: 3.3, known: true, computed: false, unit: 'V' }, outputClampBehavior: 'saturate' }
    ]
  },
  pressureSensorDemo: {
    nodes: [baseReferenceNode, { id: 'n-press', x: 320, y: 180 }],
    components: [
      { id: 'press-src', kind: 'sensor', catalogTypeId: 'sensor-pressure', from: 'n-press', to: 'n-ref', label: 'Press', sensitivity: { value: 0.045, known: true, computed: false, unit: 'V' }, offset: { value: 0.5, known: true, computed: false, unit: 'V' }, inputSignal: { value: 50, known: true, computed: false, unit: 'V' }, supplyMin: { value: 0, known: true, computed: false, unit: 'V' }, supplyMax: { value: 5, known: true, computed: false, unit: 'V' }, outputClampBehavior: 'saturate' }
    ]
  },
  microphoneSensorDemo: {
    nodes: [baseReferenceNode, { id: 'n-mic', x: 320, y: 180 }],
    components: [
      { id: 'mic-src', kind: 'sensor', catalogTypeId: 'sensor-microphone', from: 'n-mic', to: 'n-ref', label: 'Mic', sensitivity: { value: 0.25, known: true, computed: false, unit: 'V' }, offset: { value: 1.25, known: true, computed: false, unit: 'V' }, inputSignal: { value: 0.2, known: true, computed: false, unit: 'V' }, supplyMin: { value: 0, known: true, computed: false, unit: 'V' }, supplyMax: { value: 2.5, known: true, computed: false, unit: 'V' }, outputClampBehavior: 'saturate' }
    ]
  },
  analogSensorDemo: {
    nodes: [baseReferenceNode, { id: 'n-gs', x: 320, y: 180 }],
    components: [
      { id: 'gs-src', kind: 'sensor', catalogTypeId: 'sensor-analog-generic', from: 'n-gs', to: 'n-ref', label: 'Sensor', sensitivity: { value: 1.2, known: true, computed: false, unit: 'V' }, offset: { value: 0.3, known: true, computed: false, unit: 'V' }, inputSignal: { value: 1.5, known: true, computed: false, unit: 'V' }, supplyMin: { value: -5, known: true, computed: false, unit: 'V' }, supplyMax: { value: 5, known: true, computed: false, unit: 'V' }, outputClampBehavior: 'none' }
    ]
  }
};

export const cloneCircuit = (circuit: EditorCircuit): EditorCircuit => {
  const cloned = JSON.parse(JSON.stringify(circuit)) as EditorCircuit;
  cloned.subcircuits = cloned.subcircuits ?? [];
  return cloned;
};
