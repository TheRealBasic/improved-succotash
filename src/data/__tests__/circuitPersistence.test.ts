import type { EditorCircuit } from '../presets';
import { describe, expect, it } from 'vitest';
import { deserializeCircuit, serializeCircuit } from '../circuitPersistence';

const legacyCircuitPayload = JSON.stringify({
  nodes: [
    { id: 'gnd', x: 10, y: 20, isReference: true },
    { id: 'n1', x: 100, y: 20 }
  ],
  components: [
    {
      id: 'r1',
      type: 'resistor',
      src: 'n1',
      dst: 'gnd',
      label: 'R1',
      ohms: 220
    },
    {
      id: 'v1',
      type: 'voltageSource',
      src: 'n1',
      dst: 'gnd',
      volts: 9
    }
  ]
});

describe('circuit persistence migrations', () => {
  it('loads a legacy unversioned circuit payload', () => {
    const loaded = deserializeCircuit(legacyCircuitPayload);

    expect(loaded.nodes[0].reference).toBe(true);
    expect(loaded.components[0].catalogTypeId).toBe('resistor');
    expect(loaded.components[0]).toMatchObject({ from: 'n1', to: 'gnd' });
    expect(loaded.components[1].catalogTypeId).toBe('voltage-source');
    expect(loaded.components[1]).toHaveProperty('nonIdeal');
    expect(loaded.subcircuits).toEqual([]);
  });

  it('falls back unknown components to wire placeholders', () => {
    const loaded = deserializeCircuit(
      JSON.stringify({
        schemaVersion: 2,
        circuit: {
          nodes: [
            { id: 'a', x: 0, y: 0 },
            { id: 'b', x: 10, y: 0 }
          ],
          components: [{ id: 'x1', type: 'quantumBridge', src: 'a', dst: 'b' }]
        }
      })
    );

    expect(loaded.components).toHaveLength(1);
    expect(loaded.components[0]).toMatchObject({
      id: 'x1',
      catalogTypeId: 'wire',
      kind: 'passive2p',
      from: 'a',
      to: 'b'
    });
  });

  it('round-trips a modern payload without losing fidelity', () => {
    const source: EditorCircuit = {
      nodes: [
        { id: 'gnd', x: 10, y: 20, reference: true },
        { id: 'n1', x: 50, y: 30 }
      ],
      components: [
        {
          id: 'i1',
          kind: 'source2p',
          catalogTypeId: 'current-source',
          from: 'n1',
          to: 'gnd',
          label: 'I1',
          current: { value: 0.01, known: true, computed: false, unit: 'A' as const },
          nonIdeal: {
            internalResistance: { value: 5, known: true, computed: false, unit: 'Ω' as const },
            rippleAmplitude: { value: 0.001, known: true, computed: false, unit: 'A' as const },
            rippleFrequencyHz: { value: 60, known: true, computed: false, unit: 'Hz' as const }
          }
        }
      ],
      subcircuits: []
    };

    const roundTripped = deserializeCircuit(serializeCircuit(source));
    expect(roundTripped).toEqual(source);
  });
});
