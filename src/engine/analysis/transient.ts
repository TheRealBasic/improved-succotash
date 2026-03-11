import type { CircuitComponent, CircuitState, SolverDiagnostic } from '../model';
import { filterCircuitByCapability, getUnsupportedComponentDiagnostics } from '../componentBehavior';

type TrPoint = { time: number; nodeVoltages: Record<string, number> };

export type TransientAnalysisOptions = {
  timeStep: number;
  totalTime: number;
  initialCapacitorVoltages?: Record<string, number>;
  initialInductorCurrents?: Record<string, number>;
  sourceSteps?: Record<string, { before: number; after: number; at: number }>;
};

export type TransientAnalysisResult = {
  mode: 'transient';
  waveform: TrPoint[];
  diagnostics: SolverDiagnostic[];
};

const solveLinearSystem = (A: number[][], b: number[]): number[] => {
  const n = A.length;
  if (n === 0) {
    return [];
  }
  const M = A.map((row, i) => [...row, b[i] ?? 0]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) {
        pivot = r;
      }
    }
    if (Math.abs(M[pivot][col]) < 1e-12) {
      continue;
    }
    [M[col], M[pivot]] = [M[pivot], M[col]];

    const pivotValue = M[col][col];
    for (let k = col; k <= n; k += 1) {
      M[col][k] /= pivotValue;
    }

    for (let r = 0; r < n; r += 1) {
      if (r === col) {
        continue;
      }
      const factor = M[r][col];
      if (Math.abs(factor) < 1e-12) {
        continue;
      }
      for (let k = col; k <= n; k += 1) {
        M[r][k] -= factor * M[col][k];
      }
    }
  }

  return M.map((row) => row[n]);
};

const sourceVoltageAt = (component: CircuitComponent, time: number, sourceSteps?: TransientAnalysisOptions['sourceSteps']): number => {
  if (component.catalogTypeId !== 'voltage-source') {
    return 0;
  }
  const step = sourceSteps?.[component.id];
  if (!step) {
    return component.voltage.value ?? 0;
  }
  return time < step.at ? step.before : step.after;
};

export const runTransientAnalysis = (circuit: CircuitState, options: TransientAnalysisOptions): TransientAnalysisResult => {
  const diagnostics = getUnsupportedComponentDiagnostics(circuit, 'transient');
  const supportedCircuit = filterCircuitByCapability(circuit, 'transient');

  const nodeIds = supportedCircuit.nodes.filter((node) => !node.reference).map((node) => node.id);
  const nodeMap = new Map(nodeIds.map((id, idx) => [id, idx]));
  const voltageSources = supportedCircuit.components.filter((component) => component.catalogTypeId === 'voltage-source' || component.catalogTypeId === 'wire');
  const size = nodeIds.length + voltageSources.length;

  const capacitorState = new Map<string, number>();
  const inductorState = new Map<string, number>();
  supportedCircuit.components.forEach((component) => {
    if (component.catalogTypeId === 'capacitor') {
      capacitorState.set(component.id, options.initialCapacitorVoltages?.[component.id] ?? 0);
    }
    if (component.catalogTypeId === 'inductor') {
      inductorState.set(component.id, options.initialInductorCurrents?.[component.id] ?? 0);
    }
  });

  const points = Math.max(1, Math.floor(options.totalTime / options.timeStep));
  const waveform: TrPoint[] = [];

  for (let step = 0; step <= points; step += 1) {
    const time = step * options.timeStep;
    const A = Array.from({ length: size }, () => Array.from({ length: size }, () => 0));
    const z = Array.from({ length: size }, () => 0);

    const stampConductance = (from: string, to: string, g: number) => {
      const i = nodeMap.get(from);
      const j = nodeMap.get(to);
      if (i != null) A[i][i] += g;
      if (j != null) A[j][j] += g;
      if (i != null && j != null) {
        A[i][j] -= g;
        A[j][i] -= g;
      }
    };

    const stampCurrent = (from: string, to: string, current: number) => {
      const i = nodeMap.get(from);
      const j = nodeMap.get(to);
      if (i != null) z[i] -= current;
      if (j != null) z[j] += current;
    };

    for (const component of supportedCircuit.components) {
      if (component.catalogTypeId === 'resistor' && component.resistance.value) {
        stampConductance(component.from, component.to, 1 / component.resistance.value);
      } else if (component.catalogTypeId === 'current-source') {
        stampCurrent(component.from, component.to, (component.current.value ?? 0) + (component.nonIdeal?.rippleAmplitude?.value ?? 0));
      } else if (component.catalogTypeId === 'capacitor') {
        const C = component.capacitance.value ?? 0;
        const G = options.timeStep === 0 ? 0 : C / options.timeStep;
        const vPrev = capacitorState.get(component.id) ?? 0;
        const iEq = -G * vPrev;
        stampConductance(component.from, component.to, G);
        stampCurrent(component.from, component.to, iEq);
      } else if (component.catalogTypeId === 'inductor') {
        const L = component.inductance.value ?? 0;
        const G = L === 0 ? 1e12 : options.timeStep / L;
        const iPrev = inductorState.get(component.id) ?? 0;
        stampConductance(component.from, component.to, G);
        stampCurrent(component.from, component.to, iPrev);
      }
    }

    voltageSources.forEach((source, idx) => {
      const k = nodeIds.length + idx;
      const fromIdx = nodeMap.get(source.from);
      const toIdx = nodeMap.get(source.to);
      if (fromIdx != null) {
        A[fromIdx][k] += 1;
        A[k][fromIdx] += 1;
      }
      if (toIdx != null) {
        A[toIdx][k] -= 1;
        A[k][toIdx] -= 1;
      }
      z[k] = sourceVoltageAt(source, time, options.sourceSteps);
    });

    const solution = solveLinearSystem(A, z);
    const nodeVoltages: Record<string, number> = {};
    supportedCircuit.nodes.forEach((node) => {
      nodeVoltages[node.id] = node.reference ? 0 : (solution[nodeMap.get(node.id) ?? -1] ?? 0);
    });
    waveform.push({ time, nodeVoltages });

    for (const component of supportedCircuit.components) {
      if (component.catalogTypeId === 'capacitor') {
        const v = (nodeVoltages[component.from] ?? 0) - (nodeVoltages[component.to] ?? 0);
        capacitorState.set(component.id, v);
      }
      if (component.catalogTypeId === 'inductor') {
        const L = component.inductance.value ?? 0;
        const G = L === 0 ? 1e12 : options.timeStep / L;
        const v = (nodeVoltages[component.from] ?? 0) - (nodeVoltages[component.to] ?? 0);
        const iPrev = inductorState.get(component.id) ?? 0;
        inductorState.set(component.id, G * v + iPrev);
      }
    }
  }

  return { mode: 'transient', waveform, diagnostics };
};
