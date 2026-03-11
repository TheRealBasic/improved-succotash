import { describe, expect, it } from 'vitest';
import { runAnalysis } from '../simulation';
import type { CircuitState } from '../model';

const rcLowPassCircuit: CircuitState = {
  nodes: [{ id: 'gnd', reference: true }, { id: 'vin' }, { id: 'vout' }],
  components: [
    {
      id: 'vs',
      kind: 'voltageSource',
      from: 'vin',
      to: 'gnd',
      voltage: { value: 1, known: true, computed: false, unit: 'V' }
    },
    {
      id: 'r1',
      kind: 'resistor',
      from: 'vin',
      to: 'vout',
      resistance: { value: 1000, known: true, computed: false, unit: 'Ω', constraints: { nonZero: true } }
    },
    {
      id: 'c1',
      kind: 'capacitor',
      from: 'vout',
      to: 'gnd',
      capacitance: { value: 1e-6, known: true, computed: false, unit: 'F' }
    }
  ]
};

describe('runAnalysis AC mode', () => {
  it('produces expected low-pass magnitude trend for RC filter', () => {
    const result = runAnalysis(rcLowPassCircuit, {
      mode: 'ac',
      options: { startHz: 10, stopHz: 10000, points: 6 }
    });

    expect(result.mode).toBe('ac');
    const sweep = result.sweep;
    const low = sweep[0]?.magnitude.vout ?? 0;
    const high = sweep[sweep.length - 1]?.magnitude.vout ?? 0;

    expect(low).toBeGreaterThan(0.95);
    expect(high).toBeLessThan(0.05);
    expect(high).toBeLessThan(low);
  });
});

describe('runAnalysis transient mode', () => {
  it('produces RC step response waveform that rises toward source voltage', () => {
    const result = runAnalysis(rcLowPassCircuit, {
      mode: 'transient',
      options: {
        timeStep: 1e-3,
        totalTime: 10e-3,
        sourceSteps: {
          vs: { before: 0, after: 5, at: 1e-3 }
        }
      }
    });

    expect(result.mode).toBe('transient');
    const waveform = result.waveform;
    const first = waveform[0]?.nodeVoltages.vout ?? 0;
    const second = waveform[1]?.nodeVoltages.vout ?? 0;
    const final = waveform[waveform.length - 1]?.nodeVoltages.vout ?? 0;

    expect(first).toBeCloseTo(0, 9);
    expect(second).toBeGreaterThan(first);
    expect(final).toBeGreaterThan(4.9);
    expect(final).toBeLessThanOrEqual(5.001);
  });
});
