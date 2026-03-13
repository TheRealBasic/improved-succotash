// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __componentLibraryPerf, ComponentLibrarySidebar } from '../ComponentLibrarySidebar';
import { buildComponentCatalog } from '../componentCatalog';
import type { ComponentCatalogItem } from '../../data/componentCatalog';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});


const selectMultipleValues = (element: HTMLElement, values: string[]) => {
  const select = element as HTMLSelectElement;
  for (const option of Array.from(select.options)) {
    option.selected = values.includes(option.value);
  }
  fireEvent.change(select);
};

describe('ComponentLibrarySidebar', () => {
  it('filters by aliases and persists nested accordion state', () => {
    const { unmount } = render(<ComponentLibrarySidebar shortcutLabel={(id) => id} />);

    fireEvent.click(screen.getByRole('button', { name: /Generic\d+/i }));
    fireEvent.click(screen.getByRole('button', { name: /Passive\d+/i }));
    fireEvent.change(screen.getByPlaceholderText(/name, alias, tag, part/i), { target: { value: 'operational' } });
    expect(screen.getByText('Op-Amp')).toBeTruthy();
    expect(screen.queryByText('Resistor')).toBeNull();

    unmount();
    window.sessionStorage.clear();
    render(<ComponentLibrarySidebar shortcutLabel={(id) => id} />);
    expect(screen.getByRole('button', { name: /Passive\d+/i }).getAttribute('aria-expanded')).toBe('false');

    const persisted = JSON.parse(window.localStorage.getItem('circuit-workbench-component-library-state-v1') ?? '{}');
    expect(persisted['passive::passive::generic']).toBe(false);
  });

  it('auto-opens matching branches when searching', () => {
    render(<ComponentLibrarySidebar shortcutLabel={() => 'S'} />);

    fireEvent.click(screen.getAllByRole('button', { name: /ICs\d+/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/name, alias, tag, part/i), { target: { value: 'ne555' } });

    expect(screen.getByRole('button', { name: /ICs1/i }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Timers\d+/i }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Timer IC (NE555)')).toBeTruthy();
  });




  it('finds semiconductor families by common aliases', () => {
    render(<ComponentLibrarySidebar shortcutLabel={() => 'S'} />);

    fireEvent.change(screen.getByPlaceholderText(/name, alias, tag, part/i), { target: { value: 'zener' } });
    expect(screen.getByText('Diode (Zener)')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/name, alias, tag, part/i), { target: { value: 'pmos' } });
    expect(screen.getByText('MOSFET (PMOS Logic-Level)')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/name, alias, tag, part/i), { target: { value: 'led' } });
    expect(screen.getByText('Diode (LED)')).toBeTruthy();
  });

  it('supports combined multi-filter selection and quick toggles', () => {
    render(<ComponentLibrarySidebar shortcutLabel={() => 'S'} />);

    selectMultipleValues(screen.getByLabelText('Category filter'), ['ics']);
    selectMultipleValues(screen.getByLabelText('Subcategory filter'), ['ics::logic-74xx-hc-hct']);
    selectMultipleValues(screen.getByLabelText('Tags filter'), ['digital']);
    selectMultipleValues(screen.getByLabelText('Pin count filter'), ['14']);
    selectMultipleValues(screen.getByLabelText('Manufacturer filter'), ['Nexperia']);

    expect(screen.getByText('Quad NAND (74HC00)')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    fireEvent.click(screen.getByLabelText(/fully simulated only/i));
    expect(screen.queryByText('Quad NAND (74HC00)')).toBeNull();
    expect(screen.getByText('Resistor')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    fireEvent.click(screen.getByLabelText(/new components/i));
    expect(screen.getByText('Dual Op-Amp (LM358)')).toBeTruthy();
    expect(screen.queryByText('Resistor')).toBeNull();
  });

  it('persists filter state in session storage and restores it on remount', () => {
    const { unmount } = render(<ComponentLibrarySidebar shortcutLabel={() => 'S'} />);

    fireEvent.change(screen.getByPlaceholderText(/name, alias, tag, part/i), { target: { value: 'nand' } });
    fireEvent.click(screen.getByLabelText(/new components/i));

    unmount();
    render(<ComponentLibrarySidebar shortcutLabel={() => 'S'} />);

    expect((screen.getByPlaceholderText(/name, alias, tag, part/i) as HTMLInputElement).value).toBe('nand');
    expect((screen.getByLabelText(/new components/i) as HTMLInputElement).checked).toBe(true);

    const persisted = JSON.parse(window.sessionStorage.getItem('circuit-workbench-component-library-session-v1') ?? '{}');
    expect(persisted.query).toBe('nand');
    expect(persisted.filters.newComponentsOnly).toBe(true);
  });

  it('renders empty results when filters are mutually exclusive', () => {
    render(<ComponentLibrarySidebar shortcutLabel={() => 'S'} />);

    selectMultipleValues(screen.getByLabelText('Category filter'), ['passive']);
    selectMultipleValues(screen.getByLabelText('Manufacturer filter'), ['Nexperia']);

    expect(screen.getByText('0 matching components')).toBeTruthy();
    expect(screen.queryByText('Resistor')).toBeNull();
  });

  it('keeps drag data type compatible with canvas drop handler', () => {
    render(<ComponentLibrarySidebar shortcutLabel={() => 'S'} />);
    const resistor = screen.getAllByRole('button', { name: /resistor/i })[0];
    const setData = vi.fn();
    fireEvent.dragStart(resistor, { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith('application/x-component-kind', 'resistor');
  });
});


describe('componentCatalog sidebar grouping', () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock('../../data/componentCatalog');
  });

  it('groups mixed catalog categories using explicit sidebar metadata', async () => {
    vi.resetModules();
    const { COMPONENT_CATALOG } = await import('../componentCatalog');

    const ics = COMPONENT_CATALOG.find((category) => category.id === 'ics');
    expect(ics?.subcategories.map((subcategory) => subcategory.label)).toEqual(['Op-Amps', 'Timers', 'Logic (74xx/HC/HCT)']);

    const timers = ics?.subcategories.find((subcategory) => subcategory.id === 'ics::timers');
    expect(timers?.entries.some((entry) => entry.id === 'ne555')).toBe(true);
    expect(timers?.entries.find((entry) => entry.id === 'ne555')?.searchTokens).toContain('ne555');

    const logic = ics?.subcategories.find((subcategory) => subcategory.id === 'ics::logic-74xx-hc-hct');
    expect(logic?.entries.map((entry) => entry.id)).toContain('74hc00');

    const specialty = COMPONENT_CATALOG.find((category) => category.id === 'specialty');
    const rf = specialty?.subcategories.find((subcategory) => subcategory.id === 'specialty::rf');
    expect(rf?.entries.map((entry) => entry.id)).toContain('ad9833');

    const passive = COMPONENT_CATALOG.find((category) => category.id === 'passive');
    const resistive = passive?.subcategories.find((subcategory) => subcategory.id === 'passive::resistive');
    const capacitive = passive?.subcategories.find((subcategory) => subcategory.id === 'passive::capacitive');
    const magnetic = passive?.subcategories.find((subcategory) => subcategory.id === 'passive::magnetic');

    expect(resistive?.entries.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['potentiometer-trimpot', 'trimmer-resistor', 'thermistor-ntc', 'thermistor-ptc', 'varistor-mov'])
    );
    expect(capacitive?.entries.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['capacitor-electrolytic', 'capacitor-ceramic', 'capacitor-film'])
    );
    expect(magnetic?.entries.map((entry) => entry.id)).toEqual(
      expect.arrayContaining(['ferrite-bead', 'coupled-inductor'])
    );
  });

  it('falls back to legacy sidebar heuristics when sidebar metadata is missing', async () => {
    vi.doMock('../../data/componentCatalog', async () => {
      const actual = await vi.importActual<typeof import('../../data/componentCatalog')>('../../data/componentCatalog');
      return {
        ...actual,
        SORTED_COMPONENT_CATALOG_ITEMS: [
          {
            id: 'legacy-timer',
            displayName: 'Legacy Timer',
            kind: 'op-amp',
            category: 'timing',
            subcategory: 'timer',
            description: 'legacy item',
            tags: ['timer'],
            pinCount: 8,
            symbolVariant: 'generic',
            pins: [],
            editablePropertySchema: {},
            solverBehavior: { model: 'op-amp' },
            defaultProps: {}
          }
        ]
      };
    });

    const { COMPONENT_CATALOG } = await import('../componentCatalog');
    expect(COMPONENT_CATALOG).toHaveLength(1);
    expect(COMPONENT_CATALOG[0]?.id).toBe('ics');
    expect(COMPONENT_CATALOG[0]?.subcategories[0]?.id).toBe('ics::timers');
    expect(COMPONENT_CATALOG[0]?.subcategories[0]?.entries[0]?.id).toBe('legacy-timer');
  });

  it('indexes search tokens at catalog build time for id, aliases, tags, and part number', () => {
    const syntheticItem: ComponentCatalogItem = {
      id: 'acme-opamp',
      displayName: 'ACME Op Amp',
      kind: 'op-amp',
      category: 'ics',
      subcategory: 'analog',
      description: 'Synthetic component',
      tags: ['Analog', 'Precision'],
      pinCount: 8,
      symbolVariant: 'generic',
      pins: [],
      editablePropertySchema: {},
      solverBehavior: { model: 'op-amp' },
      support: { level: 'full' },
      defaultProps: {},
      partNumber: 'LM358N',
      metadata: { aliases: ['Dual Op Amp'] },
      sidebar: { category: 'ics', subcategory: 'op-amps' }
    };

    const catalog = buildComponentCatalog([syntheticItem]);
    const entry = catalog[0]?.subcategories[0]?.entries[0];
    expect(entry?.searchTokens).toEqual(expect.arrayContaining(['acme-opamp', 'dual op amp', 'analog', 'precision', 'lm358n']));
  });

  it('filters large synthetic catalogs with preindexed tokens', () => {
    const baseItem: ComponentCatalogItem = {
      id: 'synthetic',
      displayName: 'Synthetic Part',
      kind: 'resistor',
      category: 'passive',
      subcategory: 'generic',
      description: 'Synthetic performance fixture',
      tags: ['fixture', 'resistance'],
      pinCount: 2,
      symbolVariant: 'generic',
      pins: [],
      editablePropertySchema: {},
      solverBehavior: { model: 'resistor' },
      support: { level: 'full' },
      defaultProps: {},
      metadata: { aliases: ['bench-item'] },
      sidebar: { category: 'passive', subcategory: 'generic' }
    };

    const largeCatalog = buildComponentCatalog(
      Array.from({ length: 5000 }, (_, index) => ({
        ...baseItem,
        id: `synthetic-${index}`,
        displayName: `Synthetic Part ${index}`,
        partNumber: `PN-${index}`,
        tags: ['fixture', index % 2 === 0 ? 'even' : 'odd'],
        metadata: { aliases: [`bench-item-${index}`] }
      }))
    );

    const perfStart = performance.now();
    const filtered = __componentLibraryPerf.filterComponentCatalog(
      largeCatalog,
      __componentLibraryPerf.tokenizeQuery('bench-item-4321 odd'),
      {
        categories: [],
        subcategories: [],
        tags: [],
        pinCounts: [],
        manufacturers: [],
        fullySimulatedOnly: false,
        newComponentsOnly: false
      }
    );
    const perfDuration = performance.now() - perfStart;

    const resultCount = filtered.reduce(
      (sum, category) => sum + category.subcategories.reduce((subSum, subcategory) => subSum + subcategory.entries.length, 0),
      0
    );

    expect(resultCount).toBe(1);
    expect(perfDuration).toBeLessThan(150);
  });
});
