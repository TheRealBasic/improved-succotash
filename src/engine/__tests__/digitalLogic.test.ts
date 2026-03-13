import { describe, expect, it } from 'vitest';
import type { CircuitState } from '../model';
import { solveCircuit } from '../solver';
import { runAnalysis } from '../simulation';

const baseNodes = [{ id: 'gnd', reference: true }, { id: 'in' }];

describe('digital truth-table and threshold behavior', () => {
  it('uses pull-up default when input is in the undefined threshold band', () => {
    const circuit: CircuitState = {
      nodes: baseNodes,
      components: [
        {
          id: 'vin',
          kind: 'source2p',
          catalogTypeId: 'voltage-source',
          from: 'in',
          to: 'gnd',
          voltage: { value: 2.2, known: true, computed: false, unit: 'V' }
        },
        {
          id: 'buf1',
          kind: 'digital',
          catalogTypeId: 'logic-buffer',
          from: 'in',
          to: 'gnd',
          gateType: 'or',
          logicFamily: 'HC',
          pullDefault: 'pull-up',
          propagationDelayNs: { value: 8, known: true, computed: false, unit: 'ns' },
          bridge: {
            highThreshold: { value: 3, known: true, computed: false, unit: 'V' },
            lowThreshold: { value: 1.5, known: true, computed: false, unit: 'V' },
            highLevel: { value: 5, known: true, computed: false, unit: 'V' },
            lowLevel: { value: 0, known: true, computed: false, unit: 'V' }
          }
        }
      ]
    };

    const result = solveCircuit(circuit);
    expect(result.values['component:buf1:logic_output']?.value).toBeCloseTo(5, 6);
  });

  it('inverts output for NOT-like abstractions when above high threshold', () => {
    const circuit: CircuitState = {
      nodes: baseNodes,
      components: [
        {
          id: 'vin',
          kind: 'source2p',
          catalogTypeId: 'voltage-source',
          from: 'in',
          to: 'gnd',
          voltage: { value: 4.5, known: true, computed: false, unit: 'V' }
        },
        {
          id: 'sch1',
          kind: 'digital',
          catalogTypeId: 'logic-schmitt-trigger',
          from: 'in',
          to: 'gnd',
          gateType: 'not',
          pullDefault: 'pull-down',
          propagationDelayNs: { value: 12, known: true, computed: false, unit: 'ns' },
          bridge: {
            highThreshold: { value: 3.1, known: true, computed: false, unit: 'V' },
            lowThreshold: { value: 1.2, known: true, computed: false, unit: 'V' },
            highLevel: { value: 5, known: true, computed: false, unit: 'V' },
            lowLevel: { value: 0, known: true, computed: false, unit: 'V' }
          }
        }
      ]
    };

    const result = solveCircuit(circuit);
    expect(result.values['component:sch1:logic_output']?.value).toBeCloseTo(0, 6);
  });
});

describe('digital timing diagnostics', () => {
  it('emits targeted transient diagnostics for edge/timing abstractions', () => {
    const circuit: CircuitState = {
      nodes: [{ id: 'gnd', reference: true }, { id: 'clk' }],
      components: [
        {
          id: 'vclk',
          kind: 'source2p',
          catalogTypeId: 'pulse-voltage-source',
          from: 'clk',
          to: 'gnd',
          voltage: { value: 5, known: true, computed: false, unit: 'V' }
        },
        {
          id: 'ff1',
          kind: 'digital',
          catalogTypeId: 'logic-flip-flop',
          from: 'clk',
          to: 'gnd',
          gateType: 'or',
          pullDefault: 'none',
          propagationDelayNs: { value: 18, known: true, computed: false, unit: 'ns' },
          bridge: {
            highThreshold: { value: 3, known: true, computed: false, unit: 'V' },
            lowThreshold: { value: 1, known: true, computed: false, unit: 'V' },
            highLevel: { value: 5, known: true, computed: false, unit: 'V' },
            lowLevel: { value: 0, known: true, computed: false, unit: 'V' }
          }
        }
      ]
    };

    const analysis = runAnalysis(circuit, { mode: 'transient', options: { timeStep: 1e-6, totalTime: 5e-6 } });
    expect(analysis.diagnostics.some((d) => d.code === 'unsupported_digital_timing' && d.componentId === 'ff1')).toBe(true);
  });
});
