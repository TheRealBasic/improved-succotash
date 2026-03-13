import type { CanvasNodePosition } from '../components/CircuitCanvas';
import type { CircuitComponent, ComponentCatalogTypeId, Unit, ValueMetadata } from '../engine/model';
import type { EditorCircuit } from './presets';

export const CIRCUIT_SCHEMA_VERSION = 2;

type PersistedCircuitEnvelope = {
  schemaVersion: number;
  circuit: unknown;
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined => (value && typeof value === 'object' ? (value as UnknownRecord) : undefined);

const asNumber = (value: unknown): number | undefined => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const asString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const createValueMetadata = (unit: Unit, value: number, constraints?: ValueMetadata['constraints']): ValueMetadata => ({
  value,
  unit,
  known: true,
  computed: false,
  constraints
});

const getCatalogTypeId = (value: unknown): ComponentCatalogTypeId | undefined => {
  switch (value) {
    case 'resistor':
    case 'capacitor':
    case 'inductor':
    case 'voltage-source':
    case 'current-source':
    case 'diode':
    case 'bjt':
    case 'mosfet':
    case 'op-amp':
    case 'logic-gate':
    case 'wire':
      return value;
    default:
      return undefined;
  }
};

const normalizeCatalogTypeId = (value: unknown): ComponentCatalogTypeId | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const renamed =
    value === 'voltageSource'
      ? 'voltage-source'
      : value === 'currentSource'
        ? 'current-source'
        : value === 'opAmp'
          ? 'op-amp'
          : value === 'logicGate'
            ? 'logic-gate'
            : value;

  return getCatalogTypeId(renamed);
};

const normalizeValueMetadata = (value: unknown, unit: Unit, defaultValue: number, constraints?: ValueMetadata['constraints']): ValueMetadata => {
  if (typeof value === 'number') {
    return createValueMetadata(unit, value, constraints);
  }

  const record = asRecord(value);
  return {
    value: asNumber(record?.value) ?? defaultValue,
    known: typeof record?.known === 'boolean' ? record.known : true,
    computed: typeof record?.computed === 'boolean' ? record.computed : false,
    unit: (record?.unit as Unit | undefined) ?? unit,
    constraints: (record?.constraints as ValueMetadata['constraints'] | undefined) ?? constraints,
    tolerancePct: asNumber(record?.tolerancePct),
    tempcoPpm: asNumber(record?.tempcoPpm),
    nominalTempC: asNumber(record?.nominalTempC),
    operatingTempC: asNumber(record?.operatingTempC)
  };
};

const fallbackComponent = (id: string, from: string, to: string): CircuitComponent => ({
  id,
  from,
  to,
  kind: 'passive2p',
  catalogTypeId: 'wire',
  label: `Unknown (${id})`
});

const normalizeComponent = (component: unknown): CircuitComponent | undefined => {
  const record = asRecord(component);
  if (!record) {
    return undefined;
  }

  const id = asString(record.id) ?? `cmp-${Math.random().toString(36).slice(2, 9)}`;
  const from = asString(record.from ?? record.src) ?? 'n-a';
  const to = asString(record.to ?? record.dst) ?? 'n-ref';
  const catalogTypeId = normalizeCatalogTypeId(record.catalogTypeId ?? record.type);

  if (!catalogTypeId) {
    return fallbackComponent(id, from, to);
  }

  switch (catalogTypeId) {
    case 'resistor':
      return {
        id,
        from,
        to,
        kind: 'passive2p',
        catalogTypeId,
        label: asString(record.label) ?? `R-${id}`,
        resistance: normalizeValueMetadata(record.resistance ?? record.ohms, 'Ω', 100, { min: 0.001, nonZero: true })
      };
    case 'capacitor':
      return {
        id,
        from,
        to,
        kind: 'passive2p',
        catalogTypeId,
        label: asString(record.label) ?? `C-${id}`,
        capacitance: normalizeValueMetadata(record.capacitance ?? record.farads, 'F', 0.000001, { min: 0 })
      };
    case 'inductor':
      return {
        id,
        from,
        to,
        kind: 'passive2p',
        catalogTypeId,
        label: asString(record.label) ?? `L-${id}`,
        inductance: normalizeValueMetadata(record.inductance ?? record.henries, 'H', 0.01, { min: 0 })
      };
    case 'voltage-source':
      return {
        id,
        from,
        to,
        kind: 'source2p',
        catalogTypeId,
        label: asString(record.label) ?? `V-${id}`,
        voltage: normalizeValueMetadata(record.voltage ?? record.volts, 'V', 5, { nonZero: true }),
        nonIdeal: {
          internalResistance: normalizeValueMetadata(asRecord(record.nonIdeal)?.internalResistance, 'Ω', 0),
          rippleAmplitude: normalizeValueMetadata(asRecord(record.nonIdeal)?.rippleAmplitude, 'V', 0),
          rippleFrequencyHz: normalizeValueMetadata(asRecord(record.nonIdeal)?.rippleFrequencyHz, 'Hz', 0)
        }
      };
    case 'current-source':
      return {
        id,
        from,
        to,
        kind: 'source2p',
        catalogTypeId,
        label: asString(record.label) ?? `I-${id}`,
        current: normalizeValueMetadata(record.current ?? record.amps, 'A', 0.01),
        nonIdeal: {
          internalResistance: normalizeValueMetadata(asRecord(record.nonIdeal)?.internalResistance, 'Ω', 0),
          rippleAmplitude: normalizeValueMetadata(asRecord(record.nonIdeal)?.rippleAmplitude, 'A', 0),
          rippleFrequencyHz: normalizeValueMetadata(asRecord(record.nonIdeal)?.rippleFrequencyHz, 'Hz', 0)
        }
      };
    case 'diode':
      return {
        id,
        from,
        to,
        kind: 'switch',
        catalogTypeId,
        label: asString(record.label) ?? `D-${id}`,
        forwardDrop: normalizeValueMetadata(record.forwardDrop ?? record.vf, 'V', 0.7),
        onResistance: normalizeValueMetadata(record.onResistance ?? record.rOn, 'Ω', 10, { min: 0.001, nonZero: true }),
        offResistance: normalizeValueMetadata(record.offResistance ?? record.rOff, 'Ω', 1_000_000, { min: 1 })
      };
    case 'bjt':
      return {
        id,
        from,
        to,
        kind: 'switch',
        catalogTypeId,
        label: asString(record.label) ?? `Q-${id}`,
        beta: normalizeValueMetadata(record.beta ?? record.hfe, 'A', 100),
        vbeOn: normalizeValueMetadata(record.vbeOn ?? record.vbe, 'V', 0.7)
      };
    case 'mosfet':
      return {
        id,
        from,
        to,
        kind: 'switch',
        catalogTypeId,
        label: asString(record.label) ?? `M-${id}`,
        thresholdVoltage: normalizeValueMetadata(record.thresholdVoltage ?? record.vth, 'V', 2),
        onResistance: normalizeValueMetadata(record.onResistance ?? record.ron, 'Ω', 5, { min: 0.001, nonZero: true })
      };
    case 'op-amp':
      return {
        id,
        from,
        to,
        kind: 'amplifier',
        catalogTypeId,
        label: asString(record.label) ?? `U-${id}`,
        gain: normalizeValueMetadata(record.gain, 'V', 100000),
        outputLimitHigh: normalizeValueMetadata(record.outputLimitHigh, 'V', 12),
        outputLimitLow: normalizeValueMetadata(record.outputLimitLow, 'V', -12)
      };
    case 'logic-gate':
      return {
        id,
        from,
        to,
        kind: 'digital',
        catalogTypeId,
        label: asString(record.label) ?? `G-${id}`,
        gateType: (asString(record.gateType ?? record.type) as 'and' | 'or' | 'not' | 'nand' | 'nor' | 'xor' | undefined) ?? 'not',
        bridge: {
          highThreshold: normalizeValueMetadata(asRecord(record.bridge)?.highThreshold, 'V', 3),
          lowThreshold: normalizeValueMetadata(asRecord(record.bridge)?.lowThreshold, 'V', 1),
          highLevel: normalizeValueMetadata(asRecord(record.bridge)?.highLevel, 'V', 5),
          lowLevel: normalizeValueMetadata(asRecord(record.bridge)?.lowLevel, 'V', 0)
        }
      };
    case 'wire':
      return {
        id,
        from,
        to,
        kind: 'passive2p',
        catalogTypeId,
        label: asString(record.label) ?? 'wire'
      };
  }
};

const normalizeNode = (node: unknown): CanvasNodePosition | undefined => {
  const record = asRecord(node);
  if (!record) {
    return undefined;
  }

  const id = asString(record.id);
  const x = asNumber(record.x);
  const y = asNumber(record.y);

  if (!id || x === undefined || y === undefined) {
    return undefined;
  }

  return {
    id,
    x,
    y,
    reference: typeof record.reference === 'boolean' ? record.reference : typeof record.isReference === 'boolean' ? record.isReference : undefined,
    groupId: asString(record.groupId)
  };
};

export const normalizeCircuit = (value: unknown): EditorCircuit => {
  const record = asRecord(value);
  const nodes = Array.isArray(record?.nodes) ? record.nodes.map(normalizeNode).filter((node): node is CanvasNodePosition => Boolean(node)) : [];
  const components = Array.isArray(record?.components)
    ? record.components.map(normalizeComponent).filter((component): component is CircuitComponent => Boolean(component))
    : [];
  const subcircuits = Array.isArray(record?.subcircuits) ? (record.subcircuits as EditorCircuit['subcircuits']) : [];

  return {
    nodes,
    components,
    subcircuits
  };
};

const migratePersistedCircuit = (payload: unknown): EditorCircuit => {
  const envelope = asRecord(payload) as PersistedCircuitEnvelope | undefined;
  if (envelope && typeof envelope.schemaVersion === 'number' && 'circuit' in envelope) {
    return normalizeCircuit(envelope.circuit);
  }

  return normalizeCircuit(payload);
};

export const serializeCircuit = (circuit: EditorCircuit): string =>
  JSON.stringify({
    schemaVersion: CIRCUIT_SCHEMA_VERSION,
    circuit: normalizeCircuit(circuit)
  });

export const deserializeCircuit = (raw: string): EditorCircuit => migratePersistedCircuit(JSON.parse(raw));

export const encodeCircuitShare = (circuit: EditorCircuit): string => window.btoa(unescape(encodeURIComponent(serializeCircuit(circuit))));

export const decodeCircuitShare = (encoded: string): EditorCircuit => deserializeCircuit(decodeURIComponent(escape(window.atob(encoded))));
