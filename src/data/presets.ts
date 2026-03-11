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
        kind: 'voltageSource',
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
        kind: 'voltageSource',
        from: 'n-top',
        to: 'n-ref',
        label: 'V1',
        voltage: { value: 12, known: true, computed: false, unit: 'V', constraints: { nonZero: true } }
      },
      {
        id: 'vd-r1',
        kind: 'resistor',
        from: 'n-top',
        to: 'n-mid',
        label: 'R1',
        resistance: { value: 1000, known: true, computed: false, unit: 'Ω', constraints: { min: 0.001, nonZero: true } }
      },
      {
        id: 'vd-r2',
        kind: 'resistor',
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
        kind: 'currentSource',
        from: 'n-right',
        to: 'n-ref',
        label: 'I1',
        current: { value: 0.02, known: true, computed: false, unit: 'A' }
      },
      {
        id: 'cl-r1',
        kind: 'resistor',
        from: 'n-right',
        to: 'n-ref',
        label: 'R1',
        resistance: { value: 470, known: true, computed: false, unit: 'Ω', constraints: { min: 0.001, nonZero: true } }
      }
    ]
  }
};

export const cloneCircuit = (circuit: EditorCircuit): EditorCircuit => {
  const cloned = JSON.parse(JSON.stringify(circuit)) as EditorCircuit;
  cloned.subcircuits = cloned.subcircuits ?? [];
  return cloned;
};
