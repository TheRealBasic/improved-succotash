import { describe, expect, it } from 'vitest';
import { runAnalysis } from '../simulation';
import { solveCircuit } from '../solver';
import type { CircuitState } from '../model';

const sensorCircuit = (overrides: Partial<Extract<CircuitState['components'][number], { kind: 'sensor' }>> = {}): CircuitState => {
  const sensor: Extract<CircuitState['components'][number], { kind: 'sensor' }> = {
    id: 's1',
    kind: 'sensor',
    catalogTypeId: 'sensor-analog-generic',
    from: 'n1',
    to: 'gnd',
    sensitivity: { value: 2, known: true, computed: false, unit: 'V' },
    offset: { value: 1, known: true, computed: false, unit: 'V' },
    inputSignal: { value: 3, known: true, computed: false, unit: 'V' },
    supplyMin: { value: 0, known: true, computed: false, unit: 'V' },
    supplyMax: { value: 5, known: true, computed: false, unit: 'V' },
    outputClampBehavior: 'saturate',
    ...overrides
  };

  return {
    nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }],
    components: [sensor]
  };
};

describe('sensor transfer model', () => {
  it('maps sensitivity/offset/input to clamped DC output', () => {
    const result = solveCircuit(sensorCircuit());
    expect(result.values['node:n1:voltage']?.value).toBeCloseTo(5, 9);
  });

  it('keeps unclamped output when clamp behavior is none', () => {
    const result = solveCircuit(sensorCircuit({ outputClampBehavior: 'none' }));
    expect(result.values['node:n1:voltage']?.value).toBeCloseTo(7, 9);
  });

  it('emits diagnostic for invalid supply ranges', () => {
    const result = solveCircuit(
      sensorCircuit({
        supplyMin: { value: 5, known: true, computed: false, unit: 'V' },
        supplyMax: { value: 3, known: true, computed: false, unit: 'V' }
      })
    );

    expect(result.diagnostics.some((d) => d.code === 'constraint_violation' && d.componentId === 's1')).toBe(true);
  });

  it('supports AC and transient analyses without unsupported mode diagnostics', () => {
    const circuit = sensorCircuit();
    const ac = runAnalysis(circuit, { mode: 'ac', options: { startHz: 1, stopHz: 10, points: 2 } });
    const tr = runAnalysis(circuit, { mode: 'transient', options: { timeStep: 1e-3, totalTime: 2e-3 } });

    expect(ac.diagnostics.some((d) => d.code === 'unsupported_analysis_mode')).toBe(false);
    expect(tr.diagnostics.some((d) => d.code === 'unsupported_analysis_mode')).toBe(false);
    expect(ac.sweep[0]?.magnitude.n1).toBeGreaterThan(0);
    expect(tr.waveform[0]?.nodeVoltages.n1).toBeCloseTo(5, 9);
  });
});
