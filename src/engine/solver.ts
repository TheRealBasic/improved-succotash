export type CircuitValues = {
  voltage?: number;
  current?: number;
  resistance?: number;
};

export type SolvedCircuitValues = Required<CircuitValues> & { summary: string };

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
