import { describe, expect, it } from 'vitest';
import { COMPONENT_CATALOG_ITEMS } from '../componentCatalog';

const DIODE_VARIANTS = ['diode', 'diode-schottky', 'diode-zener', 'diode-tvs', 'diode-led'] as const;
const BJT_VARIANTS = ['bjt', 'bjt-pnp-small-signal', 'bjt-npn-power', 'bjt-pnp-power'] as const;
const MOSFET_VARIANTS = ['mosfet', 'mosfet-pmos-logic', 'mosfet-nmos-power', 'mosfet-pmos-power'] as const;

describe('semiconductor catalog families', () => {
  it('registers diode, BJT, and MOSFET variants with standardized schemas', () => {
    for (const id of DIODE_VARIANTS) {
      const item = COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === id);
      expect(item, `missing ${id}`).toBeDefined();
      expect(item?.kind).toBe('diode');
      expect(item?.editablePropertySchema).toMatchObject({
        forwardDrop: { type: 'number' },
        reverseRecoveryNs: { type: 'number' },
        junctionCapacitancePf: { type: 'number' }
      });
    }

    for (const id of BJT_VARIANTS) {
      const item = COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === id);
      expect(item, `missing ${id}`).toBeDefined();
      expect(item?.kind).toBe('bjt');
      expect(item?.editablePropertySchema).toMatchObject({
        beta: { type: 'number' },
        vbeOn: { type: 'number' },
        collectorCurrentMaxA: { type: 'number' },
        inputCapacitancePf: { type: 'number' },
        outputCapacitancePf: { type: 'number' }
      });
    }

    for (const id of MOSFET_VARIANTS) {
      const item = COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === id);
      expect(item, `missing ${id}`).toBeDefined();
      expect(item?.kind).toBe('mosfet');
      expect(item?.editablePropertySchema).toMatchObject({
        thresholdVoltage: { type: 'number' },
        onResistance: { type: 'number' },
        offLeakageCurrent: { type: 'number' },
        inputCapacitancePf: { type: 'number' },
        outputCapacitancePf: { type: 'number' }
      });
    }
  });

  it('maps families to solver behavior groups and marks unavailable analyses', () => {
    const zener = COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === 'diode-zener');
    const tvs = COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === 'diode-tvs');
    const pnpPower = COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === 'bjt-pnp-power');
    const pmosPower = COMPONENT_CATALOG_ITEMS.find((entry) => entry.id === 'mosfet-pmos-power');

    expect(zener?.solverBehavior.model).toBe('diode-zener');
    expect(tvs?.solverBehavior.model).toBe('diode-tvs');
    expect(pnpPower?.solverBehavior.model).toBe('bjt-pnp');
    expect(pmosPower?.solverBehavior.model).toBe('mosfet-pmos');

    expect(zener?.support.level).toBe('visual-only');
    expect(zener?.support.notes).toMatch(/not modeled/i);
    expect(tvs?.support.level).toBe('visual-only');
    expect(tvs?.support.notes).toMatch(/unavailable/i);
    expect(pnpPower?.support.level).toBe('visual-only');
    expect(pmosPower?.support.level).toBe('visual-only');
    expect(pmosPower?.support.notes).toMatch(/dc, ac, transient, or monte carlo/i);
  });
});
