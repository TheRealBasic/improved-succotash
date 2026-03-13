import { runMonteCarloAnalysis, type MonteCarloOptions } from './analysis/monteCarlo';
import type {
  CircuitComponent,
  CircuitNode,
  CircuitState,
  EquationTraceConstant,
  EquationTraceRow,
  EquationTraceTerm,
  SolveCircuitResult,
  SolveTarget,
  SolvedCircuitValue,
  SolverDiagnostic,
  TargetSolveResult,
  Unit,
  ValueConstraint,
  ValueMetadata
} from './model';
import { assertNever, filterCircuitByCapability, getUnsupportedComponentDiagnostics, usesSharedSwitchBehavior } from './componentBehavior';

export type SolveCircuitOptions = {
  monteCarlo?: MonteCarloOptions;
  target?: SolveTarget;
};

export type CircuitValues = {
  voltage?: number;
  current?: number;
  resistance?: number;
};

export type SolvedCircuitValues = Required<CircuitValues> & { summary: string };

export type DiagnosticGuidance = {
  why: string;
  suggestedFix: string;
};

const diagnosticGuidanceByCode: Partial<Record<SolverDiagnostic['code'], DiagnosticGuidance>> = {
  missing_reference_node: {
    why: 'Nodal analysis needs at least one reference potential to anchor every node voltage.',
    suggestedFix: 'Mark one node as reference/ground (0 V) before solving.'
  },
  floating_node_groups: {
    why: 'One or more node groups are electrically isolated from the reference path, so their voltages can drift together.',
    suggestedFix: 'Connect each floating group to the grounded network using a source, resistor, or wire.'
  },
  conflicting_ideal_voltage_sources: {
    why: 'Ideal voltage sources are forcing incompatible voltages across the same pair of nodes.',
    suggestedFix: 'Align source magnitudes/polarity or remove one conflicting source constraint.'
  },
  missing_constitutive_value: {
    why: 'An active/reactive component has no constitutive parameter, so the solver cannot form its equation.',
    suggestedFix: 'Enter a valid non-empty value (R/C/L/V/I) on the highlighted component.'
  },
  underdetermined: {
    why: 'There are fewer independent equations than unknowns, so the solution is not unique.',
    suggestedFix: 'Add grounding or additional component constraints to fully determine all unknowns.'
  },
  overdetermined: {
    why: 'The equation set includes contradictory constraints, so no solution satisfies all of them.',
    suggestedFix: 'Remove or correct conflicting constraints such as incompatible source settings.'
  },
  switch_fallback_applied: {
    why: 'A switch could not be treated as an ideal open/closed element because its control data is incomplete or numerically unstable.',
    suggestedFix: 'Set valid on-resistance, off-leakage, threshold, and optional hysteresis values.'
  },
  unsupported_analysis_mode: {
    why: 'The selected analysis mode does not support the behavior model of one or more placed components.',
    suggestedFix: 'Switch to a supported analysis mode or replace unsupported parts with supported equivalents.'
  }
};

export const getDiagnosticGuidance = (diagnostic: SolverDiagnostic): DiagnosticGuidance | undefined =>
  diagnosticGuidanceByCode[diagnostic.code];

const componentUnits: Partial<Record<CircuitComponent['catalogTypeId'], Unit>> = {
  resistor: 'Ω',
  capacitor: 'F',
  inductor: 'H',
  'voltage-source': 'V',
  'current-source': 'A',
  'ac-voltage-source': 'V',
  'pulse-voltage-source': 'V',
  'reference-source': 'V',
  'battery-cell': 'V',
  'battery-pack': 'V',
  'battery-coin-cell': 'V',
  'ldo-regulator': 'V',
  'buck-regulator': 'V',
  'boost-regulator': 'V',
  'charge-pump': 'V',
  'current-regulator': 'A',
  diode: 'V',
  bjt: 'A',
  mosfet: 'V',
  'switch-spst': 'V',
  'switch-spdt': 'V',
  'switch-dpdt': 'V',
  'relay-reed': 'V',
  'relay-ssr': 'V',
  'switch-analog': 'V',
  'op-amp': 'V',
  comparator: 'V',
  'instrumentation-amplifier': 'V',
  'generic-regulator-controller': 'V',
  'voltage-reference': 'V',
  'logic-gate': 'V',
  'logic-buffer': 'V',
  'logic-schmitt-trigger': 'V',
  'logic-tri-state-buffer': 'V',
  'logic-latch': 'V',
  'logic-flip-flop': 'V',
  'logic-counter': 'V',
  'logic-multiplexer': 'V',
  'sensor-thermistor-probe': 'V',
  'sensor-ldr': 'V',
  'sensor-hall': 'V',
  'sensor-pressure': 'V',
  'sensor-microphone': 'V',
  'sensor-analog-generic': 'V'
};

const isVoltageLikeSource = (catalogTypeId: CircuitComponent['catalogTypeId']): boolean =>
  [
    'voltage-source',
    'ac-voltage-source',
    'pulse-voltage-source',
    'reference-source',
    'battery-cell',
    'battery-pack',
    'battery-coin-cell',
    'ldo-regulator',
    'buck-regulator',
    'boost-regulator',
    'charge-pump'
  ].includes(catalogTypeId);

const getComponentValueMetadata = (component: CircuitComponent): ValueMetadata | undefined => {
  switch (component.catalogTypeId) {
    case 'resistor':
      return component.resistance;
    case 'capacitor':
      return component.capacitance;
    case 'inductor':
      return component.inductance;
    case 'voltage-source':
    case 'ac-voltage-source':
    case 'pulse-voltage-source':
    case 'reference-source':
    case 'battery-cell':
    case 'battery-pack':
    case 'battery-coin-cell':
    case 'ldo-regulator':
    case 'buck-regulator':
    case 'boost-regulator':
    case 'charge-pump':
      return component.voltage;
    case 'current-source':
    case 'current-regulator':
      return component.current;
    case 'diode':
      return component.forwardDrop;
    case 'bjt':
      return component.beta;
    case 'mosfet':
      return component.thresholdVoltage;
    case 'switch-spst':
    case 'switch-spdt':
    case 'switch-dpdt':
    case 'relay-reed':
    case 'relay-ssr':
    case 'switch-analog':
      return component.controlThreshold;
    case 'op-amp':
    case 'comparator':
    case 'instrumentation-amplifier':
    case 'generic-regulator-controller':
    case 'voltage-reference':
      return component.gain;
    case 'logic-gate':
    case 'logic-buffer':
    case 'logic-schmitt-trigger':
    case 'logic-tri-state-buffer':
    case 'logic-latch':
    case 'logic-flip-flop':
    case 'logic-counter':
    case 'logic-multiplexer':
      return component.bridge.highThreshold;
    case 'sensor-thermistor-probe':
    case 'sensor-ldr':
    case 'sensor-hall':
    case 'sensor-pressure':
    case 'sensor-microphone':
    case 'sensor-analog-generic':
      return component.inputSignal;
    case 'wire':
      return undefined;
    default:
      return undefined;
  }
};



const isSensorComponent = (component: CircuitComponent): component is Extract<CircuitComponent, { kind: 'sensor' }> => component.kind === 'sensor';

const getSensorOutputVoltage = (
  component: Extract<CircuitComponent, { kind: 'sensor' }>,
  diagnostics: SolverDiagnostic[]
): number => {
  const sensitivity = component.sensitivity.value ?? 0;
  const offset = component.offset.value ?? 0;
  const inputSignal = component.inputSignal.value ?? 0;
  const supplyMin = component.supplyMin.value ?? Number.NEGATIVE_INFINITY;
  const supplyMax = component.supplyMax.value ?? Number.POSITIVE_INFINITY;

  if (!Number.isFinite(supplyMin) || !Number.isFinite(supplyMax) || supplyMin >= supplyMax) {
    diagnostics.push({
      code: 'unsupported_component_behavior',
      severity: 'warning',
      componentId: component.id,
      message: `Sensor ${component.id} has invalid supply limits; output defaults to offset.`
    });
    return offset;
  }

  let output = offset + sensitivity * inputSignal;
  if (component.outputClampBehavior === 'saturate') {
    output = Math.min(Math.max(output, supplyMin), supplyMax);
  }
  return output;
};

const getSwitchEquivalentResistance = (
  component: Extract<CircuitComponent, { kind: 'switch' }>,
  nodeVoltages: Map<string, number>,
  diagnostics: SolverDiagnostic[]
): number => {
  if (component.catalogTypeId === 'diode') {
    const vd = component.forwardDrop.value ?? 0.7;
    const ron = Math.max(component.onResistance.value ?? 10, 1e-9);
    const roff = Math.max(component.offResistance.value ?? 1e6, 1e-6);
    const fromKnown = nodeVoltages.get(component.from) ?? 0;
    const toKnown = nodeVoltages.get(component.to) ?? 0;
    return fromKnown - toKnown >= vd ? ron : roff;
  }

  if (component.catalogTypeId === 'bjt') {
    const beta = Math.max(component.beta.value ?? 100, 1e-9);
    return Math.max(1000 / beta, 1e-6);
  }

  const fallbackOn = 1e-6;
  const fallbackOff = 1e12;

  if (component.catalogTypeId === 'mosfet' || usesSharedSwitchBehavior(component.catalogTypeId)) {
    const onResistanceRaw = component.onResistance.value;
    const onResistance = onResistanceRaw != null && Number.isFinite(onResistanceRaw) && onResistanceRaw > 0 ? onResistanceRaw : fallbackOn;
    const offLeakage = 'offLeakageCurrent' in component ? component.offLeakageCurrent.value ?? 0 : 0;
    const controlThreshold = component.catalogTypeId === 'mosfet'
      ? component.thresholdVoltage.value ?? 0
      : component.controlThreshold.value ?? 0;
    const hysteresis = component.hysteresis?.value ?? 0;
    const controlSignal = component.controlSignal?.value ?? 0;
    const prevState = 'state' in component ? component.state : undefined;
    const closedThreshold = controlThreshold + Math.max(hysteresis, 0) / 2;
    const openThreshold = controlThreshold - Math.max(hysteresis, 0) / 2;

    let isClosed = controlSignal >= closedThreshold;
    if (prevState === 'closed' && controlSignal > openThreshold) {
      isClosed = true;
    }
    if (prevState === 'open' && controlSignal < closedThreshold) {
      isClosed = false;
    }

    if (!Number.isFinite(onResistanceRaw ?? Number.NaN) || onResistanceRaw == null || onResistanceRaw <= 0) {
      diagnostics.push({
        code: 'unsupported_component_behavior',
        severity: 'warning',
        message: `Switch ${component.id} has invalid on-resistance; using near-ideal fallback.`,
        componentId: component.id
      });
      diagnostics.push({
        code: 'switch_fallback_applied' as SolverDiagnostic['code'],
        severity: 'info',
        message: `Switch ${component.id} fallback applied for on-state resistance.`,
        componentId: component.id
      });
    }

    const leakageReference = Math.max(Math.abs(controlThreshold), 1);
    const offResistance = offLeakage > 0 ? Math.max(leakageReference / offLeakage, onResistance * 10) : fallbackOff;
    return isClosed ? onResistance : offResistance;
  }

  return fallbackOff;
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

    const expectedUnit = componentUnits[component.catalogTypeId];
    if (expectedUnit != null) {
      const valueMetadata = getComponentValueMetadata(component);
      if (valueMetadata == null || valueMetadata.value == null) {
        diagnostics.push({
          code: 'missing_constitutive_value',
          severity: 'error',
          message: `Component ${component.id} is missing a required ${component.catalogTypeId} value.`,
          componentId: component.id
        });
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

    if (isSensorComponent(component)) {
      const supplyMin = component.supplyMin.value;
      const supplyMax = component.supplyMax.value;
      if (supplyMin == null || supplyMax == null || supplyMin >= supplyMax) {
        diagnostics.push({
          code: 'constraint_violation',
          severity: 'error',
          message: `Component ${component.id}: supplyMin must be less than supplyMax.`,
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

        const unvisited = circuit.nodes.map((node) => node.id).filter((nodeId) => !visited.has(nodeId));
        const groups: string[][] = [];
        const pending = new Set(unvisited);
        while (pending.size > 0) {
          const seed = pending.values().next().value as string;
          pending.delete(seed);
          const group = [seed];
          const q = [seed];
          while (q.length > 0) {
            const current = q.shift();
            if (current == null) {
              continue;
            }
            for (const neighbor of adjacency.get(current) ?? []) {
              if (pending.has(neighbor)) {
                pending.delete(neighbor);
                group.push(neighbor);
                q.push(neighbor);
              }
            }
          }
          groups.push(group);
        }

        diagnostics.push({
          code: 'floating_node_groups',
          severity: 'error',
          message: `Floating node group(s): ${groups.map((group) => group.join(', ')).join(' | ')}.`
        });
      }
    }
  }

  return diagnostics;
};

type EquationBuild = {
  A: number[][];
  b: number[];
  equationTrace: EquationTraceRow[];
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
    (component) => component.catalogTypeId === 'voltage-source' || component.catalogTypeId === 'ac-voltage-source' || component.catalogTypeId === 'pulse-voltage-source' || component.catalogTypeId === 'reference-source' || component.catalogTypeId === 'battery-cell' || component.catalogTypeId === 'battery-pack' || component.catalogTypeId === 'battery-coin-cell' || component.catalogTypeId === 'ldo-regulator' || component.catalogTypeId === 'buck-regulator' || component.catalogTypeId === 'boost-regulator' || component.catalogTypeId === 'charge-pump' || component.catalogTypeId === 'wire' || component.catalogTypeId === 'inductor' || component.kind === 'sensor'
  );

  const sourceCurrentVarIds = voltageConstraintComponents.map((component) => component.id);
  const unknownCount = unknownNodeIds.length + sourceCurrentVarIds.length;

  const A: number[][] = [];
  const b: number[] = [];
  const equationTrace: EquationTraceRow[] = [];

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
    const rowTerms: EquationTraceTerm[] = [];
    const rowConstants: EquationTraceConstant[] = [];

    for (const component of circuit.components) {
      if (component.catalogTypeId === 'resistor') {
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

        const selfContribution = addCoefficient(row, `V:${selfNode}`, sign * conductance);
        if (selfContribution !== 0) {
          rowTerms.push({
            componentId: component.id,
            variableKey: `V:${selfNode}`,
            coefficient: selfContribution,
            description: `${component.id} conductance @ ${selfNode}`
          });
        }

        const otherContribution = addCoefficient(row, `V:${otherNode}`, -sign * conductance);
        if (otherContribution !== 0) {
          rowTerms.push({
            componentId: component.id,
            variableKey: `V:${otherNode}`,
            coefficient: otherContribution,
            description: `${component.id} conductance @ ${otherNode}`
          });
        }

        const knownOther = getKnownVoltage(otherNode);
        if (knownOther != null) {
          const contribution = sign * conductance * knownOther;
          rhs += contribution;
          rowConstants.push({
            componentId: component.id,
            value: contribution,
            description: `${component.id} known voltage on ${otherNode}`
          });
        }
        const knownSelf = getKnownVoltage(selfNode);
        if (knownSelf != null) {
          const contribution = -sign * conductance * knownSelf;
          rhs += contribution;
          rowConstants.push({
            componentId: component.id,
            value: contribution,
            description: `${component.id} known voltage on ${selfNode}`
          });
        }
      } else if (component.kind === 'switch') {
        const resistance = getSwitchEquivalentResistance(component, knownNodeVoltages, diagnostics);
        if (resistance > 0) {
          const conductance = 1 / resistance;
          const isFrom = component.from === nodeId;
          const isTo = component.to === nodeId;
          if (isFrom || isTo) {
            const sign = isFrom ? 1 : -1;
            addCoefficient(row, `V:${component.from}`, sign * conductance);
            addCoefficient(row, `V:${component.to}`, -sign * conductance);
          }
        }
      } else if (component.catalogTypeId === 'op-amp' || component.catalogTypeId === 'comparator' || component.catalogTypeId === 'instrumentation-amplifier' || component.catalogTypeId === 'generic-regulator-controller' || component.catalogTypeId === 'voltage-reference') {
        const gain = component.gain.value ?? 1e5;
        const offset = component.inputOffset?.value ?? 0;
        const effectiveGain = gain * (1 + Math.abs(offset));
        const g = Math.min(Math.abs(effectiveGain), 1e6) / 1e6;
        const isFrom = component.from === nodeId;
        const isTo = component.to === nodeId;
        if (isFrom || isTo) {
          const sign = isFrom ? 1 : -1;
          addCoefficient(row, `V:${component.from}`, sign * g);
          addCoefficient(row, `V:${component.to}`, -sign * g);
        }
      } else if (component.kind === 'digital' && isDigitalCatalogType(component.catalogTypeId)) {
        const inV = getKnownVoltage(component.from) ?? 0;
        const outV = resolveDigitalOutputVoltage(component, inV);
        if (component.to === nodeId) {
          rhs += outV;
        }
      } else if (component.catalogTypeId === 'current-source' || component.catalogTypeId === 'current-regulator') {
        const baseCurrent = component.current.value ?? 0;
        const ripple = component.nonIdeal?.rippleAmplitude?.value ?? 0;
        const current = baseCurrent + ripple;
        if (component.from === nodeId) {
          rhs -= current;
          rowConstants.push({ componentId: component.id, value: -current, description: `${component.id} source current leaving ${nodeId}` });
        }
        if (component.to === nodeId) {
          rhs += current;
          rowConstants.push({ componentId: component.id, value: current, description: `${component.id} source current entering ${nodeId}` });
        }
      } else if (component.catalogTypeId === 'voltage-source' || component.catalogTypeId === 'ac-voltage-source' || component.catalogTypeId === 'pulse-voltage-source' || component.catalogTypeId === 'reference-source' || component.catalogTypeId === 'battery-cell' || component.catalogTypeId === 'battery-pack' || component.catalogTypeId === 'battery-coin-cell' || component.catalogTypeId === 'ldo-regulator' || component.catalogTypeId === 'buck-regulator' || component.catalogTypeId === 'boost-regulator' || component.catalogTypeId === 'charge-pump' || component.catalogTypeId === 'wire' || component.catalogTypeId === 'inductor') {
        if ((component.catalogTypeId === 'voltage-source' || component.catalogTypeId === 'reference-source' || component.catalogTypeId === 'battery-cell' || component.catalogTypeId === 'battery-pack' || component.catalogTypeId === 'battery-coin-cell' || component.catalogTypeId === 'ldo-regulator' || component.catalogTypeId === 'buck-regulator' || component.catalogTypeId === 'boost-regulator' || component.catalogTypeId === 'ac-voltage-source' || component.catalogTypeId === 'pulse-voltage-source' || component.catalogTypeId === 'charge-pump') && (component.nonIdeal?.internalResistance?.value ?? 0) > 0) {
          const r = component.nonIdeal?.internalResistance?.value ?? 0;
          const g = 1 / r;
          const isFrom = component.from === nodeId;
          const isTo = component.to === nodeId;
          if (isFrom || isTo) {
            const sign = isFrom ? 1 : -1;
            addCoefficient(row, `V:${component.from}`, sign * g);
            addCoefficient(row, `V:${component.to}`, -sign * g);
          }
        }
        if (component.from === nodeId) {
          const contribution = addCoefficient(row, `I:${component.id}`, 1);
          if (contribution !== 0) {
            rowTerms.push({ componentId: component.id, variableKey: `I:${component.id}`, coefficient: contribution, description: `${component.id} branch current leaving ${nodeId}` });
          }
        }
        if (component.to === nodeId) {
          const contribution = addCoefficient(row, `I:${component.id}`, -1);
          if (contribution !== 0) {
            rowTerms.push({ componentId: component.id, variableKey: `I:${component.id}`, coefficient: contribution, description: `${component.id} branch current entering ${nodeId}` });
          }
        }
      } else if (component.catalogTypeId === 'capacitor') {
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
    equationTrace.push({
      rowIndex: equationTrace.length,
      rowId: `kcl:${nodeId}`,
      rowType: 'kcl',
      kclNodeId: nodeId,
      terms: rowTerms,
      constants: rowConstants,
      rhs: -rhs
    });
  }

  for (const component of voltageConstraintComponents) {
    const row = new Array<number>(unknownCount).fill(0);
    const sourceVoltage = isSensorComponent(component)
      ? getSensorOutputVoltage(component, diagnostics)
      : isVoltageLikeSource(component.catalogTypeId) && 'voltage' in component
        ? (component.voltage.value ?? 0)
        : 0;
    const rowTerms: EquationTraceTerm[] = [];
    const rowConstants: EquationTraceConstant[] = [];

    const fromKnown = getKnownVoltage(component.from);
    const toKnown = getKnownVoltage(component.to);

    const fromContribution = addCoefficient(row, `V:${component.from}`, 1);
    if (fromContribution !== 0) {
      rowTerms.push({ componentId: component.id, variableKey: `V:${component.from}`, coefficient: fromContribution, description: `${component.id} positive terminal (${component.from})` });
    }
    const toContribution = addCoefficient(row, `V:${component.to}`, -1);
    if (toContribution !== 0) {
      rowTerms.push({ componentId: component.id, variableKey: `V:${component.to}`, coefficient: toContribution, description: `${component.id} negative terminal (${component.to})` });
    }

    let rhs = sourceVoltage;
    rowConstants.push({ componentId: component.id, value: sourceVoltage, description: `${component.id} imposed source voltage` });
    if (fromKnown != null) {
      rhs -= fromKnown;
      rowConstants.push({ componentId: component.id, value: -fromKnown, description: `Known voltage at ${component.from}` });
    }
    if (toKnown != null) {
      rhs += toKnown;
      rowConstants.push({ componentId: component.id, value: toKnown, description: `Known voltage at ${component.to}` });
    }

    A.push(row);
    b.push(rhs);
    equationTrace.push({
      rowIndex: equationTrace.length,
      rowId: `constraint:${component.id}`,
      rowType: 'constraint',
      constrainedComponentId: component.id,
      terms: rowTerms,
      constants: rowConstants,
      rhs
    });
  }

  return { A, b, equationTrace, unknownNodeIds, sourceCurrentVarIds, knownNodeVoltages, diagnostics };
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

const findConflictingIdealVoltageSources = (circuitState: CircuitState): SolverDiagnostic[] => {
  const grouped = new Map<string, Array<{ id: string; value: number }>>();

  for (const component of circuitState.components) {
    if (component.catalogTypeId !== 'voltage-source') {
      continue;
    }
    const value = component.voltage.value;
    if (value == null) {
      continue;
    }

    const key = [component.from, component.to].sort().join('::');
    const orientedValue = component.from < component.to ? value : -value;
    const bucket = grouped.get(key) ?? [];
    bucket.push({ id: component.id, value: orientedValue });
    grouped.set(key, bucket);
  }

  const diagnostics: SolverDiagnostic[] = [];
  for (const [pairKey, entries] of grouped) {
    if (entries.length < 2) {
      continue;
    }
    const first = entries[0]?.value;
    if (entries.some((entry) => Math.abs(entry.value - (first ?? 0)) > 1e-9)) {
      diagnostics.push({
        code: 'conflicting_ideal_voltage_sources',
        severity: 'error',
        message: `Conflicting ideal voltage sources across node pair ${pairKey}: ${entries.map((entry) => `${entry.id}=${entry.value}`).join(', ')}.`
      });
    }
  }

  return diagnostics;
};

const isDigitalCatalogType = (catalogTypeId: CircuitComponent['catalogTypeId']): boolean =>
  [
    'logic-gate',
    'logic-buffer',
    'logic-schmitt-trigger',
    'logic-tri-state-buffer',
    'logic-latch',
    'logic-flip-flop',
    'logic-counter',
    'logic-multiplexer'
  ].includes(catalogTypeId);

const resolveDigitalOutputVoltage = (component: Extract<CircuitComponent, { kind: 'digital' }>, inputVoltage: number): number => {
  const highThreshold = component.bridge.highThreshold.value ?? 3;
  const lowThreshold = component.bridge.lowThreshold.value ?? 1;
  const highLevel = component.bridge.highLevel.value ?? 5;
  const lowLevel = component.bridge.lowLevel.value ?? 0;
  const inverting = component.gateType === 'not' || component.gateType === 'nand' || component.gateType === 'nor';

  const fallbackHigh = component.pullDefault === 'pull-up';
  const logicalHigh = inputVoltage >= highThreshold ? true : inputVoltage <= lowThreshold ? false : fallbackHigh;
  const resolvedHigh = inverting ? !logicalHigh : logicalHigh;
  return resolvedHigh ? highLevel : lowLevel;
};

const solveCircuitCore = (circuitState: CircuitState): SolveCircuitResult => {
  const diagnostics = validateCircuit(circuitState);
  const hasErrors = diagnostics.some((diagnostic) => diagnostic.severity === 'error');
  if (hasErrors) {
    return { values: {}, diagnostics, equationTrace: [] };
  }

  const equationBuild = buildEquations(circuitState);
  diagnostics.push(...equationBuild.diagnostics);

  const variableCount = equationBuild.A[0]?.length ?? 0;
  if (variableCount === 0) {
    return { values: {}, diagnostics, equationTrace: equationBuild.equationTrace };
  }

  const { solution, rankA, rankAugmented } = solveLinearSystem(equationBuild.A, equationBuild.b);

  if (rankA < rankAugmented) {
    diagnostics.push({
      code: 'overdetermined',
      severity: 'error',
      message: 'Circuit equations are inconsistent (overdetermined).'
    });
    diagnostics.push(...findConflictingIdealVoltageSources(circuitState));
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

    if (component.catalogTypeId === 'resistor' && component.resistance.value != null && component.resistance.value !== 0) {
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

    if (component.kind === 'switch') {
      const r = Math.max(getSwitchEquivalentResistance(component, new Map(), diagnostics), 1e-12);
      values[`component:${component.id}:current`] = toSolvedValue(`component:${component.id}:current`, 'A', drop / r, false, true);
    }

    if (component.catalogTypeId === 'op-amp' || component.catalogTypeId === 'comparator' || component.catalogTypeId === 'instrumentation-amplifier' || component.catalogTypeId === 'generic-regulator-controller' || component.catalogTypeId === 'voltage-reference') {
      const hi = component.outputLimitHigh.value ?? 12;
      const lo = component.outputLimitLow.value ?? -12;
      const offset = component.inputOffset?.value ?? 0;
      const out = Math.min(hi, Math.max(lo, (component.gain.value ?? 1) * (drop + offset)));
      values[`component:${component.id}:output`] = toSolvedValue(`component:${component.id}:output`, 'V', out, false, true);
    }

    if (component.kind === 'digital' && isDigitalCatalogType(component.catalogTypeId)) {
      const v = resolveDigitalOutputVoltage(component, drop);
      values[`component:${component.id}:logic_output`] = toSolvedValue(`component:${component.id}:logic_output`, 'V', v, false, true);
    }

    if (component.catalogTypeId === 'current-source') {
      values[`component:${component.id}:current`] = toSolvedValue(
        `component:${component.id}:current`,
        'A',
        component.current.value,
        true,
        false
      );
    }

    if (component.catalogTypeId === 'voltage-source' || component.catalogTypeId === 'ac-voltage-source' || component.catalogTypeId === 'pulse-voltage-source' || component.catalogTypeId === 'reference-source' || component.catalogTypeId === 'battery-cell' || component.catalogTypeId === 'battery-pack' || component.catalogTypeId === 'battery-coin-cell' || component.catalogTypeId === 'ldo-regulator' || component.catalogTypeId === 'buck-regulator' || component.catalogTypeId === 'boost-regulator' || component.catalogTypeId === 'charge-pump') {
      values[`component:${component.id}:voltage`] = toSolvedValue(
        `component:${component.id}:voltage`,
        'V',
        component.voltage.value,
        true,
        false
      );
    }
  }

  return { values, diagnostics, equationTrace: equationBuild.equationTrace };
};

export const solveCircuit = (circuitState: CircuitState, options?: SolveCircuitOptions): SolveCircuitResult => {
  const capabilityDiagnostics = getUnsupportedComponentDiagnostics(circuitState, 'dc');
  const supportedCircuit = filterCircuitByCapability(circuitState, 'dc');
  const baseResult = solveCircuitCore(supportedCircuit);
  const diagnostics = [...baseResult.diagnostics, ...capabilityDiagnostics];

  if (options?.target) {
    const targetKey = getTargetKey(options.target);
    const hasSolveError = diagnostics.some((diagnostic) => diagnostic.severity === 'error');
    if (hasSolveError) {
      diagnostics.push({
        code: 'target_unsolvable',
        severity: 'error',
        message: `Target ${targetKey} is unsolvable because circuit equations failed.`
      });
    } else if (!(targetKey in baseResult.values)) {
      diagnostics.push({
        code: 'target_not_found',
        severity: 'error',
        message: `Target ${targetKey} was not found in solved outputs.`
      });
    }

    if (diagnostics.some((diagnostic) => diagnostic.code === 'underdetermined')) {
      diagnostics.push({
        code: 'target_non_unique',
        severity: 'error',
        message: `Target ${targetKey} is not unique with the current constraints.`
      });
    }
  }

  if (options?.monteCarlo == null) {
    return { ...baseResult, diagnostics };
  }

  const monteCarloAnalysis = runMonteCarloAnalysis(supportedCircuit, options.monteCarlo, solveCircuitCore, capabilityDiagnostics);
  return {
    ...baseResult,
    diagnostics: [...diagnostics, ...monteCarloAnalysis.diagnostics],
    monteCarlo: monteCarloAnalysis.monteCarlo
  };
};


export type SolveForTargetResult = SolveCircuitResult & {
  target?: TargetSolveResult;
};

function getTargetKey(target: SolveTarget): string {
  if (target.type === 'node_voltage') {
    return `node:${target.nodeId}:voltage`;
  }
  if (target.type === 'component_current') {
    return `component:${target.componentId}:current`;
  }
  return `component:${target.componentId}:resistance`;
}

function getTargetDependencies(target: SolveTarget, circuitState: CircuitState): string[] {
  if (target.type === 'node_voltage') {
    const incident = circuitState.components
      .filter((component) => component.from === target.nodeId || component.to === target.nodeId)
      .map((component) => `component:${component.id}`);
    return [`node:${target.nodeId}`, ...incident];
  }

  const component = circuitState.components.find((entry) => entry.id === target.componentId);
  if (!component) {
    return [`component:${target.componentId}`];
  }

  return [`component:${component.id}`, `node:${component.from}`, `node:${component.to}`];
}

function getTargetUnit(target: SolveTarget, values: Record<string, SolvedCircuitValue>): Unit {
  const key = getTargetKey(target);
  return values[key]?.unit ?? (target.type === 'component_value' ? 'Ω' : target.type === 'component_current' ? 'A' : 'V');
}

export const solveCircuitForTarget = (circuitState: CircuitState, target: SolveTarget, options?: Omit<SolveCircuitOptions, 'target'>): SolveForTargetResult => {
  const baseResult = solveCircuit(circuitState, { ...options, target });
  const targetKey = getTargetKey(target);
  const targetValue = baseResult.values[targetKey];
  const dependencies = getTargetDependencies(target, circuitState);
  const unique = !baseResult.diagnostics.some((diagnostic) => diagnostic.code === 'underdetermined' || diagnostic.code === 'target_non_unique');

  return {
    ...baseResult,
    target: {
      key: targetKey,
      value: targetValue?.value,
      unit: targetValue?.unit ?? getTargetUnit(target, baseResult.values),
      dependencies,
      unique
    }
  };
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

export type { CircuitNode, CircuitState, SolveCircuitResult, SolveTarget, TargetSolveResult } from './model';
