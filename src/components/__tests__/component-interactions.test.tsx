// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CircuitCanvas } from '../CircuitCanvas';
import { PropertyPanel } from '../PropertyPanel';
import type { CircuitComponent, SolveCircuitResult } from '../../engine/model';

const makeDataTransfer = (kind: string) => ({
  getData: (type: string) => (type === 'application/x-component-kind' ? kind : ''),
  setData: vi.fn()
});

describe('CircuitCanvas workflows', () => {
  it('handles drag/drop placement and wire connection interactions', () => {
    const onAddComponentAt = vi.fn();
    const onStartOrCompleteWire = vi.fn();

    const { container } = render(
      <CircuitCanvas
        nodes={[
          { id: 'n1', x: 100, y: 120, reference: true },
          { id: 'n2', x: 220, y: 120 }
        ]}
        components={[]}
        simulationActive={false}
        onAddComponentAt={onAddComponentAt}
        onSelectNode={vi.fn()}
        onSelectComponent={vi.fn()}
        onMoveNode={vi.fn()}
        onDeleteSelected={vi.fn()}
        onStartOrCompleteWire={onStartOrCompleteWire}
      />
    );

    const surface = container.querySelector('svg.canvas-surface');
    expect(surface).toBeTruthy();

    Object.defineProperty(surface!, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, right: 820, bottom: 540, width: 820, height: 540, x: 0, y: 0, toJSON: () => ({}) })
    });

    fireEvent.drop(surface!, {
      preventDefault: vi.fn(),
      clientX: 101,
      clientY: 141,
      currentTarget: surface,
      dataTransfer: makeDataTransfer('resistor')
    });

    expect(onAddComponentAt).toHaveBeenCalledTimes(1);
    const [kind, x, y] = onAddComponentAt.mock.calls[0];
    expect(kind).toBe('resistor');
    expect(typeof x).toBe('number');
    expect(typeof y).toBe('number');

    const circles = container.querySelectorAll('circle.node-dot');
    fireEvent.doubleClick(circles[0]);
    fireEvent.doubleClick(circles[1]);

    expect(onStartOrCompleteWire).toHaveBeenNthCalledWith(1, 'n1');
    expect(onStartOrCompleteWire).toHaveBeenNthCalledWith(2, 'n2');
  });
});

describe('PropertyPanel updates and rendering', () => {
  const selectedResistor: CircuitComponent = {
    id: 'r1',
    kind: 'resistor',
    from: 'n1',
    to: 'gnd',
    label: 'R1',
    resistance: { value: 100, known: true, computed: false, unit: 'Ω', constraints: { min: 0.001, nonZero: true } }
  };

  it('parses compact value+unit input and applies normalized value', () => {
    const onUpdateComponentValue = vi.fn();
    const onValueApplied = vi.fn();

    const { container } = render(
      <PropertyPanel
        selectedComponent={selectedResistor}
        solved={{ values: {}, diagnostics: [] }}
        selectedTarget={{ type: 'component_value', componentId: 'r1' }}
        onChangeSelectedTarget={vi.fn()}
        onSolveForTarget={vi.fn()}
        onUpdateComponentValue={onUpdateComponentValue}
        onValueApplied={onValueApplied}
      />
    );

    fireEvent.change(within(container).getByRole('textbox'), { target: { value: '2.5k' } });
    fireEvent.click(within(container).getByRole('button', { name: 'Apply' }));

    expect(onUpdateComponentValue).toHaveBeenCalledWith('r1', 'resistance', 2500);
    expect(onValueApplied).toHaveBeenCalledTimes(1);
  });

  it('shows validation for incompatible units', () => {
    const capacitor: CircuitComponent = {
      id: 'c1',
      kind: 'capacitor',
      from: 'n1',
      to: 'gnd',
      capacitance: { value: 1e-6, known: true, computed: false, unit: 'F', constraints: { min: 0 } }
    };

    const { container } = render(
      <PropertyPanel
        selectedComponent={capacitor}
        solved={{ values: {}, diagnostics: [] }}
        selectedTarget={{ type: 'component_value', componentId: 'c1' }}
        onChangeSelectedTarget={vi.fn()}
        onSolveForTarget={vi.fn()}
        onUpdateComponentValue={vi.fn()}
        onValueApplied={vi.fn()}
      />
    );

    fireEvent.change(within(container).getByRole('textbox'), { target: { value: '2mA' } });

    expect(within(container).getByText(/incompatible with expected F/i)).toBeTruthy();
    expect(within(container).getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(true);
  });

  it('renders computed values and diagnostics visibility', () => {
    const onJumpToEquationRow = vi.fn();
    const solved: SolveCircuitResult = {
      values: {
        'component:r1:current': {
          key: 'component:r1:current',
          unit: 'A',
          value: 0.25,
          computed: true,
          known: false
        }
      },
      diagnostics: [
        {
          code: 'underdetermined',
          severity: 'error',
          message: 'Circuit equations are underdetermined. Add more constraints/components.'
        }
      ],
      equationTrace: [
        {
          rowIndex: 0,
          rowId: 'kcl:n1',
          rowType: 'kcl',
          kclNodeId: 'n1',
          terms: [
            {
              componentId: 'r1',
              variableKey: 'V:n1',
              coefficient: 0.01,
              description: 'r1 conductance @ n1'
            }
          ],
          constants: [],
          rhs: 0
        }
      ]
    };

    render(
      <PropertyPanel
        selectedComponent={selectedResistor}
        solved={solved}
        selectedTarget={{ type: 'component_current', componentId: 'r1' }}
        onChangeSelectedTarget={vi.fn()}
        onSolveForTarget={vi.fn()}
        onUpdateComponentValue={vi.fn()}
        onValueApplied={vi.fn()}
        onJumpToEquationRow={onJumpToEquationRow}
      />
    );

    expect(screen.getByText(/current: 0.2500 A/i)).toBeTruthy();
    expect(screen.getByText(/\[error\] Circuit equations are underdetermined/i)).toBeTruthy();
    expect(screen.getByText(/why:/i)).toBeTruthy();
    expect(screen.getByText(/suggested fix:/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /jump to kcl:n1/i }));
    expect(onJumpToEquationRow).toHaveBeenCalledWith('kcl:n1');
  });
});
