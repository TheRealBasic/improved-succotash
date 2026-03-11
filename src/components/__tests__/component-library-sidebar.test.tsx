// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentLibrarySidebar } from '../ComponentLibrarySidebar';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

describe('ComponentLibrarySidebar', () => {
  it('filters by aliases and persists nested accordion state', () => {
    const { unmount } = render(<ComponentLibrarySidebar shortcutLabel={(id) => id} />);

    fireEvent.click(screen.getByRole('button', { name: /Generic3/i }));
    fireEvent.click(screen.getByRole('button', { name: /Passive3/i }));
    fireEvent.change(screen.getByPlaceholderText(/name, alias, tag, part/i), { target: { value: 'operational' } });
    expect(screen.getByText('Op-Amp')).toBeTruthy();
    expect(screen.queryByText('Resistor')).toBeNull();

    unmount();
    render(<ComponentLibrarySidebar shortcutLabel={(id) => id} />);
    expect(screen.getByRole('button', { name: /Passive3/i }).getAttribute('aria-expanded')).toBe('false');

    const persisted = JSON.parse(window.localStorage.getItem('circuit-workbench-component-library-state-v1') ?? '{}');
    expect(persisted['passive::passive::generic']).toBe(false);
  });

  it('auto-opens matching branches when searching', () => {
    render(<ComponentLibrarySidebar shortcutLabel={() => 'S'} />);

    fireEvent.click(screen.getAllByRole('button', { name: /ICs5/i })[0]);
    fireEvent.change(screen.getByPlaceholderText(/name, alias, tag, part/i), { target: { value: 'ne555' } });

    expect(screen.getByRole('button', { name: /ICs1/i }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /Timers1/i }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Timer IC (NE555)')).toBeTruthy();
  });

  it('keeps drag data type compatible with canvas drop handler', () => {
    render(<ComponentLibrarySidebar shortcutLabel={() => 'S'} />);
    const resistor = screen.getAllByRole('button', { name: /^Resistor$/i })[0];
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

    const logic = ics?.subcategories.find((subcategory) => subcategory.id === 'ics::logic-74xx-hc-hct');
    expect(logic?.entries.map((entry) => entry.id)).toContain('74hc00');

    const specialty = COMPONENT_CATALOG.find((category) => category.id === 'specialty');
    const rf = specialty?.subcategories.find((subcategory) => subcategory.id === 'specialty::rf');
    expect(rf?.entries.map((entry) => entry.id)).toContain('ad9833');
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
});
