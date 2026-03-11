import { useEffect, useMemo, useState } from 'react';
import type { CircuitComponent, SolveCircuitResult, SolveTarget, TargetSolveResult, ValueMetadata } from '../engine/model';
import { getDiagnosticGuidance } from '../engine/solver';
import { parseValueWithUnit } from '../engine/units/parseValueWithUnit';
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
  selectedNodeId?: string;
  solved: SolveCircuitResult;
  targetResult?: TargetSolveResult;
  selectedTarget: SolveTarget;
  onChangeSelectedTarget: (target: SolveTarget) => void;
  onSolveForTarget: () => void;
  solveShortcutHint?: string;
  onUpdateComponentValue: (componentId: string, valueKey: 'resistance' | 'capacitance' | 'inductance' | 'voltage' | 'current' | 'forwardDrop' | 'beta' | 'thresholdVoltage' | 'gain' | 'highThreshold' | 'internalResistance' | 'rippleAmplitude', value: number) => void;
  onValueApplied: () => void;
  onJumpToEquationRow?: (rowId: string) => void;
};

const formatValue = (value?: number): string => (value == null || Number.isNaN(value) ? '—' : value.toFixed(4));

const getEditableFields = (
  component?: CircuitComponent
): Array<{ key: 'resistance' | 'capacitance' | 'inductance' | 'voltage' | 'current' | 'forwardDrop' | 'beta' | 'thresholdVoltage' | 'gain' | 'highThreshold' | 'internalResistance' | 'rippleAmplitude'; label: string; metadata: ValueMetadata }> => {
  if (!component) {
    return [];
  }

  switch (component.catalogTypeId) {
    case 'resistor':
      return [{ key: 'resistance', label: 'Resistance', metadata: component.resistance }];
    case 'capacitor':
      return [{ key: 'capacitance', label: 'Capacitance', metadata: component.capacitance }];
    case 'inductor':
      return [{ key: 'inductance', label: 'Inductance', metadata: component.inductance }];
    case 'voltage-source':
      return [
        { key: 'voltage', label: 'Voltage', metadata: component.voltage },
        ...(component.nonIdeal?.internalResistance ? [{ key: 'internalResistance' as const, label: 'Internal resistance', metadata: component.nonIdeal.internalResistance }] : []),
        ...(component.nonIdeal?.rippleAmplitude ? [{ key: 'rippleAmplitude' as const, label: 'Ripple amplitude', metadata: component.nonIdeal.rippleAmplitude }] : [])
      ];
    case 'current-source':
      return [
        { key: 'current', label: 'Current', metadata: component.current },
        ...(component.nonIdeal?.internalResistance ? [{ key: 'internalResistance' as const, label: 'Internal resistance', metadata: component.nonIdeal.internalResistance }] : []),
        ...(component.nonIdeal?.rippleAmplitude ? [{ key: 'rippleAmplitude' as const, label: 'Ripple amplitude', metadata: component.nonIdeal.rippleAmplitude }] : [])
      ];
    case 'diode':
      return [{ key: 'forwardDrop', label: 'Forward drop', metadata: component.forwardDrop }];
    case 'bjt':
      return [{ key: 'beta', label: 'Beta', metadata: component.beta }];
    case 'mosfet':
      return [{ key: 'thresholdVoltage', label: 'Threshold voltage', metadata: component.thresholdVoltage }];
    case 'op-amp':
      return [{ key: 'gain', label: 'Open-loop gain', metadata: component.gain }];
    case 'logic-gate':
      return [{ key: 'highThreshold', label: 'Logic high threshold', metadata: component.bridge.highThreshold }];
    default:
      return [];
  }
};

const getEquationRowsForComponentValue = (component: CircuitComponent, valueKey: string, solved: SolveCircuitResult): string[] => {
  const rows = solved.equationTrace ?? [];
  return rows
    .filter((row) => {
      if (row.constrainedComponentId === component.id) {
        return true;
      }
      if (row.terms.some((term) => term.componentId === component.id) || row.constants.some((term) => term.componentId === component.id)) {
        return true;
      }
      if (valueKey.endsWith(':voltage') && row.kclNodeId != null) {
        return row.kclNodeId === component.from || row.kclNodeId === component.to;
      }
      return false;
    })
    .map((row) => row.rowId);
};

export const PropertyPanel = ({ selectedComponent, selectedNodeId, solved, targetResult, selectedTarget, onChangeSelectedTarget, onSolveForTarget, solveShortcutHint, onUpdateComponentValue, onValueApplied, onJumpToEquationRow }: PropertyPanelProps) => {
  const editableFields = getEditableFields(selectedComponent);
  const editableField = editableFields[0];
  const [displayValue, setDisplayValue] = useState<string>('');
  const [prefix, setPrefix] = useState<Prefix>('');
  const [isValueUpdated, setIsValueUpdated] = useState(false);

  const targetDiagnostic = useMemo(() => solved.diagnostics.find((diagnostic) => diagnostic.code.startsWith('target_')), [solved.diagnostics]);

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

    const parsed = parseValueWithUnit(displayValue, { expectedUnit: editableField.metadata.unit, fallbackPrefix: prefix });
    if ('error' in parsed) {
      return parsed.error;
    }

    const convertedValue = parsed.value;
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
        {selectedComponent && editableFields.length > 0 && (
          <>
            <h3>{selectedComponent.label ?? selectedComponent.kind}</h3>
            {editableFields.map((field) => (
              <div key={field.key}>
                <label>
                  {field.label}
                  <div className="unit-input-row">
                    <input
                      type="text"
                      value={editableField?.key === field.key ? displayValue : ''}
                      placeholder={String(field.metadata.value ?? '')}
                      onFocus={() => {
                        setDisplayValue('');
                        setPrefix('');
                      }}
                      onChange={(event) => setDisplayValue(event.target.value)}
                    />
                    <select value={prefix} onChange={(event) => setPrefix(event.target.value as Prefix)}>
                      <option value="">(base)</option>
                      <option value="µ">micro (µ)</option>
                      <option value="m">milli (m)</option>
                      <option value="k">kilo (k)</option>
                      <option value="M">mega (M)</option>
                    </select>
                    <span>{field.metadata.unit}</span>
                  </div>
                </label>
                <button
                  type="button"
                  disabled={validationMessage != null || displayValue.length === 0}
                  onClick={() => {
                    const parsed = parseValueWithUnit(displayValue, { expectedUnit: field.metadata.unit, fallbackPrefix: prefix });
                    if ('error' in parsed) {
                      return;
                    }
                    onUpdateComponentValue(selectedComponent.id, field.key, parsed.value);
                    setDisplayValue('');
                    setPrefix('');
                    setIsValueUpdated(true);
                    onValueApplied();
                  }}
                >
                  Apply
                </button>
              </div>
            ))}
            {validationMessage && <p className="validation-error">{validationMessage}</p>}
          </>
        )}
      </div>

      <div className="computed-block">
        <h3>Target solve</h3>
        <label>
          Solve target
          <select
            value={selectedTarget.type}
            onChange={(event) => {
              const nextType = event.target.value as SolveTarget['type'];
              if (nextType === 'node_voltage') {
                onChangeSelectedTarget({ type: nextType, nodeId: selectedNodeId ?? selectedComponent?.from ?? 'gnd' });
              } else {
                onChangeSelectedTarget({ type: nextType, componentId: selectedComponent?.id ?? '' });
              }
            }}
          >
            <option value="node_voltage">Node voltage</option>
            <option value="component_current">Component current</option>
            <option value="component_value">Component value</option>
          </select>
        </label>
        <button type="button" onClick={onSolveForTarget} title={solveShortcutHint ? `Shortcut: ${solveShortcutHint}` : undefined}>
          Solve for X
        </button>
        {targetResult && <p className="readonly">{targetResult.key}: {formatValue(targetResult.value)} {targetResult.unit} ({targetResult.unique ? 'unique' : 'non-unique'})</p>}
        {targetResult && <p className="readonly">Dependencies: {targetResult.dependencies.join(', ') || 'none'}</p>}
        {targetDiagnostic && <p className={`diag-${targetDiagnostic.severity}`}>[{targetDiagnostic.code}] {targetDiagnostic.message}</p>}
      </div>

      <div className={`computed-block ${isValueUpdated ? 'value-updated' : ''}`}>
        <h3>Computed values</h3>
        {computedValues.length === 0 && <p className="readonly">No computed values available yet.</p>}
        {computedValues.map((entry) => {
          const linkedRows = selectedComponent ? getEquationRowsForComponentValue(selectedComponent, entry.key, solved) : [];
          return (
            <div key={entry.key}>
              <p className="readonly">
                {entry.key.split(':').slice(-1)[0]}: {formatValue(entry.value)} {entry.unit}
              </p>
              {linkedRows.length > 0 && (
                <div className="equation-links">
                  {linkedRows.slice(0, 3).map((rowId) => (
                    <button key={`${entry.key}-${rowId}`} type="button" onClick={() => onJumpToEquationRow?.(rowId)}>
                      Jump to {rowId}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="computed-block">
        <h3>Warnings / Diagnostics</h3>
        {solved.diagnostics.length === 0 && <p className="readonly">No diagnostics.</p>}
        {solved.diagnostics.map((diagnostic) => {
          const guidance = getDiagnosticGuidance(diagnostic);
          return (
            <div key={`${diagnostic.code}-${diagnostic.message}`} className={`diag-${diagnostic.severity}`}>
              <p>[{diagnostic.severity}] {diagnostic.message}</p>
              {guidance && (
                <>
                  <p><strong>Why:</strong> {guidance.why}</p>
                  <p><strong>Suggested fix:</strong> {guidance.suggestedFix}</p>
                </>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
