import type { CircuitState, SolveCircuitResult, SolverDiagnostic } from './model';
import type { CircuitValues } from './solver';
import { runDcAnalysis } from './analysis/dc';
import { runAcAnalysis, type AcAnalysisOptions, type AcAnalysisResult } from './analysis/ac';
import { runTransientAnalysis, type TransientAnalysisOptions, type TransientAnalysisResult } from './analysis/transient';

export type SimulationState = Required<CircuitValues> & { time: number };

export type RunAnalysisRequest =
  | { mode?: 'dc'; options?: undefined }
  | { mode: 'ac'; options: AcAnalysisOptions }
  | { mode: 'transient'; options: TransientAnalysisOptions };

export type DcRunAnalysisResult = { mode: 'dc'; result: SolveCircuitResult; diagnostics: SolverDiagnostic[] };
export type RunAnalysisResult = DcRunAnalysisResult | AcAnalysisResult | TransientAnalysisResult;

export function runAnalysis(circuit: CircuitState, request?: { mode?: 'dc'; options?: undefined }): DcRunAnalysisResult;
export function runAnalysis(circuit: CircuitState, request: { mode: 'ac'; options: AcAnalysisOptions }): AcAnalysisResult;
export function runAnalysis(circuit: CircuitState, request: { mode: 'transient'; options: TransientAnalysisOptions }): TransientAnalysisResult;
export function runAnalysis(circuit: CircuitState, request: RunAnalysisRequest = { mode: 'dc' }): RunAnalysisResult {
  const mode = request.mode ?? 'dc';

  if (mode === 'ac') {
    return runAcAnalysis(circuit, request.options as AcAnalysisOptions);
  }

  if (mode === 'transient') {
    return runTransientAnalysis(circuit, request.options as TransientAnalysisOptions);
  }

  const result = runDcAnalysis(circuit);
  return {
    mode: 'dc',
    result,
    diagnostics: result.diagnostics
  };
}

export const simulateStep = (values: Pick<Required<CircuitValues>, 'voltage' | 'resistance'>, deltaTime: number): SimulationState => {
  const current = values.resistance === 0 ? 0 : values.voltage / values.resistance;

  return {
    voltage: values.voltage,
    resistance: values.resistance,
    current,
    time: deltaTime
  };
};
