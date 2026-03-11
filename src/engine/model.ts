export type Unit = 'V' | 'A' | 'Ω' | 'F' | 'H' | 'Hz';

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
  | 'diode'
  | 'bjt'
  | 'mosfet'
  | 'opAmp'
  | 'logicGate'
  | 'wire';

export type LogicGateType = 'and' | 'or' | 'not' | 'nand' | 'nor' | 'xor';

export type LogicLevelBridge = {
  highThreshold: ValueMetadata;
  lowThreshold: ValueMetadata;
  highLevel: ValueMetadata;
  lowLevel: ValueMetadata;
};

export type SourceNonIdeal = {
  internalResistance?: ValueMetadata;
  rippleAmplitude?: ValueMetadata;
  rippleFrequencyHz?: ValueMetadata;
};

export type CircuitNode = {
  id: string;
  reference?: boolean;
  voltage?: ValueMetadata;
  groupId?: string;
};

export type ComponentBase = {
  id: string;
  kind: ComponentKind;
  from: string;
  to: string;
  label?: string;
  groupId?: string;
};

export type SubcircuitExternalPin = {
  id: string;
  label: string;
  memberNodeId: string;
};

export type SubcircuitDefinition = {
  id: string;
  groupId: string;
  label: string;
  externalPins: SubcircuitExternalPin[];
  internalMembers: {
    nodes: CircuitNode[];
    components: CircuitComponent[];
  };
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
  nonIdeal?: SourceNonIdeal;
};

export type CurrentSourceComponent = ComponentBase & {
  kind: 'currentSource';
  current: ValueMetadata;
  nonIdeal?: SourceNonIdeal;
};

export type DiodeComponent = ComponentBase & {
  kind: 'diode';
  forwardDrop: ValueMetadata;
  onResistance: ValueMetadata;
  offResistance: ValueMetadata;
};

export type BjtComponent = ComponentBase & {
  kind: 'bjt';
  beta: ValueMetadata;
  vbeOn: ValueMetadata;
};

export type MosfetComponent = ComponentBase & {
  kind: 'mosfet';
  thresholdVoltage: ValueMetadata;
  onResistance: ValueMetadata;
};

export type OpAmpComponent = ComponentBase & {
  kind: 'opAmp';
  gain: ValueMetadata;
  outputLimitHigh: ValueMetadata;
  outputLimitLow: ValueMetadata;
};

export type LogicGateComponent = ComponentBase & {
  kind: 'logicGate';
  gateType: LogicGateType;
  bridge: LogicLevelBridge;
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
  | DiodeComponent
  | BjtComponent
  | MosfetComponent
  | OpAmpComponent
  | LogicGateComponent
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
    | 'floating_node_groups'
    | 'unknown_node_reference'
    | 'invalid_unit'
    | 'constraint_violation'
    | 'missing_constitutive_value'
    | 'unsupported_component_behavior'
    | 'underdetermined'
    | 'overdetermined'
    | 'conflicting_ideal_voltage_sources'
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
  equationTrace?: EquationTraceRow[];
};

export type EquationTraceTerm = {
  componentId?: string;
  variableKey: string;
  coefficient: number;
  description: string;
};

export type EquationTraceConstant = {
  componentId?: string;
  value: number;
  description: string;
};

export type EquationTraceRow = {
  rowIndex: number;
  rowId: string;
  rowType: 'kcl' | 'constraint';
  kclNodeId?: string;
  constrainedComponentId?: string;
  terms: EquationTraceTerm[];
  constants: EquationTraceConstant[];
  rhs: number;
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
