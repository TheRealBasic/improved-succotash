import type {
  CircuitComponent,
  CircuitState,
  MonteCarloResult,
  SolveCircuitResult,
  SolvedCircuitValue,
  SolverDiagnostic,
  ValueMetadata
} from '../model';
import { filterCircuitByCapability, getUnsupportedComponentDiagnostics } from '../componentBehavior';

export type MonteCarloOptions = {
  runs: number;
  seed?: number;
  targetKeys?: string[];
};

type RandomFn = () => number;

type MetadataRef = {
  scope: 'node' | 'component';
  ownerId: string;
  metadata: ValueMetadata;
};

const isFiniteNumber = (value: number | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const mulberry32 = (seed: number): RandomFn => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const createRandom = (seed?: number): RandomFn => {
  if (seed == null) {
    return Math.random;
  }
  return mulberry32(seed);
};

const cloneCircuit = (circuit: CircuitState): CircuitState => ({
  nodes: circuit.nodes.map((node) => ({
    ...node,
    voltage: node.voltage ? { ...node.voltage, constraints: node.voltage.constraints ? { ...node.voltage.constraints } : undefined } : undefined
  })),
  components: circuit.components.map((component) => {
    if (component.catalogTypeId === 'wire') {
      return component;
    }
    if (component.catalogTypeId === 'resistor') {
      return { ...component, resistance: { ...component.resistance, constraints: component.resistance.constraints ? { ...component.resistance.constraints } : undefined } };
    }
    if (component.catalogTypeId === 'capacitor') {
      return { ...component, capacitance: { ...component.capacitance, constraints: component.capacitance.constraints ? { ...component.capacitance.constraints } : undefined } };
    }
    if (component.catalogTypeId === 'inductor') {
      return { ...component, inductance: { ...component.inductance, constraints: component.inductance.constraints ? { ...component.inductance.constraints } : undefined } };
    }
    if (component.catalogTypeId === 'voltage-source') {
      return { ...component, voltage: { ...component.voltage, constraints: component.voltage.constraints ? { ...component.voltage.constraints } : undefined } };
    }
    if (component.catalogTypeId === 'current-source') {
      return { ...component, current: { ...component.current, constraints: component.current.constraints ? { ...component.current.constraints } : undefined } };
    }
    if (component.catalogTypeId === 'diode') {
      return { ...component, forwardDrop: { ...component.forwardDrop }, onResistance: { ...component.onResistance }, offResistance: { ...component.offResistance } };
    }
    if (component.catalogTypeId === 'bjt') {
      return { ...component, beta: { ...component.beta }, vbeOn: { ...component.vbeOn } };
    }
    if (component.catalogTypeId === 'mosfet') {
      return { ...component, thresholdVoltage: { ...component.thresholdVoltage }, onResistance: { ...component.onResistance } };
    }
    if (component.catalogTypeId === 'op-amp') {
      return { ...component, gain: { ...component.gain }, outputLimitHigh: { ...component.outputLimitHigh }, outputLimitLow: { ...component.outputLimitLow } };
    }
    if (component.catalogTypeId === 'logic-gate') {
      return { ...component, bridge: { highThreshold: { ...component.bridge.highThreshold }, lowThreshold: { ...component.bridge.lowThreshold }, highLevel: { ...component.bridge.highLevel }, lowLevel: { ...component.bridge.lowLevel } } };
    }
    return component;
  }),
  edges: circuit.edges?.map((edge) => ({ ...edge }))
});

const collectMetadataRefs = (circuit: CircuitState): MetadataRef[] => {
  const refs: MetadataRef[] = [];
  for (const node of circuit.nodes) {
    if (node.voltage != null) {
      refs.push({ scope: 'node', ownerId: node.id, metadata: node.voltage });
    }
  }

  for (const component of circuit.components) {
    const metadata = getComponentValueMetadata(component);
    if (metadata != null) {
      refs.push({ scope: 'component', ownerId: component.id, metadata });
    }
  }

  return refs;
};

const getComponentValueMetadata = (component: CircuitComponent): ValueMetadata | undefined => {
  switch (component.catalogTypeId) {
    case 'resistor':
      return component.resistance;
    case 'capacitor':
      return component.capacitance;
    case 'inductor':
      return component.inductance;
    case 'voltage-source':
      return component.voltage;
    case 'current-source':
      return component.current;
    case 'diode':
      return component.forwardDrop;
    case 'bjt':
      return component.beta;
    case 'mosfet':
      return component.thresholdVoltage;
    case 'op-amp':
      return component.gain;
    case 'logic-gate':
      return component.bridge.highThreshold;
    default:
      return undefined;
  }
};

export const collectMonteCarloDiagnostics = (circuit: CircuitState): SolverDiagnostic[] => {
  const diagnostics: SolverDiagnostic[] = [];
  for (const ref of collectMetadataRefs(circuit)) {
    const { metadata } = ref;

    if (metadata.tolerancePct != null && (!Number.isFinite(metadata.tolerancePct) || metadata.tolerancePct < 0)) {
      diagnostics.push({
        code: 'invalid_tolerance',
        severity: 'warning',
        message: `${ref.scope} ${ref.ownerId} has invalid tolerancePct=${metadata.tolerancePct}.`,
        ...(ref.scope === 'component' ? { componentId: ref.ownerId } : { nodeId: ref.ownerId })
      });
    }

    if (metadata.tempcoPpm != null && !Number.isFinite(metadata.tempcoPpm)) {
      diagnostics.push({
        code: 'invalid_tempco',
        severity: 'warning',
        message: `${ref.scope} ${ref.ownerId} has invalid tempcoPpm=${metadata.tempcoPpm}.`,
        ...(ref.scope === 'component' ? { componentId: ref.ownerId } : { nodeId: ref.ownerId })
      });
    }

    const hasNominal = isFiniteNumber(metadata.nominalTempC);
    const hasOperating = isFiniteNumber(metadata.operatingTempC);
    if (hasNominal !== hasOperating) {
      diagnostics.push({
        code: 'inconsistent_temperature',
        severity: 'warning',
        message: `${ref.scope} ${ref.ownerId} must define both nominalTempC and operatingTempC when either is set.`,
        ...(ref.scope === 'component' ? { componentId: ref.ownerId } : { nodeId: ref.ownerId })
      });
    }
  }
  return diagnostics;
};

const perturbValue = (metadata: ValueMetadata, random: RandomFn): number | undefined => {
  if (metadata.value == null) {
    return undefined;
  }

  let value = metadata.value;
  if (isFiniteNumber(metadata.tolerancePct) && metadata.tolerancePct >= 0) {
    const span = metadata.tolerancePct / 100;
    const noise = (random() * 2 - 1) * span;
    value *= 1 + noise;
  }

  if (
    isFiniteNumber(metadata.tempcoPpm) &&
    isFiniteNumber(metadata.nominalTempC) &&
    isFiniteNumber(metadata.operatingTempC)
  ) {
    const delta = metadata.operatingTempC - metadata.nominalTempC;
    value *= 1 + metadata.tempcoPpm * 1e-6 * delta;
  }

  return value;
};

const computeStats = (samples: number[]) => {
  const mean = samples.reduce((acc, value) => acc + value, 0) / samples.length;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of samples) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  const variance =
    samples.reduce((acc, value) => acc + (value - mean) ** 2, 0) /
    Math.max(samples.length, 1);
  return { mean, min, max, std: Math.sqrt(variance) };
};

export const runMonteCarloAnalysis = (
  circuit: CircuitState,
  options: MonteCarloOptions,
  solve: (state: CircuitState) => SolveCircuitResult,
  baseDiagnostics: SolverDiagnostic[] = []
): { monteCarlo?: MonteCarloResult; diagnostics: SolverDiagnostic[] } => {
  if (!Number.isInteger(options.runs) || options.runs <= 0) {
    return { monteCarlo: undefined, diagnostics: [] };
  }

  const capabilityDiagnostics = getUnsupportedComponentDiagnostics(circuit, 'monteCarlo');
  const supportedCircuit = filterCircuitByCapability(circuit, 'monteCarlo');
  const diagnostics = [...baseDiagnostics, ...capabilityDiagnostics, ...collectMonteCarloDiagnostics(supportedCircuit)];
  const random = createRandom(options.seed);
  const collected = new Map<string, { unit: SolvedCircuitValue['unit']; samples: number[] }>();

  for (let run = 0; run < options.runs; run += 1) {
    const sampledCircuit = cloneCircuit(supportedCircuit);
    for (const ref of collectMetadataRefs(sampledCircuit)) {
      ref.metadata.value = perturbValue(ref.metadata, random);
    }

    const solveResult = solve(sampledCircuit);
    const runErrors = solveResult.diagnostics.some((d) => d.severity === 'error');
    if (runErrors) {
      continue;
    }

    const entries = Object.entries(solveResult.values).filter(([key, value]) => {
      if (options.targetKeys != null && options.targetKeys.length > 0) {
        return options.targetKeys.includes(key) && value.value != null;
      }
      return value.computed && value.value != null;
    });

    for (const [key, value] of entries) {
      if (value.value == null) {
        continue;
      }
      const existing = collected.get(key);
      if (existing == null) {
        collected.set(key, { unit: value.unit, samples: [value.value] });
      } else {
        existing.samples.push(value.value);
      }
    }
  }

  const targetDistributions = Object.fromEntries(
    Array.from(collected.entries())
      .filter(([, data]) => data.samples.length > 0)
      .map(([key, data]) => [
        key,
        {
          key,
          unit: data.unit,
          samples: data.samples,
          stats: computeStats(data.samples)
        }
      ])
  );

  return {
    diagnostics,
    monteCarlo: {
      runs: options.runs,
      seed: options.seed,
      targetDistributions
    }
  };
};
