import { useState } from 'react';
import { solveCircuitValues } from '../engine/solver';

export const PropertyPanel = () => {
  const [voltage, setVoltage] = useState<number | undefined>(5);
  const [current, setCurrent] = useState<number | undefined>(undefined);
  const [resistance, setResistance] = useState<number | undefined>(10);

  const solution = solveCircuitValues({ voltage, current, resistance });

  return (
    <aside className="panel property-panel">
      <h2>Property Panel</h2>
      <label>
        Voltage (V)
        <input type="number" value={voltage ?? ''} onChange={(e) => setVoltage(e.target.value ? Number(e.target.value) : undefined)} />
      </label>
      <label>
        Current (A)
        <input type="number" value={current ?? ''} onChange={(e) => setCurrent(e.target.value ? Number(e.target.value) : undefined)} />
      </label>
      <label>
        Resistance (Ω)
        <input type="number" value={resistance ?? ''} onChange={(e) => setResistance(e.target.value ? Number(e.target.value) : undefined)} />
      </label>
      <p className="result">Solved: {solution.summary}</p>
    </aside>
  );
};
