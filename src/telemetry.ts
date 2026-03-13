import type { SolverDiagnostic } from './engine/model';

export type AnalysisMode = 'dc' | 'ac';

export type TelemetryEvent =
  | {
      event: 'component_placed';
      componentId: string;
      componentType: string;
      analysisMode: AnalysisMode;
      ts: number;
    }
  | {
      event: 'component_property_edited';
      componentId: string;
      propertyKey: string;
      analysisMode: AnalysisMode;
      ts: number;
    }
  | {
      event: 'solver_diagnostic';
      componentId?: string;
      analysisMode: AnalysisMode;
      diagnosticCode: SolverDiagnostic['code'];
      severity: SolverDiagnostic['severity'];
      ts: number;
    };

export type TelemetryListener = (event: TelemetryEvent) => void;

export type TelemetryEnv = {
  DEV?: boolean;
  MODE?: string;
  VITE_DISABLE_TELEMETRY?: string;
  VITE_ENABLE_DEV_TELEMETRY?: string;
};

const listeners = new Set<TelemetryListener>();

export const isTelemetryEnabled = (env: TelemetryEnv = import.meta.env): boolean => {
  if (env.VITE_DISABLE_TELEMETRY === 'true') {
    return false;
  }

  if (env.DEV && env.VITE_ENABLE_DEV_TELEMETRY !== 'true') {
    return false;
  }

  return true;
};

export const subscribeTelemetry = (listener: TelemetryListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const emitTelemetryEvent = (event: TelemetryEvent, env: TelemetryEnv = import.meta.env): void => {
  if (!isTelemetryEnabled(env)) {
    return;
  }

  listeners.forEach((listener) => listener(event));
};

export const trackComponentPlaced = (params: {
  componentId: string;
  componentType: string;
  analysisMode: AnalysisMode;
  env?: TelemetryEnv;
}): void => {
  emitTelemetryEvent(
    {
      event: 'component_placed',
      componentId: params.componentId,
      componentType: params.componentType,
      analysisMode: params.analysisMode,
      ts: Date.now()
    },
    params.env
  );
};

export const trackComponentPropertyEdited = (params: {
  componentId: string;
  propertyKey: string;
  analysisMode: AnalysisMode;
  env?: TelemetryEnv;
}): void => {
  emitTelemetryEvent(
    {
      event: 'component_property_edited',
      componentId: params.componentId,
      propertyKey: params.propertyKey,
      analysisMode: params.analysisMode,
      ts: Date.now()
    },
    params.env
  );
};

export const trackSolverDiagnostics = (params: {
  diagnostics: SolverDiagnostic[];
  analysisMode: AnalysisMode;
  env?: TelemetryEnv;
}): void => {
  params.diagnostics.forEach((diagnostic) => {
    emitTelemetryEvent(
      {
        event: 'solver_diagnostic',
        componentId: diagnostic.componentId,
        analysisMode: params.analysisMode,
        diagnosticCode: diagnostic.code,
        severity: diagnostic.severity,
        ts: Date.now()
      },
      params.env
    );
  });
};
