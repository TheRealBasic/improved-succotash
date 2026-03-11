import { describe, expect, it } from 'vitest';
import { parseValueWithUnit } from '../units/parseValueWithUnit';

describe('parseValueWithUnit', () => {
  it('parses SI prefixes without explicit units when expected unit is provided', () => {
    const result = parseValueWithUnit('10k', { expectedUnit: 'Ω' });
    expect('error' in result).toBe(false);
    if ('error' in result) {
      return;
    }

    expect(result.value).toBe(10000);
    expect(result.unit).toBe('Ω');
  });

  it('parses micro prefix with unit suffix', () => {
    const result = parseValueWithUnit('4.7uF', { expectedUnit: 'F' });
    expect('error' in result).toBe(false);
    if ('error' in result) {
      return;
    }

    expect(result.value).toBeCloseTo(4.7e-6);
    expect(result.unit).toBe('F');
  });

  it('supports unit-only suffix and dropdown fallback prefix', () => {
    const result = parseValueWithUnit('2A', { expectedUnit: 'A', fallbackPrefix: 'm' });
    expect('error' in result).toBe(false);
    if ('error' in result) {
      return;
    }

    expect(result.value).toBeCloseTo(0.002);
  });

  it('fails when provided unit is incompatible with expected unit', () => {
    const result = parseValueWithUnit('2mA', { expectedUnit: 'F' });
    expect(result).toEqual({ error: 'Unit A is incompatible with expected F.' });
  });
});
