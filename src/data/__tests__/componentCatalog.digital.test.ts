import { describe, expect, it } from 'vitest';
import { COMPONENT_CATALOG_ITEMS } from '../componentCatalog';

const DIGITAL_IDS = [
  'logic-buffer',
  'logic-schmitt-trigger',
  'logic-tri-state-buffer',
  'logic-latch',
  'logic-flip-flop',
  'logic-counter',
  'logic-multiplexer'
] as const;

describe('digital catalog expansions', () => {
  it('registers added digital abstractions with consistent threshold schemas', () => {
    for (const id of DIGITAL_IDS) {
      const item = COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === id);
      expect(item, `missing ${id}`).toBeDefined();
      expect(item?.kind).toBe('logic-gate');
      expect(item?.solverBehavior.model).toBe('logic-gate');
      expect(item?.editablePropertySchema).toMatchObject({
        logicFamily: { type: 'enum' },
        propagationDelayNs: { type: 'number', unit: 'ns' },
        pullDefault: { type: 'enum' },
        highThreshold: { type: 'number' },
        lowThreshold: { type: 'number' },
        highLevel: { type: 'number' },
        lowLevel: { type: 'number' }
      });
    }
  });
});
