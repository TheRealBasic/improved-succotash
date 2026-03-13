import { describe, expect, it } from 'vitest';
import { COMPONENT_CATALOG_ITEMS } from '../componentCatalog';

const ANALOG_MACRO_IDS = [
  'op-amp',
  'comparator',
  'instrumentation-amplifier',
  'generic-regulator-controller',
  'voltage-reference'
] as const;

describe('analog macro catalog blocks', () => {
  it('registers comparator/instrumentation/reference/controller blocks with shared macro schema', () => {
    for (const id of ANALOG_MACRO_IDS) {
      const item = COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === id);
      expect(item, `missing ${id}`).toBeDefined();
      expect(item?.editablePropertySchema).toMatchObject({
        gain: { type: 'number' },
        outputLimitHigh: { type: 'number' },
        outputLimitLow: { type: 'number' },
        inputOffset: { type: 'number' },
        bandwidthHz: { type: 'number' }
      });
      expect(item?.solverBehavior.model).toBe('op-amp');
      expect(item?.support.level).toBe('partial');
    }
  });
});
