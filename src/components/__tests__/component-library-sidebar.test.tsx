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
