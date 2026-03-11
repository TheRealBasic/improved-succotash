import { useEffect, useMemo, useState } from 'react';
import type { CircuitComponent, SolveCircuitResult, ValueMetadata } from '../engine/model';
import { ANIMATION_MS } from '../styles/animations';

const PREFIX_FACTORS = {
  '': 1,
  m: 1e-3,
  µ: 1e-6,
  k: 1e3,
  M: 1e6
} as const;

type Prefix = keyof typeof PREFIX_FACTORS;

type PropertyPanelProps = {
  selectedComponent?: CircuitComponent;
  solved: SolveCircuitResult;
  onUpdateComponentValue: (componentId: string, valueKey: 'resistance' | 'capacitance' | 'inductance' | 'voltage' | 'current', value: number) => void;
  onValueApplied: () => void;
};

const formatValue = (value?: number): string => (value == null || Number.isNaN(value) ? '—' : value.toFixed(4));

const getEditableField = (
  component?: CircuitComponent
): { key: 'resistance' | 'capacitance' | 'inductance' | 'voltage' | 'current'; label: string; metadata: ValueMetadata } | undefined => {
  if (!component) {
    return undefined;
  }

  switch (component.kind) {
    case 'resistor':
      return { key: 'resistance', label: 'Resistance', metadata: component.resistance };
    case 'capacitor':
      return { key: 'capacitance', label: 'Capacitance', metadata: component.capacitance };
    case 'inductor':
      return { key: 'inductance', label: 'Inductance', metadata: component.inductance };
    case 'voltageSource':
      return { key: 'voltage', label: 'Voltage', metadata: component.voltage };
    case 'currentSource':
      return { key: 'current', label: 'Current', metadata: component.current };
    default:
      return undefined;
  }
};

export const PropertyPanel = ({ selectedComponent, solved, onUpdateComponentValue, onValueApplied }: PropertyPanelProps) => {
  const editableField = getEditableField(selectedComponent);
  const [displayValue, setDisplayValue] = useState<string>('');
  const [prefix, setPrefix] = useState<Prefix>('');
  const [isValueUpdated, setIsValueUpdated] = useState(false);

  const computedValues = useMemo(() => {
    if (!selectedComponent) {
      return [];
    }

    return Object.values(solved.values).filter((value) => value.key.startsWith(`component:${selectedComponent.id}:`) && value.computed);
  }, [selectedComponent, solved.values]);

  const validationMessage = useMemo(() => {
    if (!editableField) {
      return undefined;
    }

    const parsed = Number(displayValue);
    if (!displayValue || Number.isNaN(parsed)) {
      return 'Enter a valid numeric value.';
    }

    const convertedValue = parsed * PREFIX_FACTORS[prefix];
    const constraints = editableField.metadata.constraints;
    if (constraints?.min != null && convertedValue < constraints.min) {
      return `Value must be ≥ ${constraints.min} ${editableField.metadata.unit}.`;
    }
    if (constraints?.max != null && convertedValue > constraints.max) {
      return `Value must be ≤ ${constraints.max} ${editableField.metadata.unit}.`;
    }
    if (constraints?.nonZero && convertedValue === 0) {
      return 'Value must be non-zero.';
    }

    return undefined;
  }, [displayValue, editableField, prefix]);

  useEffect(() => {
    if (!isValueUpdated) {
      return;
    }

    const timer = window.setTimeout(() => setIsValueUpdated(false), ANIMATION_MS.valuePulse);
    return () => window.clearTimeout(timer);
  }, [isValueUpdated]);

  return (
    <aside className="panel property-panel">
      <h2>Property Panel</h2>

      {!selectedComponent && <p>Select a component to edit parameters.</p>}

      <div className={`field-group ${!selectedComponent || !editableField ? 'collapsed' : ''} ${isValueUpdated ? 'value-updated' : ''}`}>
        {selectedComponent && editableField && (
          <>
            <h3>{selectedComponent.label ?? selectedComponent.kind}</h3>
            <label>
              {editableField.label}
              <div className="unit-input-row">
                <input
                  type="number"
                  value={displayValue}
                  placeholder={String(editableField.metadata.value ?? '')}
                  onChange={(event) => setDisplayValue(event.target.value)}
                />
                <select value={prefix} onChange={(event) => setPrefix(event.target.value as Prefix)}>
                  <option value="">(base)</option>
                  <option value="µ">micro (µ)</option>
                  <option value="m">milli (m)</option>
                  <option value="k">kilo (k)</option>
                  <option value="M">mega (M)</option>
                </select>
                <span>{editableField.metadata.unit}</span>
              </div>
            </label>
            <button
              type="button"
              disabled={validationMessage != null || displayValue.length === 0}
              onClick={() => {
                const numeric = Number(displayValue);
                if (Number.isNaN(numeric)) {
                  return;
                }

                onUpdateComponentValue(selectedComponent.id, editableField.key, numeric * PREFIX_FACTORS[prefix]);
                setDisplayValue('');
                setPrefix('');
                setIsValueUpdated(true);
                onValueApplied();
              }}
            >
              Apply
            </button>
            {validationMessage && <p className="validation-error">{validationMessage}</p>}
          </>
        )}
      </div>

      <div className={`computed-block ${isValueUpdated ? 'value-updated' : ''}`}>
        <h3>Computed values</h3>
        {computedValues.length === 0 && <p className="readonly">No computed values available yet.</p>}
        {computedValues.map((entry) => (
          <p className="readonly" key={entry.key}>
            {entry.key.split(':').slice(-1)[0]}: {formatValue(entry.value)} {entry.unit}
          </p>
        ))}
      </div>

      <div className="computed-block">
        <h3>Warnings / Diagnostics</h3>
        {solved.diagnostics.length === 0 && <p className="readonly">No diagnostics.</p>}
        {solved.diagnostics.map((diagnostic) => (
          <p key={`${diagnostic.code}-${diagnostic.message}`} className={`diag-${diagnostic.severity}`}>
            [{diagnostic.severity}] {diagnostic.message}
          </p>
        ))}
      </div>
    </aside>
  );
};
