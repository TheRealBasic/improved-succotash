import { describe, expect, it } from 'vitest';
import { solveCircuitValues } from '../engine/solver';

describe('solveCircuitValues', () => {
  it('solves current from voltage and resistance', () => {
    const result = solveCircuitValues({ voltage: 12, resistance: 6 });
    expect(result.current).toBe(2);
  });
});
