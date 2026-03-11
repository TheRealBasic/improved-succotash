import { solveCircuit } from '../solver';
import type { CircuitState, SolveCircuitResult } from '../model';

export type DcAnalysisResult = SolveCircuitResult;

export const runDcAnalysis = (circuit: CircuitState): DcAnalysisResult => solveCircuit(circuit);
