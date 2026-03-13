import { describe, expect, it } from 'vitest';
import { COMPONENT_CATALOG_ITEMS } from '../componentCatalog';

const SWITCH_IDS = ['switch-spst', 'switch-spdt', 'switch-dpdt', 'relay-reed', 'relay-ssr', 'switch-analog'] as const;

describe('switching catalog entries', () => {
  it('registers requested switch and relay variants', () => {
    for (const id of SWITCH_IDS) {
      const item = COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === id);
      expect(item, `missing ${id}`).toBeDefined();
      expect(item?.kind).toBe(id);
      expect(item?.solverBehavior.model).toBe('shared-switch');
      expect(item?.solverBehavior.propertyMap).toMatchObject({
        onResistance: 'onResistance',
        offLeakageCurrent: 'offLeakageCurrent',
        controlThreshold: 'controlThreshold'
      });
      expect(item?.editablePropertySchema).toMatchObject({
        onResistance: { type: 'number' },
        offLeakageCurrent: { type: 'number' },
        controlThreshold: { type: 'number' }
      });
    }
  });
});
