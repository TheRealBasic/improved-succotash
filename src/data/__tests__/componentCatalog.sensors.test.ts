import { describe, expect, it } from 'vitest';
import { COMPONENT_CATALOG_ITEMS } from '../componentCatalog';

const SENSOR_IDS = [
  'sensor-thermistor-probe',
  'sensor-ldr',
  'sensor-hall',
  'sensor-pressure',
  'sensor-microphone',
  'sensor-analog-generic'
] as const;

describe('sensor catalog blocks', () => {
  it('registers all transfer-function sensor entries with shared schema', () => {
    for (const id of SENSOR_IDS) {
      const item = COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === id);
      expect(item, `missing ${id}`).toBeDefined();
      expect(item?.editablePropertySchema).toMatchObject({
        sensitivity: { type: 'number' },
        offset: { type: 'number' },
        inputSignal: { type: 'number' },
        supplyMin: { type: 'number' },
        supplyMax: { type: 'number' },
        outputClampBehavior: { type: 'enum' }
      });
      expect(item?.solverBehavior.model).toBe('sensor-transfer');
      expect(item?.support.level).toBe('full');
    }
  });
});
