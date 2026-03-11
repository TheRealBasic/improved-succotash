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
    | 'overdetermined';
  severity: DiagnosticSeverity;
  message: string;
  componentId?: string;
  nodeId?: string;
};

export type SolvedCircuitValue = ValueMetadata & {
  key: string;
};

export type SolveCircuitResult = {
  values: Record<string, SolvedCircuitValue>;
  diagnostics: SolverDiagnostic[];
};
