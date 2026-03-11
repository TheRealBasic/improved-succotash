// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComponentLibrarySidebar } from '../ComponentLibrarySidebar';

beforeEach(() => {
  window.localStorage.clear();
});

describe('ComponentLibrarySidebar', () => {
  it('filters by aliases and persists accordion state', () => {
    const { unmount } = render(<ComponentLibrarySidebar shortcutLabel={(id) => id} />);

    fireEvent.click(screen.getByRole('button', { name: /Passive3/i }));
    fireEvent.change(screen.getByPlaceholderText(/name, alias, tag, part/i), { target: { value: 'operational' } });
    expect(screen.getByText('Op-Amp')).toBeTruthy();
    expect(screen.queryByText('Resistor')).toBeNull();

    unmount();
    render(<ComponentLibrarySidebar shortcutLabel={(id) => id} />);
    expect(screen.getByRole('button', { name: /Passive3/i }).getAttribute('aria-expanded')).toBe('false');
  });

  it('keeps drag data type compatible with canvas drop handler', () => {
    render(<ComponentLibrarySidebar shortcutLabel={() => 'S'} />);
    const resistor = screen.getByRole('button', { name: /Resistor/i });
    const setData = vi.fn();
    fireEvent.dragStart(resistor, { dataTransfer: { setData } });
    expect(setData).toHaveBeenCalledWith('application/x-component-kind', 'resistor');
  });
});
