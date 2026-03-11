import type { CircuitValues } from './solver';

export type SimulationState = Required<CircuitValues> & { time: number };

export const simulateStep = (values: Pick<Required<CircuitValues>, 'voltage' | 'resistance'>, deltaTime: number): SimulationState => {
  const current = values.resistance === 0 ? 0 : values.voltage / values.resistance;

  return {
    voltage: values.voltage,
    resistance: values.resistance,
    current,
    time: deltaTime
  };
};
