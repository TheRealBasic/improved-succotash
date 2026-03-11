import { describe, expect, it, vi, afterEach } from 'vitest';
import { validateComponentCatalog, type ComponentCatalogItem } from '../../data/componentCatalog';

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('../../data/componentCatalog');
});

const buildCatalogItem = (id: string, metadata?: ComponentCatalogItem['metadata']): ComponentCatalogItem => ({
  id,
  displayName: id,
  kind: 'resistor',
  category: 'passive',
  subcategory: 'generic',
  description: id,
  tags: ['generic'],
  pinCount: 2,
  symbolVariant: 'generic',
  pins: [
    { id: 'pin-1', label: 'Pin 1', index: 0 },
    { id: 'pin-2', label: 'Pin 2', index: 1 }
  ],
  editablePropertySchema: {},
  solverBehavior: { model: 'resistor' },
  defaultProps: {},
  metadata,
  sidebar: { category: 'passive', subcategory: 'generic' }
});

describe('shortcut generation', () => {
  it('builds deterministic placement shortcuts with many components', async () => {
    const generatedItems = Array.from({ length: 120 }, (_, index) =>
      buildCatalogItem(`item-${index.toString().padStart(3, '0')}`, {
        aliases: [`Alias ${index}`],
        shortcut: { key: `Key${index}` }
      })
    );

    vi.doMock('../../data/componentCatalog', async () => {
      const actual = await vi.importActual<typeof import('../../data/componentCatalog')>('../../data/componentCatalog');
      return {
        ...actual,
        SORTED_COMPONENT_CATALOG_ITEMS: generatedItems
      };
    });

    const { PLACEMENT_SHORTCUTS } = await import('../shortcuts');

    expect(PLACEMENT_SHORTCUTS).toHaveLength(120);
    expect(PLACEMENT_SHORTCUTS.slice(0, 3).map((shortcut) => shortcut.id)).toEqual([
      'place-item-000',
      'place-item-001',
      'place-item-002'
    ]);
    expect(PLACEMENT_SHORTCUTS.at(-1)?.id).toBe('place-item-119');
  });

  it('throws for duplicate placement shortcut keys', async () => {
    vi.doMock('../../data/componentCatalog', async () => {
      const actual = await vi.importActual<typeof import('../../data/componentCatalog')>('../../data/componentCatalog');
      return {
        ...actual,
        SORTED_COMPONENT_CATALOG_ITEMS: [
          buildCatalogItem('alpha', { aliases: ['Alpha'], shortcut: { key: 'R' } }),
          buildCatalogItem('beta', { aliases: ['Beta'], shortcut: { key: 'r' } })
        ]
      };
    });

    await expect(import('../shortcuts')).rejects.toThrow(/Duplicate placement shortcut keys found/i);
  });
});

describe('component catalog metadata validation', () => {
  it('throws for duplicate aliases', () => {
    const items = [
      buildCatalogItem('alpha', { aliases: ['SharedAlias'] }),
      buildCatalogItem('beta', { aliases: ['sharedalias'] })
    ];

    expect(() => validateComponentCatalog(items)).toThrow(/Duplicate alias/i);
  });
});
