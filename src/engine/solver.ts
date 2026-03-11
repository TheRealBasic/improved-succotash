import type {
  CircuitComponent,
  CircuitNode,
  CircuitState,
  SolveCircuitResult,
  SolvedCircuitValue,
  SolverDiagnostic,
  Unit,
  ValueConstraint,
  ValueMetadata
} from './model';

export type CircuitValues = {
  voltage?: number;
  current?: number;
  resistance?: number;
};

export type SolvedCircuitValues = Required<CircuitValues> & { summary: string };

const componentUnits: Partial<Record<CircuitComponent['kind'], Unit>> = {
  resistor: 'Ω',
  capacitor: 'F',
  inductor: 'H',
  voltageSource: 'V',
  currentSource: 'A'
};

const getComponentValueMetadata = (component: CircuitComponent): ValueMetadata | undefined => {
  switch (component.kind) {
    case 'resistor':
      return component.resistance;
    case 'capacitor':
      return component.capacitance;
    case 'inductor':
      return component.inductance;
    case 'voltageSource':
      return component.voltage;
    case 'currentSource':
      return component.current;
    default:
      return undefined;
  }
};

const constraintViolations = (value: ValueMetadata): string[] => {
  const violations: string[] = [];
  const constraints: ValueConstraint | undefined = value.constraints;
  if (value.value == null || constraints == null) {
    return violations;
  }

  if (constraints.min != null && value.value < constraints.min) {
    violations.push(`value ${value.value} below min ${constraints.min}`);
  }
  if (constraints.max != null && value.value > constraints.max) {
    violations.push(`value ${value.value} above max ${constraints.max}`);
  }
  if (constraints.nonZero && value.value === 0) {
    violations.push('value must be non-zero');
  }

  return violations;
};

const validateCircuit = (circuit: CircuitState): SolverDiagnostic[] => {
  const diagnostics: SolverDiagnostic[] = [];
  const nodeIds = new Set(circuit.nodes.map((node) => node.id));
  const referenceCount = circuit.nodes.filter((node) => node.reference).length;

  if (referenceCount === 0) {
    diagnostics.push({
      code: 'missing_reference_node',
      severity: 'error',
      message: 'At least one reference node (ground) is required.'
    });
  }

  for (const component of circuit.components) {
    if (!nodeIds.has(component.from) || !nodeIds.has(component.to)) {
      diagnostics.push({
        code: 'unknown_node_reference',
        severity: 'error',
        message: `Component ${component.id} references an unknown node.`,
        componentId: component.id
      });
    }

    const expectedUnit = componentUnits[component.kind];
    if (expectedUnit != null) {
      const valueMetadata = getComponentValueMetadata(component);
      if (valueMetadata == null) {
        continue;
      }

      if (valueMetadata.unit !== expectedUnit) {
        diagnostics.push({
          code: 'invalid_unit',
          severity: 'error',
          message: `Component ${component.id} has unit ${valueMetadata.unit}, expected ${expectedUnit}.`,
          componentId: component.id
        });
      }

      for (const violation of constraintViolations(valueMetadata)) {
        diagnostics.push({
          code: 'constraint_violation',
          severity: 'error',
          message: `Component ${component.id}: ${violation}.`,
          componentId: component.id
        });
      }
    }
  }

  if (circuit.nodes.length > 0) {
    const adjacency = new Map<string, Set<string>>();
    for (const node of circuit.nodes) {
      adjacency.set(node.id, new Set<string>());
    }
    for (const component of circuit.components) {
      adjacency.get(component.from)?.add(component.to);
      adjacency.get(component.to)?.add(component.from);
    }

    const [firstNode] = circuit.nodes;
    if (firstNode != null) {
      const queue: string[] = [firstNode.id];
      const visited = new Set<string>(queue);
      while (queue.length > 0) {
        const current = queue.shift();
        if (current == null) {
          continue;
        }
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }

      if (visited.size !== circuit.nodes.length) {
        diagnostics.push({
          code: 'disconnected_graph',
          severity: 'error',
          message: 'Circuit graph is disconnected. All nodes must be connected.'
        });
      }
    }
  }

  return diagnostics;
};

type EquationBuild = {
  A: number[][];
  b: number[];
  unknownNodeIds: string[];
  sourceCurrentVarIds: string[];
  knownNodeVoltages: Map<string, number>;
  diagnostics: SolverDiagnostic[];
};

const buildEquations = (circuit: CircuitState): EquationBuild => {
  const diagnostics: SolverDiagnostic[] = [];
  const referenceNodeIds = new Set(circuit.nodes.filter((n) => n.reference).map((n) => n.id));
  const knownNodeVoltages = new Map<string, number>();

  for (const node of circuit.nodes) {
    if (node.reference) {
      knownNodeVoltages.set(node.id, node.voltage?.value ?? 0);
    } else if (node.voltage?.known && node.voltage.value != null) {
      knownNodeVoltages.set(node.id, node.voltage.value);
    }
  }

  const unknownNodeIds = circuit.nodes
    .map((node) => node.id)
    .filter((id) => !knownNodeVoltages.has(id) && !referenceNodeIds.has(id));

  const voltageConstraintComponents = circuit.components.filter(
    (component) => component.kind === 'voltageSource' || component.kind === 'wire' || component.kind === 'inductor'
  );

  const sourceCurrentVarIds = voltageConstraintComponents.map((component) => component.id);
  const unknownCount = unknownNodeIds.length + sourceCurrentVarIds.length;

  const A: number[][] = [];
  const b: number[] = [];

  const variableIndex = new Map<string, number>();
  unknownNodeIds.forEach((id, idx) => variableIndex.set(`V:${id}`, idx));
  sourceCurrentVarIds.forEach((id, idx) => variableIndex.set(`I:${id}`, unknownNodeIds.length + idx));

  const addCoefficient = (row: number[], key: string, value: number): number => {
    const index = variableIndex.get(key);
    if (index == null) {
      return 0;
    }
    row[index] += value;
    return value;
  };

  const getKnownVoltage = (nodeId: string): number | undefined => knownNodeVoltages.get(nodeId);

  for (const nodeId of unknownNodeIds) {
    const row = new Array<number>(unknownCount).fill(0);
    let rhs = 0;

    for (const component of circuit.components) {
      if (component.kind === 'resistor') {
        const resistance = component.resistance.value;
        if (resistance == null || resistance === 0) {
          continue;
        }

        const conductance = 1 / resistance;
        const isFrom = component.from === nodeId;
        const isTo = component.to === nodeId;
        if (!isFrom && !isTo) {
          continue;
        }

        const sign = isFrom ? 1 : -1;
        const selfNode = isFrom ? component.from : component.to;
        const otherNode = isFrom ? component.to : component.from;

        addCoefficient(row, `V:${selfNode}`, sign * conductance);
        addCoefficient(row, `V:${otherNode}`, -sign * conductance);

        const knownOther = getKnownVoltage(otherNode);
        if (knownOther != null) {
          rhs += sign * conductance * knownOther;
        }
        const knownSelf = getKnownVoltage(selfNode);
        if (knownSelf != null) {
          rhs -= sign * conductance * knownSelf;
        }
      } else if (component.kind === 'currentSource') {
        const current = component.current.value ?? 0;
        if (component.from === nodeId) {
          rhs -= current;
        }
        if (component.to === nodeId) {
          rhs += current;
        }
      } else if (component.kind === 'voltageSource' || component.kind === 'wire' || component.kind === 'inductor') {
        if (component.from === nodeId) {
          addCoefficient(row, `I:${component.id}`, 1);
        }
        if (component.to === nodeId) {
          addCoefficient(row, `I:${component.id}`, -1);
        }
      } else if (component.kind === 'capacitor') {
        diagnostics.push({
          code: 'unsupported_component_behavior',
          severity: 'warning',
          message: `Capacitor ${component.id} is treated as open-circuit in DC solve.`,
          componentId: component.id
        });
      }
    }

    A.push(row);
    b.push(-rhs);
  }

  for (const component of voltageConstraintComponents) {
    const row = new Array<number>(unknownCount).fill(0);
    const sourceVoltage =
      component.kind === 'voltageSource' ? (component.voltage.value ?? 0) : 0;

    const fromKnown = getKnownVoltage(component.from);
    const toKnown = getKnownVoltage(component.to);

    addCoefficient(row, `V:${component.from}`, 1);
    addCoefficient(row, `V:${component.to}`, -1);

    let rhs = sourceVoltage;
    if (fromKnown != null) {
      rhs -= fromKnown;
    }
    if (toKnown != null) {
      rhs += toKnown;
    }

    A.push(row);
    b.push(rhs);
  }

  return { A, b, unknownNodeIds, sourceCurrentVarIds, knownNodeVoltages, diagnostics };
};

type SolveMatrixResult = {
  solution: number[];
  rankA: number;
  rankAugmented: number;
};

const solveLinearSystem = (A: number[][], b: number[]): SolveMatrixResult => {
  const matrix = A.map((row, i) => [...row, b[i] ?? 0]);
  const rows = matrix.length;
  const cols = A[0]?.length ?? 0;
  let pivotRow = 0;
  let rankA = 0;
  let rankAugmented = 0;

  for (let col = 0; col < cols && pivotRow < rows; col += 1) {
    let best = pivotRow;
    for (let r = pivotRow + 1; r < rows; r += 1) {
      if (Math.abs(matrix[r][col] ?? 0) > Math.abs(matrix[best][col] ?? 0)) {
        best = r;
      }
    }

    if (Math.abs(matrix[best][col] ?? 0) < 1e-10) {
      continue;
    }

    [matrix[pivotRow], matrix[best]] = [matrix[best], matrix[pivotRow]];

    const pivotValue = matrix[pivotRow][col] ?? 1;
    for (let c = col; c <= cols; c += 1) {
      matrix[pivotRow][c] = (matrix[pivotRow][c] ?? 0) / pivotValue;
    }

    for (let r = 0; r < rows; r += 1) {
      if (r === pivotRow) {
        continue;
      }
      const factor = matrix[r][col] ?? 0;
      if (Math.abs(factor) < 1e-12) {
        continue;
      }
      for (let c = col; c <= cols; c += 1) {
        matrix[r][c] = (matrix[r][c] ?? 0) - factor * (matrix[pivotRow][c] ?? 0);
      }
    }

    pivotRow += 1;
    rankA += 1;
  }

  for (const row of matrix) {
    const coeffNorm = row.slice(0, cols).reduce((acc, value) => acc + Math.abs(value), 0);
    const augValue = Math.abs(row[cols] ?? 0);
    if (coeffNorm > 1e-9) {
      rankAugmented += 1;
    } else if (augValue > 1e-9) {
      rankAugmented += 1;
    }
  }

  const solution = new Array<number>(cols).fill(0);
  for (let r = 0; r < rows; r += 1) {
    const pivotCol = matrix[r].slice(0, cols).findIndex((value) => Math.abs(value) > 1e-9);
    if (pivotCol >= 0) {
      solution[pivotCol] = matrix[r][cols] ?? 0;
    }
  }

  return { solution, rankA, rankAugmented };
};

const toSolvedValue = (key: string, unit: Unit, value: number | undefined, known: boolean, computed: boolean): SolvedCircuitValue => ({
  key,
  value,
  unit,
  known,
  computed
});

export const solveCircuit = (circuitState: CircuitState): SolveCircuitResult => {
  const diagnostics = validateCircuit(circuitState);
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === 'error');
  if (hasErrors) {
    return { values: {}, diagnostics };
  }

  const equationBuild = buildEquations(circuitState);
  diagnostics.push(...equationBuild.diagnostics);

  const variableCount = equationBuild.A[0]?.length ?? 0;
  if (variableCount === 0) {
    return { values: {}, diagnostics };
  }

  const { solution, rankA, rankAugmented } = solveLinearSystem(equationBuild.A, equationBuild.b);

  if (rankA < rankAugmented) {
    diagnostics.push({
      code: 'overdetermined',
      severity: 'error',
      message: 'Circuit equations are inconsistent (overdetermined).'
    });
  } else if (rankA < variableCount) {
    diagnostics.push({
      code: 'underdetermined',
      severity: 'error',
      message: 'Circuit equations are underdetermined. Add more constraints/components.'
    });
  }

  const values: Record<string, SolvedCircuitValue> = {};

  const nodeVoltage = new Map<string, number>();
  for (const [nodeId, knownVoltage] of equationBuild.knownNodeVoltages) {
    nodeVoltage.set(nodeId, knownVoltage);
    values[`node:${nodeId}:voltage`] = toSolvedValue(`node:${nodeId}:voltage`, 'V', knownVoltage, true, false);
  }

  equationBuild.unknownNodeIds.forEach((nodeId, index) => {
    const voltage = solution[index];
    nodeVoltage.set(nodeId, voltage);
    values[`node:${nodeId}:voltage`] = toSolvedValue(`node:${nodeId}:voltage`, 'V', voltage, false, true);
  });

  const sourceCurrentOffset = equationBuild.unknownNodeIds.length;
  equationBuild.sourceCurrentVarIds.forEach((componentId, index) => {
    const current = solution[sourceCurrentOffset + index];
    values[`component:${componentId}:current`] = toSolvedValue(`component:${componentId}:current`, 'A', current, false, true);
  });

  for (const component of circuitState.components) {
    const from = nodeVoltage.get(component.from);
    const to = nodeVoltage.get(component.to);

    if (from == null || to == null) {
      continue;
    }

    const drop = from - to;
    values[`component:${component.id}:voltage`] = toSolvedValue(`component:${component.id}:voltage`, 'V', drop, false, true);

    if (component.kind === 'resistor' && component.resistance.value != null && component.resistance.value !== 0) {
      const current = drop / component.resistance.value;
      values[`component:${component.id}:current`] = toSolvedValue(`component:${component.id}:current`, 'A', current, false, true);
      values[`component:${component.id}:resistance`] = toSolvedValue(
        `component:${component.id}:resistance`,
        'Ω',
        component.resistance.value,
        true,
        false
      );
    }

    if (component.kind === 'currentSource') {
      values[`component:${component.id}:current`] = toSolvedValue(
        `component:${component.id}:current`,
        'A',
        component.current.value,
        true,
        false
      );
    }

    if (component.kind === 'voltageSource') {
      values[`component:${component.id}:voltage`] = toSolvedValue(
        `component:${component.id}:voltage`,
        'V',
        component.voltage.value,
        true,
        false
      );
    }
  }

  return { values, diagnostics };
};

export const solveCircuitValues = (values: CircuitValues): SolvedCircuitValues => {
  const { voltage, current, resistance } = values;

  if (voltage != null && current != null && resistance == null && current !== 0) {
    const solvedResistance = voltage / current;
    return { voltage, current, resistance: solvedResistance, summary: `R = ${solvedResistance.toFixed(2)} Ω` };
  }

  if (voltage != null && resistance != null && current == null && resistance !== 0) {
    const solvedCurrent = voltage / resistance;
    return { voltage, current: solvedCurrent, resistance, summary: `I = ${solvedCurrent.toFixed(2)} A` };
  }

  if (current != null && resistance != null && voltage == null) {
    const solvedVoltage = current * resistance;
    return { voltage: solvedVoltage, current, resistance, summary: `V = ${solvedVoltage.toFixed(2)} V` };
  }

  return {
    voltage: voltage ?? 0,
    current: current ?? 0,
    resistance: resistance ?? 0,
    summary: 'Provide any two values to solve the third.'
  };
};

export type { CircuitState, SolveCircuitResult } from './model';
