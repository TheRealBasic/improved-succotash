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
    case 'switch-spst':
    case 'switch-spdt':
    case 'switch-dpdt':
    case 'relay-reed':
    case 'relay-ssr':
    case 'switch-analog':
    case 'op-amp':
    case 'comparator':
    case 'instrumentation-amplifier':
    case 'generic-regulator-controller':
    case 'voltage-reference':
    case 'logic-gate':
    case 'logic-buffer':
    case 'logic-schmitt-trigger':
    case 'logic-tri-state-buffer':
    case 'logic-latch':
    case 'logic-flip-flop':
    case 'logic-counter':
    case 'logic-multiplexer':
    case 'sensor-thermistor-probe':
    case 'sensor-ldr':
    case 'sensor-hall':
    case 'sensor-pressure':
    case 'sensor-microphone':
    case 'sensor-analog-generic':
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
          : value === 'comparator'
            ? 'comparator'
            : value === 'instrumentationAmplifier'
              ? 'instrumentation-amplifier'
              : value === 'genericRegulatorController'
                ? 'generic-regulator-controller'
                : value === 'voltageReference'
                  ? 'voltage-reference'
                  : value === 'logicGate'
            ? 'logic-gate'
            : value === 'logicBuffer'
              ? 'logic-buffer'
              : value === 'logicSchmittTrigger'
                ? 'logic-schmitt-trigger'
                : value === 'logicTriStateBuffer'
                  ? 'logic-tri-state-buffer'
                  : value === 'logicLatch'
                    ? 'logic-latch'
                    : value === 'logicFlipFlop'
                      ? 'logic-flip-flop'
                      : value === 'logicCounter'
                        ? 'logic-counter'
                        : value === 'logicMultiplexer'
                          ? 'logic-multiplexer'
                          : value === 'sensorThermistorProbe'
                            ? 'sensor-thermistor-probe'
                            : value === 'sensorLdr'
                              ? 'sensor-ldr'
                              : value === 'sensorHall'
                                ? 'sensor-hall'
                                : value === 'sensorPressure'
                                  ? 'sensor-pressure'
                                  : value === 'sensorMicrophone'
                                    ? 'sensor-microphone'
                                    : value === 'sensorAnalogGeneric'
                                      ? 'sensor-analog-generic'
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
        onResistance: normalizeValueMetadata(record.onResistance ?? record.ron, 'Ω', 5, { min: 0.001, nonZero: true }),
        offLeakageCurrent: normalizeValueMetadata(record.offLeakageCurrent ?? record.ioff, 'A', 0.000001, { min: 0 }),
        hysteresis: normalizeValueMetadata(record.hysteresis, 'V', 0.05, { min: 0 }),
        controlSignal: normalizeValueMetadata(record.controlSignal, 'V', 0)
      };

    case 'switch-spst':
    case 'switch-spdt':
    case 'switch-dpdt':
    case 'relay-reed':
    case 'relay-ssr':
    case 'switch-analog':
      return {
        id,
        from,
        to,
        kind: 'switch',
        catalogTypeId,
        label: asString(record.label) ?? `SW-${id}`,
        onResistance: normalizeValueMetadata(record.onResistance ?? record.ron, 'Ω', 0.02, { min: 0, nonZero: true }),
        offLeakageCurrent: normalizeValueMetadata(record.offLeakageCurrent ?? record.ioff, 'A', 0.000001, { min: 0 }),
        controlThreshold: normalizeValueMetadata(record.controlThreshold ?? record.vth, 'V', 2.5),
        hysteresis: normalizeValueMetadata(record.hysteresis, 'V', 0.05, { min: 0 }),
        controlSignal: normalizeValueMetadata(record.controlSignal, 'V', 0),
        state: (asString(record.state) as 'open' | 'closed' | undefined) ?? 'open'
      };
    case 'op-amp':
    case 'comparator':
    case 'instrumentation-amplifier':
    case 'generic-regulator-controller':
    case 'voltage-reference':
      return {
        id,
        from,
        to,
        kind: 'amplifier',
        catalogTypeId,
        label: asString(record.label) ?? `U-${id}`,
        gain: normalizeValueMetadata(record.gain, 'V', 100000),
        outputLimitHigh: normalizeValueMetadata(record.outputLimitHigh, 'V', 12),
        outputLimitLow: normalizeValueMetadata(record.outputLimitLow, 'V', -12),
        inputOffset: normalizeValueMetadata(record.inputOffset, 'V', 0),
        bandwidthHz: normalizeValueMetadata(record.bandwidthHz, 'Hz', 1000000, { min: 0 })
      };
    case 'logic-gate':
    case 'logic-buffer':
    case 'logic-schmitt-trigger':
    case 'logic-tri-state-buffer':
    case 'logic-latch':
    case 'logic-flip-flop':
    case 'logic-counter':
    case 'logic-multiplexer':
      return {
        id,
        from,
        to,
        kind: 'digital',
        catalogTypeId,
        label: asString(record.label) ?? `G-${id}`,
        gateType: (asString(record.gateType ?? record.type) as 'and' | 'or' | 'not' | 'nand' | 'nor' | 'xor' | undefined) ?? 'not',
        digitalAbstraction: (asString(record.digitalAbstraction) as 'combinational' | 'buffer' | 'schmitt-trigger' | 'tri-state-buffer' | 'latch' | 'flip-flop' | 'counter' | 'multiplexer' | undefined) ?? undefined,
        logicFamily: asString(record.logicFamily) ?? 'CMOS',
        propagationDelayNs: normalizeValueMetadata(record.propagationDelayNs, 'ns', 0, { min: 0 }),
        pullDefault: (asString(record.pullDefault) as 'none' | 'pull-up' | 'pull-down' | undefined) ?? 'none',
        bridge: {
          highThreshold: normalizeValueMetadata(asRecord(record.bridge)?.highThreshold, 'V', 3),
          lowThreshold: normalizeValueMetadata(asRecord(record.bridge)?.lowThreshold, 'V', 1),
          highLevel: normalizeValueMetadata(asRecord(record.bridge)?.highLevel, 'V', 5),
          lowLevel: normalizeValueMetadata(asRecord(record.bridge)?.lowLevel, 'V', 0)
        }
      };
    case 'sensor-thermistor-probe':
    case 'sensor-ldr':
    case 'sensor-hall':
    case 'sensor-pressure':
    case 'sensor-microphone':
    case 'sensor-analog-generic':
      return {
        id,
        from,
        to,
        kind: 'sensor',
        catalogTypeId,
        label: asString(record.label) ?? `S-${id}`,
        sensitivity: normalizeValueMetadata(record.sensitivity, 'V', 1),
        offset: normalizeValueMetadata(record.offset, 'V', 0),
        inputSignal: normalizeValueMetadata(record.inputSignal ?? record.input, 'V', 0),
        supplyMin: normalizeValueMetadata(record.supplyMin, 'V', 0),
        supplyMax: normalizeValueMetadata(record.supplyMax, 'V', 5),
        outputClampBehavior: (asString(record.outputClampBehavior) as 'none' | 'saturate' | undefined) ?? 'saturate'
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
