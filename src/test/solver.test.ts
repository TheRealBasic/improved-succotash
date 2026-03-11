import { describe, expect, it } from 'vitest';
import { solveCircuit, solveCircuitValues } from '../engine/solver';
import type { CircuitState } from '../engine/model';

describe('solveCircuitValues', () => {
  it('solves current from voltage and resistance', () => {
    const result = solveCircuitValues({ voltage: 12, resistance: 6 });
    expect(result.current).toBe(2);
  });
});

describe('solveCircuit', () => {
  it('solves a single resistor + voltage source circuit', () => {
    const circuit: CircuitState = {
      nodes: [
        { id: 'gnd', reference: true },
        { id: 'n1' }
      ],
      components: [
        {
          id: 'vs1',
          kind: 'voltageSource',
          from: 'n1',
          to: 'gnd',
          voltage: { value: 10, known: true, computed: false, unit: 'V' }
        },
        {
          id: 'r1',
          kind: 'resistor',
          from: 'n1',
          to: 'gnd',
          resistance: { value: 5, known: true, computed: false, unit: 'Ω', constraints: { nonZero: true } }
        }
      ]
    };

    const result = solveCircuit(circuit);
    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toHaveLength(0);
    expect(result.values['node:n1:voltage']?.value).toBeCloseTo(10, 6);
    expect(result.values['component:r1:current']?.value).toBeCloseTo(2, 6);
  });

  it('reports underdetermined for missing constitutive constraints', () => {
    const circuit: CircuitState = {
      nodes: [
        { id: 'gnd', reference: true },
        { id: 'n1' }
      ],
      components: [
        {
          id: 'c1',
          kind: 'capacitor',
          from: 'n1',
          to: 'gnd',
          capacitance: { value: 1e-6, known: true, computed: false, unit: 'F' }
        }
      ]
    };

    const result = solveCircuit(circuit);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'underdetermined')).toBe(true);
  });
});
