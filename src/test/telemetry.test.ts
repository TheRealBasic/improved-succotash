import { describe, expect, it, vi } from 'vitest';
import {
  emitTelemetryEvent,
  isTelemetryEnabled,
  subscribeTelemetry,
  trackComponentPlaced,
  trackComponentPropertyEdited,
  trackSolverDiagnostics,
  type TelemetryEvent
} from '../telemetry';

describe('telemetry event payloads', () => {
  it('emits placement and property edit payloads with component id + analysis mode', () => {
    const listener = vi.fn<(event: TelemetryEvent) => void>();
    const unsubscribe = subscribeTelemetry(listener);

    trackComponentPlaced({ componentId: 'r1', componentType: 'resistor', analysisMode: 'dc', env: { DEV: false } });
    trackComponentPropertyEdited({ componentId: 'r1', propertyKey: 'resistance', analysisMode: 'ac', env: { DEV: false } });

    expect(listener).toHaveBeenCalledTimes(2);

    expect(listener.mock.calls[0][0]).toMatchObject({
      event: 'component_placed',
      componentId: 'r1',
      componentType: 'resistor',
      analysisMode: 'dc'
    });
    expect(listener.mock.calls[1][0]).toMatchObject({
      event: 'component_property_edited',
      componentId: 'r1',
      propertyKey: 'resistance',
      analysisMode: 'ac'
    });

    unsubscribe();
  });

  it('emits solver diagnostics with diagnostic code but omits message payload', () => {
    const listener = vi.fn<(event: TelemetryEvent) => void>();
    const unsubscribe = subscribeTelemetry(listener);

    trackSolverDiagnostics({
      analysisMode: 'dc',
      env: { DEV: false },
      diagnostics: [
        {
          code: 'missing_constitutive_value',
          severity: 'error',
          message: 'User-entered sensitive details should not be emitted.',
          componentId: 'v1'
        }
      ]
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({
      event: 'solver_diagnostic',
      componentId: 'v1',
      analysisMode: 'dc',
      diagnosticCode: 'missing_constitutive_value',
      severity: 'error'
    });
    expect(listener.mock.calls[0][0]).not.toHaveProperty('message');

    unsubscribe();
  });
});

describe('telemetry opt-out behavior', () => {
  it('is disabled by default in dev/local environments', () => {
    expect(isTelemetryEnabled({ DEV: true })).toBe(false);
    expect(isTelemetryEnabled({ DEV: true, VITE_ENABLE_DEV_TELEMETRY: 'true' })).toBe(true);
  });

  it('is disabled when explicit disable flag is set', () => {
    expect(isTelemetryEnabled({ DEV: false, VITE_DISABLE_TELEMETRY: 'true' })).toBe(false);
  });

  it('does not emit events while disabled', () => {
    const listener = vi.fn<(event: TelemetryEvent) => void>();
    const unsubscribe = subscribeTelemetry(listener);

    emitTelemetryEvent(
      {
        event: 'component_placed',
        componentId: 'r2',
        componentType: 'resistor',
        analysisMode: 'dc',
        ts: Date.now()
      },
      { DEV: true }
    );

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
