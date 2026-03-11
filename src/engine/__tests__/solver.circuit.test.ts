import { describe, expect, it } from 'vitest';
import { getDiagnosticGuidance, solveCircuit, solveCircuitForTarget } from '../solver';
import { simulateStep } from '../simulation';
import type { CircuitState } from '../model';
import { COMPONENT_CIRCUIT_FIXTURES } from './fixtures/components/circuitFixtures';

describe('solveCircuit canonical networks', () => {
  it('solves a canonical voltage-divider-like network branch currents', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }, { id: 'n2' }],
      components: [
        {
          id: 'vs',
          kind: 'source2p',
        catalogTypeId: 'voltage-source',
          from: 'n1',
          to: 'gnd',
          voltage: { value: 12, known: true, computed: false, unit: 'V' }
        },
        {
          id: 'r1',
          kind: 'passive2p',
        catalogTypeId: 'resistor',
          from: 'n1',
          to: 'n2',
          resistance: { value: 4, known: true, computed: false, unit: 'Ω', constraints: { nonZero: true } }
        },
        {
          id: 'r2',
          kind: 'passive2p',
        catalogTypeId: 'resistor',
          from: 'n2',
          to: 'gnd',
          resistance: { value: 2, known: true, computed: false, unit: 'Ω', constraints: { nonZero: true } }
        }
      ]
    };

    const result = solveCircuit(circuit);

    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toHaveLength(0);
    expect(result.values['node:n1:voltage']?.value).toBeCloseTo(12, 6);
    expect(result.values['node:n2:voltage']?.value).toBeCloseTo(-12, 6);
    expect(Math.abs(result.values['component:r1:current']?.value ?? 0)).toBeCloseTo(6, 6);
    expect(Math.abs(result.values['component:r2:current']?.value ?? 0)).toBeCloseTo(6, 6);
  });

  it('solves parallel resistor network branch currents', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }],
      components: [
        {
          id: 'vs',
          kind: 'source2p',
        catalogTypeId: 'voltage-source',
          from: 'n1',
          to: 'gnd',
          voltage: { value: 12, known: true, computed: false, unit: 'V' }
        },
        {
          id: 'r1',
          kind: 'passive2p',
        catalogTypeId: 'resistor',
          from: 'n1',
          to: 'gnd',
          resistance: { value: 6, known: true, computed: false, unit: 'Ω', constraints: { nonZero: true } }
        },
        {
          id: 'r2',
          kind: 'passive2p',
        catalogTypeId: 'resistor',
          from: 'n1',
          to: 'gnd',
          resistance: { value: 3, known: true, computed: false, unit: 'Ω', constraints: { nonZero: true } }
        }
      ]
    };

    const result = solveCircuit(circuit);

    expect(result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error')).toHaveLength(0);
    expect(result.values['component:r1:current']?.value).toBeCloseTo(2, 6);
    expect(result.values['component:r2:current']?.value).toBeCloseTo(4, 6);
  });
});

describe('solveCircuit diagnostics', () => {
  it('detects underdetermined system when topology is unconstrained', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }],
      components: [
        {
          id: 'c1',
          kind: 'passive2p',
        catalogTypeId: 'capacitor',
          from: 'n1',
          to: 'gnd',
          capacitance: { value: 2e-6, known: true, computed: false, unit: 'F' }
        }
      ]
    };

    const result = solveCircuit(circuit);

    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'underdetermined')).toBe(true);
  });

  it('detects inconsistent equations with conflicting voltage sources', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }],
      components: [
        {
          id: 'vs-5',
          kind: 'source2p',
        catalogTypeId: 'voltage-source',
          from: 'n1',
          to: 'gnd',
          voltage: { value: 5, known: true, computed: false, unit: 'V' }
        },
        {
          id: 'vs-9',
          kind: 'source2p',
        catalogTypeId: 'voltage-source',
          from: 'n1',
          to: 'gnd',
          voltage: { value: 9, known: true, computed: false, unit: 'V' }
        }
      ]
    };

    const result = solveCircuit(circuit);

    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'overdetermined')).toBe(true);
  });


  it('reports missing constitutive value for active/reactive part', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }],
      components: [
        {
          id: 'l1',
          kind: 'passive2p',
        catalogTypeId: 'inductor',
          from: 'n1',
          to: 'gnd',
          inductance: { known: true, computed: false, unit: 'H' }
        }
      ]
    };

    const result = solveCircuit(circuit);

    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'missing_constitutive_value')).toBe(true);
  });

  it('emits floating node group hint when graph is disconnected', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }, { id: 'n2' }, { id: 'n3' }],
      components: [
        {
          id: 'r1',
          kind: 'passive2p',
        catalogTypeId: 'resistor',
          from: 'n1',
          to: 'gnd',
          resistance: { value: 10, known: true, computed: false, unit: 'Ω' }
        },
        {
          id: 'r2',
          kind: 'passive2p',
        catalogTypeId: 'resistor',
          from: 'n2',
          to: 'n3',
          resistance: { value: 5, known: true, computed: false, unit: 'Ω' }
        }
      ]
    };

    const result = solveCircuit(circuit);

    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'floating_node_groups')).toBe(true);
  });

  it('maps structural diagnostic to user action guidance', () => {
    const guidance = getDiagnosticGuidance({
      code: 'underdetermined',
      severity: 'error',
      message: 'x'
    });

    expect(guidance?.why).toMatch(/fewer independent equations/i);
    expect(guidance?.suggestedFix).toMatch(/add grounding/i);
  });

  it('reports invalid units and value constraint violations', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }],
      components: [
        {
          id: 'r-bad',
          kind: 'passive2p',
        catalogTypeId: 'resistor',
          from: 'n1',
          to: 'gnd',
          resistance: { value: 0, known: true, computed: false, unit: 'V', constraints: { nonZero: true, min: 0.1 } }
        }
      ]
    };

    const result = solveCircuit(circuit);

    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'invalid_unit')).toBe(true);
    expect(result.diagnostics.filter((diagnostic) => diagnostic.code === 'constraint_violation')).toHaveLength(2);
  });
});


describe('simulation helpers', () => {
  it('computes RC-like step current from voltage and equivalent resistance', () => {
    const step = simulateStep({ voltage: 5, resistance: 1000 }, 0.001);

    expect(step.current).toBeCloseTo(0.005, 9);
    expect(step.time).toBe(0.001);
  });
});


describe('solveCircuit target solving', () => {
  it('returns target value, dependencies and uniqueness for a solvable target', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }],
      components: [
        {
          id: 'vs',
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

    const result = solveCircuitForTarget(circuit, { type: 'component_current', componentId: 'r1' });

    expect(result.target?.value).toBeCloseTo(2, 6);
    expect(result.target?.unique).toBe(true);
    expect(result.target?.dependencies).toContain('component:r1');
  });

  it('emits focused non-unique target diagnostic for underdetermined solve', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }],
      components: [
        {
          id: 'c1',
          kind: 'passive2p',
        catalogTypeId: 'capacitor',
          from: 'n1',
          to: 'gnd',
          capacitance: { value: 2e-6, known: true, computed: false, unit: 'F' }
        }
      ]
    };

    const result = solveCircuitForTarget(circuit, { type: 'node_voltage', nodeId: 'n1' });

    expect(result.diagnostics.some((diagnostic) => diagnostic.code === 'target_non_unique')).toBe(true);
    expect(result.target?.unique).toBe(false);
  });
});


describe('fixture-driven component family circuits', () => {
  it.each(COMPONENT_CIRCUIT_FIXTURES)('solves fixture $name', ({ circuit, expectations }) => {
    const result = solveCircuit(circuit);

    for (const code of expectations.diagnosticCodes ?? []) {
      expect(result.diagnostics.some((diagnostic) => diagnostic.code === code)).toBe(true);
    }

    for (const key of expectations.valueKeys ?? []) {
      expect(result.values[key]).toBeDefined();
      expect(result.values[key]?.value).toBeTypeOf('number');
    }
  });
});

describe('monte carlo capability gating', () => {
  it('runs Monte Carlo for supported components without unsupported diagnostics', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }],
      components: [
        {
          id: 'vs',
          kind: 'source2p',
          catalogTypeId: 'voltage-source',
          from: 'n1',
          to: 'gnd',
          voltage: { value: 5, known: true, computed: false, unit: 'V' }
        },
        {
          id: 'r1',
          kind: 'passive2p',
          catalogTypeId: 'resistor',
          from: 'n1',
          to: 'gnd',
          resistance: { value: 100, known: true, computed: false, unit: 'Ω', tolerancePct: 1 }
        }
      ]
    };

    const result = solveCircuit(circuit, { monteCarlo: { runs: 5, seed: 7 } });

    expect(result.monteCarlo?.runs).toBe(5);
    expect(result.diagnostics.filter((d) => d.code === 'unsupported_component_behavior')).toHaveLength(0);
  });

  it('emits unsupported behavior diagnostics but still solves supported subset in Monte Carlo', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }],
      components: [
        {
          id: 'vs',
          kind: 'source2p',
          catalogTypeId: 'voltage-source',
          from: 'n1',
          to: 'gnd',
          voltage: { value: 5, known: true, computed: false, unit: 'V' }
        },
        {
          id: 'g1',
          kind: 'digital',
          catalogTypeId: 'logic-gate',
          from: 'n1',
          to: 'gnd',
          gateType: 'not',
          bridge: {
            highThreshold: { value: 3, known: true, computed: false, unit: 'V' },
            lowThreshold: { value: 1, known: true, computed: false, unit: 'V' },
            highLevel: { value: 5, known: true, computed: false, unit: 'V' },
            lowLevel: { value: 0, known: true, computed: false, unit: 'V' }
          }
        }
      ]
    };

    const result = solveCircuit(circuit, { monteCarlo: { runs: 4, seed: 3 } });

    expect(result.values['node:n1:voltage']?.value).toBeCloseTo(5, 6);
    expect(result.diagnostics.some((d) => d.code === 'unsupported_component_behavior' && d.componentId === 'g1')).toBe(true);
    expect(result.diagnostics.some((d) => /exclude this component from monte carlo/i.test(d.message))).toBe(true);
  });
});
