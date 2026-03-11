import type { CircuitComponent, ComponentCatalogTypeId, ComponentKind } from './model';

export const assertNever = (value: never, message: string): never => {
  throw new Error(`${message}: ${String(value)}`);
};

export const getBehaviorFamilyForCatalogType = (catalogTypeId: ComponentCatalogTypeId): ComponentKind => {
  switch (catalogTypeId) {
    case 'resistor':
    case 'capacitor':
    case 'inductor':
    case 'wire':
      return 'passive2p';
    case 'voltage-source':
    case 'current-source':
      return 'source2p';
    case 'diode':
    case 'bjt':
    case 'mosfet':
      return 'switch';
    case 'op-amp':
      return 'amplifier';
    case 'logic-gate':
      return 'digital';
  }
};

export const assertSupportedBehaviorFamily = (_component: CircuitComponent): void => {};
