import { describe, expect, it } from 'vitest';
import { runAnalysis } from '../simulation';
import type { CircuitState } from '../model';

const rcLowPassCircuit: CircuitState = {
  nodes: [{ id: 'gnd', reference: true }, { id: 'vin' }, { id: 'vout' }],
  components: [
    {
      id: 'vs',
      kind: 'source2p',
        catalogTypeId: 'voltage-source',
      from: 'vin',
      to: 'gnd',
      voltage: { value: 1, known: true, computed: false, unit: 'V' }
    },
    {
      id: 'r1',
      kind: 'passive2p',
        catalogTypeId: 'resistor',
      from: 'vin',
      to: 'vout',
      resistance: { value: 1000, known: true, computed: false, unit: 'Ω', constraints: { nonZero: true } }
    },
    {
      id: 'c1',
      kind: 'passive2p',
        catalogTypeId: 'capacitor',
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

  it('emits support-tier diagnostics for partial and visual-only components by mode', () => {
    const supportTierCircuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }],
      components: [
        {
          id: 'ac1',
          kind: 'source2p',
          catalogTypeId: 'ac-voltage-source',
          from: 'n1',
          to: 'gnd',
          voltage: { value: 1, known: true, computed: false, unit: 'V' }
        },
        {
          id: 'cp1',
          kind: 'source2p',
          catalogTypeId: 'charge-pump',
          from: 'n1',
          to: 'gnd',
          voltage: { value: 5, known: true, computed: false, unit: 'V' }
        }
      ]
    };

    const dcResult = runAnalysis(supportTierCircuit);
    const acResult = runAnalysis(supportTierCircuit, { mode: 'ac', options: { startHz: 100, stopHz: 1000, points: 2 } });

    expect(dcResult.diagnostics.some((d) => d.code === 'unsupported_analysis_mode' && d.componentId === 'ac1')).toBe(true);
    expect(dcResult.diagnostics.some((d) => d.code === 'unsupported_analysis_mode' && d.componentId === 'cp1')).toBe(true);
    expect(acResult.diagnostics.some((d) => d.code === 'unsupported_analysis_mode' && d.componentId === 'cp1')).toBe(true);
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


describe('analysis capability gating', () => {
  it('keeps AC diagnostics empty for fully supported components', () => {
    const result = runAnalysis(rcLowPassCircuit, {
      mode: 'ac',
      options: { startHz: 10, stopHz: 1000, points: 3 }
    });

    expect(result.diagnostics.filter((diagnostic) => diagnostic.code === 'unsupported_analysis_mode')).toHaveLength(0);
  });

  it('returns actionable diagnostics for partially supported AC/transient circuits', () => {
    const mixedCircuit: CircuitState = {
      ...rcLowPassCircuit,
      components: [
        ...rcLowPassCircuit.components,
        {
          id: 'g1',
          kind: 'digital',
          catalogTypeId: 'logic-gate',
          from: 'vin',
          to: 'vout',
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

    const acResult = runAnalysis(mixedCircuit, { mode: 'ac', options: { startHz: 10, stopHz: 1000, points: 3 } });
    const transientResult = runAnalysis(mixedCircuit, { mode: 'transient', options: { timeStep: 1e-3, totalTime: 2e-3 } });

    expect(acResult.sweep).toHaveLength(3);
    expect(transientResult.waveform.length).toBeGreaterThan(0);
    expect(acResult.diagnostics.some((d) => d.code === 'unsupported_analysis_mode' && d.componentId === 'g1')).toBe(true);
    expect(transientResult.diagnostics.some((d) => d.code === 'unsupported_analysis_mode' && d.componentId === 'g1')).toBe(true);
    expect(acResult.diagnostics[0]?.message).toMatch(/replace it with an AC-supported equivalent model/i);
  });



  it('includes macro-model capability detail for analog amplifier-family blocks in AC analysis', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }],
      components: [
        {
          id: 'cmp1',
          kind: 'amplifier',
          catalogTypeId: 'comparator',
          from: 'n1',
          to: 'gnd',
          gain: { value: 100000, known: true, computed: false, unit: 'V' },
          outputLimitHigh: { value: 5, known: true, computed: false, unit: 'V' },
          outputLimitLow: { value: 0, known: true, computed: false, unit: 'V' },
          inputOffset: { value: 0.001, known: true, computed: false, unit: 'V' },
          bandwidthHz: { value: 1e6, known: true, computed: false, unit: 'Hz' }
        }
      ]
    };

    const acResult = runAnalysis(circuit, { mode: 'ac', options: { startHz: 10, stopHz: 1000, points: 3 } });
    const diag = acResult.diagnostics.find((d) => d.componentId === 'cmp1' && d.code === 'unsupported_analysis_mode');

    expect(diag).toBeDefined();
    expect(diag?.message).toMatch(/macro-model supports dc gain\/rail limiting only/i);
  });

  it('reports unsupported_analysis_mode when analysis has only unsupported behavior families', () => {
    const unsupportedCircuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'n1' }],
      components: [
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

    const acResult = runAnalysis(unsupportedCircuit, { mode: 'ac', options: { startHz: 1, stopHz: 10, points: 2 } });

    expect(acResult.diagnostics.some((d) => d.code === 'unsupported_analysis_mode')).toBe(true);
    expect(acResult.sweep).toHaveLength(2);
  });
});
