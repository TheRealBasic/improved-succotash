import { describe, expect, it } from 'vitest';
import { circuitPresets } from '../presets';

const PRESET_KEYS = [
  'thermistorSensorDemo',
  'ldrSensorDemo',
  'hallSensorDemo',
  'pressureSensorDemo',
  'microphoneSensorDemo',
  'analogSensorDemo'
] as const;

describe('sensor presets', () => {
  it('includes a simple circuit preset for each sensor type', () => {
    for (const key of PRESET_KEYS) {
      const preset = circuitPresets[key];
      expect(preset, `missing preset ${key}`).toBeDefined();
      expect(preset.components.some((component) => component.kind === 'sensor')).toBe(true);
    }
  });
});
