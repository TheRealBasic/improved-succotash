import type { CircuitComponent, CircuitState, SolverDiagnostic } from '../model';
import { filterCircuitByCapability, getUnsupportedComponentDiagnostics } from '../componentBehavior';

type Complex = { re: number; im: number };

const c = (re = 0, im = 0): Complex => ({ re, im });
const add = (a: Complex, b: Complex): Complex => c(a.re + b.re, a.im + b.im);
const sub = (a: Complex, b: Complex): Complex => c(a.re - b.re, a.im - b.im);
const mul = (a: Complex, b: Complex): Complex => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
const div = (a: Complex, b: Complex): Complex => {
  const denom = b.re * b.re + b.im * b.im;
  if (denom === 0) {
    return c(0, 0);
  }
  return c((a.re * b.re + a.im * b.im) / denom, (a.im * b.re - a.re * b.im) / denom);
};
const abs = (z: Complex): number => Math.hypot(z.re, z.im);

type AcPoint = {
  frequency: number;
  nodeVoltages: Record<string, Complex>;
  magnitude: Record<string, number>;
  phaseDeg: Record<string, number>;
};

export type AcAnalysisOptions = {
  startHz: number;
  stopHz: number;
  points: number;
};

export type AcAnalysisResult = {
  mode: 'ac';
  sweep: AcPoint[];
  diagnostics: SolverDiagnostic[];
};

const solveComplexLinearSystem = (A: Complex[][], b: Complex[]): Complex[] => {
  const n = A.length;
  if (n === 0) {
    return [];
  }
  const M = A.map((row, i) => [...row, b[i] ?? c()]);

  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (abs(M[r][col] ?? c()) > abs(M[pivot][col] ?? c())) {
        pivot = r;
      }
    }

    if (abs(M[pivot][col] ?? c()) < 1e-12) {
      continue;
    }

    [M[col], M[pivot]] = [M[pivot], M[col]];
    const pivotVal = M[col][col] ?? c(1, 0);
    for (let k = col; k <= n; k += 1) {
      M[col][k] = div(M[col][k] ?? c(), pivotVal);
    }

    for (let r = 0; r < n; r += 1) {
      if (r === col) {
        continue;
      }
      const factor = M[r][col] ?? c();
      if (abs(factor) < 1e-12) {
        continue;
      }
      for (let k = col; k <= n; k += 1) {
        M[r][k] = sub(M[r][k] ?? c(), mul(factor, M[col][k] ?? c()));
      }
    }
  }

  return M.map((row) => row[n] ?? c());
};

const linearSweep = (start: number, stop: number, points: number): number[] => {
  if (points <= 1) {
    return [start];
  }
  const step = (stop - start) / (points - 1);
  return Array.from({ length: points }, (_, i) => start + i * step);
};

const getSourceVoltage = (component: CircuitComponent): number => {
  if (component.catalogTypeId !== 'voltage-source') return 0;
  return (component.voltage.value ?? 0) + (component.nonIdeal?.rippleAmplitude?.value ?? 0);
};

const nodeIndexMap = (circuit: CircuitState): { nodeIds: string[]; map: Map<string, number> } => {
  const nodeIds = circuit.nodes.filter((node) => !node.reference).map((node) => node.id);
  return { nodeIds, map: new Map(nodeIds.map((id, idx) => [id, idx])) };
};

const buildAndSolveAtFrequency = (circuit: CircuitState, frequency: number): AcPoint => {
  const omega = 2 * Math.PI * frequency;
  const { nodeIds, map } = nodeIndexMap(circuit);
  const voltageSources = circuit.components.filter((component) => component.catalogTypeId === 'voltage-source' || component.catalogTypeId === 'wire');
  const size = nodeIds.length + voltageSources.length;

  const A: Complex[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => c()));
  const z: Complex[] = Array.from({ length: size }, () => c());

  const stampAdmittance = (from: string, to: string, y: Complex) => {
    const i = map.get(from);
    const j = map.get(to);
    if (i != null) A[i][i] = add(A[i][i], y);
    if (j != null) A[j][j] = add(A[j][j], y);
    if (i != null && j != null) {
      A[i][j] = sub(A[i][j], y);
      A[j][i] = sub(A[j][i], y);
    }
  };

  const stampCurrent = (from: string, to: string, current: Complex) => {
    const i = map.get(from);
    const j = map.get(to);
    if (i != null) z[i] = sub(z[i], current);
    if (j != null) z[j] = add(z[j], current);
  };

  for (const component of circuit.components) {
    if (component.catalogTypeId === 'resistor' && component.resistance.value) {
      stampAdmittance(component.from, component.to, c(1 / component.resistance.value, 0));
    } else if (component.catalogTypeId === 'capacitor') {
      const cap = component.capacitance.value ?? 0;
      stampAdmittance(component.from, component.to, c(0, omega * cap));
    } else if (component.catalogTypeId === 'inductor') {
      const L = component.inductance.value ?? 0;
      const y = omega === 0 || L === 0 ? c(1e12, 0) : c(0, -1 / (omega * L));
      stampAdmittance(component.from, component.to, y);
    } else if (component.catalogTypeId === 'current-source') {
      stampCurrent(component.from, component.to, c((component.current.value ?? 0) + (component.nonIdeal?.rippleAmplitude?.value ?? 0), 0));
    }
  }

  voltageSources.forEach((source, idx) => {
    const k = nodeIds.length + idx;
    const fromIdx = map.get(source.from);
    const toIdx = map.get(source.to);
    if (fromIdx != null) {
      A[fromIdx][k] = add(A[fromIdx][k], c(1, 0));
      A[k][fromIdx] = add(A[k][fromIdx], c(1, 0));
    }
    if (toIdx != null) {
      A[toIdx][k] = sub(A[toIdx][k], c(1, 0));
      A[k][toIdx] = sub(A[k][toIdx], c(1, 0));
    }
    z[k] = c(getSourceVoltage(source), 0);
  });

  const solution = solveComplexLinearSystem(A, z);
  const nodeVoltages: Record<string, Complex> = {};
  const magnitude: Record<string, number> = {};
  const phaseDeg: Record<string, number> = {};

  circuit.nodes.forEach((node) => {
    if (node.reference) {
      nodeVoltages[node.id] = c(0, 0);
      magnitude[node.id] = 0;
      phaseDeg[node.id] = 0;
      return;
    }
    const index = map.get(node.id);
    const value = index == null ? c() : (solution[index] ?? c());
    nodeVoltages[node.id] = value;
    magnitude[node.id] = abs(value);
    phaseDeg[node.id] = (Math.atan2(value.im, value.re) * 180) / Math.PI;
  });

  return { frequency, nodeVoltages, magnitude, phaseDeg };
};

export const runAcAnalysis = (circuit: CircuitState, options: AcAnalysisOptions): AcAnalysisResult => {
  const diagnostics = getUnsupportedComponentDiagnostics(circuit, 'ac');
  const supportedCircuit = filterCircuitByCapability(circuit, 'ac');

  return {
    mode: 'ac',
    sweep: linearSweep(options.startHz, options.stopHz, options.points).map((frequency) => buildAndSolveAtFrequency(supportedCircuit, frequency)),
    diagnostics
  };
};
