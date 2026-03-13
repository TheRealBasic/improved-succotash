import { describe, expect, it } from 'vitest';
import { COMPONENT_CATALOG_ITEMS, validateComponentCatalog } from '../componentCatalog';

const SOURCE_IDS = ['ac-voltage-source', 'pulse-voltage-source', 'reference-source', 'battery-cell', 'battery-pack', 'battery-coin-cell'] as const;
const POWER_IDS = ['ldo-regulator', 'buck-regulator', 'boost-regulator', 'charge-pump', 'current-regulator'] as const;

describe('source and power catalog support tiers', () => {
  it('keeps catalog valid with new source + power components', () => {
    expect(() => validateComponentCatalog(COMPONENT_CATALOG_ITEMS)).not.toThrow();
  });

  it('registers requested source variants', () => {
    for (const id of SOURCE_IDS) {
      const item = COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === id);
      expect(item, `missing ${id}`).toBeDefined();
      expect(item?.category).toBe('sources');
      expect(item?.pinCount).toBe(2);
      expect(item?.support.level).toMatch(/full|partial|visual-only/);
    }
  });

  it('registers power management components with support metadata', () => {
    for (const id of POWER_IDS) {
      const item = COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === id);
      expect(item, `missing ${id}`).toBeDefined();
      expect(item?.category).toBe('power');
      expect(item?.support.level).toMatch(/full|partial|visual-only/);
    }

    expect(COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === 'charge-pump')?.support.level).toBe('visual-only');
  });
});
