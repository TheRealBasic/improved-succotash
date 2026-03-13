import { describe, expect, it } from 'vitest';
import { COMPONENT_CATALOG_ITEMS, validateComponentCatalog } from '../componentCatalog';

const NEW_PASSIVE_IDS = [
  'potentiometer-trimpot',
  'trimmer-resistor',
  'thermistor-ntc',
  'thermistor-ptc',
  'varistor-mov',
  'capacitor-electrolytic',
  'capacitor-ceramic',
  'capacitor-film',
  'ferrite-bead',
  'coupled-inductor'
] as const;

describe('passive component catalog additions', () => {
  it('keeps catalog valid after adding passive variants', () => {
    expect(() => validateComponentCatalog(COMPONENT_CATALOG_ITEMS)).not.toThrow();
  });

  it('registers all new passive variants with searchable placement metadata', () => {
    const entries = NEW_PASSIVE_IDS.map((id) => COMPONENT_CATALOG_ITEMS.find((item) => item.id === id));

    for (const entry of entries) {
      expect(entry, `Missing catalog item`).toBeDefined();
      expect(entry?.category).toBe('passive');
      expect(entry?.pinCount).toBe(2);
      expect(entry?.metadata?.aliases?.length ?? 0).toBeGreaterThan(0);
      expect(entry?.metadata?.shortcut?.key).toBeTruthy();
      expect(entry?.sidebar?.category).toBe('passive');
      expect(entry?.sidebar?.subcategory).toMatch(/resistive|capacitive|magnetic/);
      expect(entry?.tags).toEqual(expect.arrayContaining(['passive', 'new']));
    }
  });

  it('includes value+tolerance+temperature-coefficient schema fields where applicable', () => {
    const potentiometer = COMPONENT_CATALOG_ITEMS.find((item) => item.id === 'potentiometer-trimpot');
    const ceramic = COMPONENT_CATALOG_ITEMS.find((item) => item.id === 'capacitor-ceramic');
    const film = COMPONENT_CATALOG_ITEMS.find((item) => item.id === 'capacitor-film');

    expect(potentiometer?.editablePropertySchema).toMatchObject({
      resistanceOhms: { type: 'number' },
      tolerancePct: { type: 'number' },
      tempcoPpmPerC: { type: 'number' }
    });

    expect(ceramic?.editablePropertySchema).toMatchObject({
      capacitanceFarads: { type: 'number' },
      tolerancePct: { type: 'number' },
      tempcoPpmPerC: { type: 'number' }
    });

    expect(film?.editablePropertySchema).toMatchObject({
      capacitanceFarads: { type: 'number' },
      tolerancePct: { type: 'number' },
      tempcoPpmPerC: { type: 'number' }
    });
  });
});
