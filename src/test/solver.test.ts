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
          kind: 'source2p',
        catalogTypeId: 'voltage-source',
          from: 'n1',
          to: 'gnd',
          voltage: { value: 10, known: true, computed: false, unit: 'V' }
        },
        {
          id: 'r1',
          kind: 'passive2p',
        catalogTypeId: 'resistor',
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
    expect(result.equationTrace?.length).toBeGreaterThan(0);
    expect(result.equationTrace?.some((row) => row.rowType === 'kcl' && row.kclNodeId === 'n1')).toBe(true);
    expect(result.equationTrace?.some((row) => row.constrainedComponentId === 'vs1')).toBe(true);
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
          kind: 'passive2p',
        catalogTypeId: 'capacitor',
          from: 'n1',
          to: 'gnd',
          capacitance: { value: 1e-6, known: true, computed: false, unit: 'F' }
        }
      ]
    };

    const result = solveCircuit(circuit);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'underdetermined')).toBe(true);
  });

  it('generates deterministic monte carlo distributions when seed is provided', () => {
    const circuit: CircuitState = {
      nodes: [
        { id: 'gnd', reference: true },
        { id: 'n1' }
      ],
      components: [
        {
          id: 'vs1',
          kind: 'source2p',
        catalogTypeId: 'voltage-source',
          from: 'n1',
          to: 'gnd',
          voltage: { value: 10, known: true, computed: false, unit: 'V' }
        },
        {
          id: 'r1',
          kind: 'passive2p',
        catalogTypeId: 'resistor',
          from: 'n1',
          to: 'gnd',
          resistance: {
            value: 5,
            known: true,
            computed: false,
            unit: 'Ω',
            tolerancePct: 10,
            tempcoPpm: 100,
            nominalTempC: 25,
            operatingTempC: 45
          }
        }
      ]
    };

    const first = solveCircuit(circuit, { monteCarlo: { runs: 20, seed: 1234 } });
    const second = solveCircuit(circuit, { monteCarlo: { runs: 20, seed: 1234 } });

    const key = 'component:r1:current';
    expect(first.monteCarlo?.targetDistributions[key]?.samples).toEqual(second.monteCarlo?.targetDistributions[key]?.samples);
    expect(first.monteCarlo?.targetDistributions[key]?.stats.std).toBeGreaterThan(0);
  });

  it('emits diagnostics for invalid tolerance/tempco metadata', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }],
      components: [
        {
          id: 'is1',
          kind: 'source2p',
        catalogTypeId: 'current-source',
          from: 'gnd',
          to: 'gnd',
          current: {
            value: 1,
            known: true,
            computed: false,
            unit: 'A',
            tolerancePct: -1,
            tempcoPpm: Number.NaN,
            nominalTempC: 25
          }
        }
      ]
    };

    const result = solveCircuit(circuit, { monteCarlo: { runs: 5, seed: 7 } });
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'invalid_tolerance')).toBe(true);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'invalid_tempco')).toBe(true);
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'inconsistent_temperature')).toBe(true);
  });
});
