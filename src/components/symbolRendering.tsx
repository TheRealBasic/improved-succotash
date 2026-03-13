import type { ReactNode } from 'react';
import { SORTED_COMPONENT_CATALOG_ITEMS, type CatalogPlacementKind } from '../data/componentCatalog';

export type SymbolRendererId =
  | 'line-only'
  | 'diode'
  | 'op-amp-triangle'
  | 'logic-gate-block'
  | 'transistor-circle'
  | 'subcircuit-placeholder';

export type SymbolRendererDefinition = {
  rendererId: SymbolRendererId;
  supportedKinds: CatalogPlacementKind[];
  expectedPinCounts: number[];
  render: (midX: number, midY: number) => ReactNode;
};

const NO_SYMBOL: ReactNode = null;

export const SYMBOL_RENDERER_DEFINITIONS: SymbolRendererDefinition[] = [
  {
    rendererId: 'line-only',
    supportedKinds: ['resistor', 'capacitor', 'inductor', 'voltage-source', 'current-source', 'ac-voltage-source', 'pulse-voltage-source', 'reference-source', 'battery-cell', 'battery-pack', 'battery-coin-cell', 'ldo-regulator', 'buck-regulator', 'boost-regulator', 'charge-pump', 'current-regulator', 'switch-spst', 'switch-spdt', 'switch-dpdt', 'relay-reed', 'relay-ssr', 'switch-analog', 'wire'],
    expectedPinCounts: [2],
    render: () => NO_SYMBOL
  },
  {
    rendererId: 'diode',
    supportedKinds: ['diode'],
    expectedPinCounts: [2],
    render: (midX, midY) => (
      <>
        <polygon
          points={`${midX - 10},${midY - 10} ${midX - 10},${midY + 10} ${midX + 4},${midY}`}
          fill="none"
          stroke="#ffd36d"
          strokeWidth={2}
        />
        <line x1={midX + 6} y1={midY - 10} x2={midX + 6} y2={midY + 10} stroke="#ffd36d" strokeWidth={2} />
      </>
    )
  },
  {
    rendererId: 'op-amp-triangle',
    supportedKinds: ['op-amp', 'comparator', 'instrumentation-amplifier', 'generic-regulator-controller', 'voltage-reference'],
    expectedPinCounts: [5, 8],
    render: (midX, midY) => (
      <polygon
        points={`${midX - 12},${midY - 14} ${midX - 12},${midY + 14} ${midX + 14},${midY}`}
        fill="none"
        stroke="#9ae6ff"
        strokeWidth={2}
      />
    )
  },
  {
    rendererId: 'logic-gate-block',
    supportedKinds: ['logic-gate'],
    expectedPinCounts: [3, 10, 14],
    render: (midX, midY) => (
      <rect x={midX - 12} y={midY - 10} width={24} height={20} fill="none" stroke="#9dffcc" strokeWidth={2} rx={4} />
    )
  },
  {
    rendererId: 'transistor-circle',
    supportedKinds: ['bjt', 'mosfet'],
    expectedPinCounts: [3],
    render: (midX, midY) => <circle cx={midX} cy={midY} r={10} fill="none" stroke="#ffb4f3" strokeWidth={2} />
  },
  {
    rendererId: 'subcircuit-placeholder',
    supportedKinds: ['subcircuit'],
    expectedPinCounts: [0],
    render: () => NO_SYMBOL
  }
];

const rendererByKind = new Map<CatalogPlacementKind, SymbolRendererDefinition>();
for (const definition of SYMBOL_RENDERER_DEFINITIONS) {
  for (const kind of definition.supportedKinds) {
    rendererByKind.set(kind, definition);
  }
}

export type CatalogSymbolInventoryEntry = {
  id: string;
  kind: CatalogPlacementKind;
  category: string;
  pinCount: number;
  rendererId: SymbolRendererId | 'missing';
  expectedPinCounts: number[];
};

export const CATALOG_SYMBOL_INVENTORY: CatalogSymbolInventoryEntry[] = SORTED_COMPONENT_CATALOG_ITEMS.map((item) => {
  const renderer = rendererByKind.get(item.kind);
  return {
    id: item.id,
    kind: item.kind,
    category: item.category,
    pinCount: item.pinCount,
    rendererId: renderer?.rendererId ?? 'missing',
    expectedPinCounts: renderer?.expectedPinCounts ?? []
  };
});

export const validateCatalogSymbolBindings = (): string[] => {
  const errors: string[] = [];

  for (const item of SORTED_COMPONENT_CATALOG_ITEMS) {
    const renderer = rendererByKind.get(item.kind);
    if (!renderer) {
      errors.push(`No symbol renderer is registered for catalog kind "${item.kind}" (item "${item.id}")`);
      continue;
    }

    if (!renderer.expectedPinCounts.includes(item.pinCount)) {
      errors.push(
        `Pin count mismatch for item "${item.id}" (${item.kind}): expected one of [${renderer.expectedPinCounts.join(', ')}], got ${item.pinCount}`
      );
    }
  }

  return errors;
};

export const assertCatalogSymbolBindings = (): void => {
  const errors = validateCatalogSymbolBindings();
  if (errors.length > 0) {
    throw new Error(`Component symbol validation failed:\n${errors.join('\n')}`);
  }
};

type SymbolRenderableComponent = { catalogTypeId: CatalogPlacementKind };
type SymbolPoint = { x: number; y: number };

export const renderComponentSymbol = (component: SymbolRenderableComponent, fromNode: SymbolPoint, toNode: SymbolPoint): ReactNode => {
  const renderer = rendererByKind.get(component.catalogTypeId);
  if (!renderer) {
    return null;
  }

  const midX = (fromNode.x + toNode.x) / 2;
  const midY = (fromNode.y + toNode.y) / 2;
  return renderer.render(midX, midY);
};

if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
  assertCatalogSymbolBindings();
}
