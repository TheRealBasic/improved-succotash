export type Unit = 'V' | 'A' | 'Ω' | 'F' | 'H';

export type ValueConstraint = {
  min?: number;
  max?: number;
  nonZero?: boolean;
};

export type ValueMetadata = {
  value?: number;
  known: boolean;
  computed: boolean;
  unit: Unit;
  constraints?: ValueConstraint;
  tolerancePct?: number;
  tempcoPpm?: number;
  nominalTempC?: number;
  operatingTempC?: number;
};

export type ComponentKind =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'voltageSource'
  | 'currentSource'
  | 'wire';

export type CircuitNode = {
  id: string;
  reference?: boolean;
  voltage?: ValueMetadata;
};

export type ComponentBase = {
  id: string;
  kind: ComponentKind;
  from: string;
  to: string;
  label?: string;
};

export type ResistorComponent = ComponentBase & {
  kind: 'resistor';
  resistance: ValueMetadata;
};

export type CapacitorComponent = ComponentBase & {
  kind: 'capacitor';
  capacitance: ValueMetadata;
};

export type InductorComponent = ComponentBase & {
  kind: 'inductor';
  inductance: ValueMetadata;
};

export type VoltageSourceComponent = ComponentBase & {
  kind: 'voltageSource';
  voltage: ValueMetadata;
};

export type CurrentSourceComponent = ComponentBase & {
  kind: 'currentSource';
  current: ValueMetadata;
};

export type WireComponent = ComponentBase & {
  kind: 'wire';
};

export type CircuitComponent =
  | ResistorComponent
  | CapacitorComponent
  | InductorComponent
  | VoltageSourceComponent
  | CurrentSourceComponent
  | WireComponent;

export type CircuitEdge = {
  id: string;
  from: string;
  to: string;
  componentId?: string;
};

export type CircuitState = {
  nodes: CircuitNode[];
  components: CircuitComponent[];
  edges?: CircuitEdge[];
};

export type DiagnosticSeverity = 'info' | 'warning' | 'error';

export type SolverDiagnostic = {
  code:
    | 'missing_reference_node'
    | 'disconnected_graph'
    | 'unknown_node_reference'
    | 'invalid_unit'
    | 'constraint_violation'
    | 'unsupported_component_behavior'
    | 'underdetermined'
    | 'overdetermined'
    | 'invalid_tolerance'
    | 'invalid_tempco'
    | 'inconsistent_temperature'
    | 'target_unsolvable'
    | 'target_non_unique'
    | 'target_not_found';
  severity: DiagnosticSeverity;
  message: string;
  componentId?: string;
  nodeId?: string;
};

export type SolvedCircuitValue = ValueMetadata & {
  key: string;
};

export type MonteCarloSummaryStats = {
  mean: number;
  min: number;
  max: number;
  std: number;
};

export type MonteCarloTargetDistribution = {
  key: string;
  unit: Unit;
  samples: number[];
  stats: MonteCarloSummaryStats;
};

export type MonteCarloResult = {
  runs: number;
  seed?: number;
  targetDistributions: Record<string, MonteCarloTargetDistribution>;
};

export type SolveCircuitResult = {
  values: Record<string, SolvedCircuitValue>;
  diagnostics: SolverDiagnostic[];
  monteCarlo?: MonteCarloResult;
};

export type SolveTarget =
  | { type: 'node_voltage'; nodeId: string }
  | { type: 'component_current'; componentId: string }
  | { type: 'component_value'; componentId: string };

export type TargetSolveResult = {
  key: string;
  value?: number;
  unit: Unit;
  dependencies: string[];
  unique: boolean;
};
