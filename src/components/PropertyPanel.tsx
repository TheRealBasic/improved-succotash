import { useEffect, useMemo, useState } from 'react';
import type { CircuitComponent, SolveCircuitResult, SolveTarget, TargetSolveResult, Unit, ValueConstraint, ValueMetadata } from '../engine/model';
import { getDiagnosticGuidance } from '../engine/solver';
import { parseValueWithUnit } from '../engine/units/parseValueWithUnit';
import { COMPONENT_CATALOG_ITEMS, type ComponentEditableProperty } from '../data/componentCatalog';
import { ANIMATION_MS } from '../styles/animations';

const PREFIX_FACTORS = {
  '': 1,
  m: 1e-3,
  µ: 1e-6,
  k: 1e3,
  M: 1e6
} as const;

type Prefix = keyof typeof PREFIX_FACTORS;
type PropertyInputValue = number | string | boolean;

type PropertyPanelProps = {
  selectedComponent?: CircuitComponent;
  selectedNodeId?: string;
  solved: SolveCircuitResult;
  targetResult?: TargetSolveResult;
  selectedTarget: SolveTarget;
  onChangeSelectedTarget: (target: SolveTarget) => void;
  onSolveForTarget: () => void;
  solveShortcutHint?: string;
  onUpdateComponentProperty: (componentId: string, propertyKey: string, value: PropertyInputValue) => void;
  onValueApplied: () => void;
  onJumpToEquationRow?: (rowId: string) => void;
};

type EditableField = {
  key: string;
  label: string;
  schema: ComponentEditableProperty;
  currentValue?: PropertyInputValue;
  constraints?: ValueConstraint;
  unit?: Unit;
};

const formatValue = (value?: number): string => (value == null || Number.isNaN(value) ? '—' : value.toFixed(4));

const supportBadgeLabel: Record<'full' | 'partial' | 'visual-only', string> = {
  full: 'Full solver support',
  partial: 'Partial solver support',
  'visual-only': 'Visual only'
};

const readPath = (root: unknown, path: string): unknown => path.split('.').reduce<unknown>((acc, part) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[part] : undefined), root);

const isUnit = (value: string | undefined): value is Unit => value != null && ['V', 'A', 'Ω', 'F', 'H', 'Hz'].includes(value);
const isValueMetadata = (value: unknown): value is ValueMetadata => Boolean(value && typeof value === 'object' && 'known' in (value as ValueMetadata) && 'computed' in (value as ValueMetadata));

const getEditableFields = (component?: CircuitComponent): EditableField[] => {
  if (!component) {
    return [];
  }

  const catalogItem = COMPONENT_CATALOG_ITEMS.find((item) => item.id === component.catalogTypeId);
  if (!catalogItem) {
    return [];
  }

  const fields: EditableField[] = [];

  for (const [propertyName, schema] of Object.entries(catalogItem.editablePropertySchema)) {
    const propertyPath = catalogItem.solverBehavior.propertyMap?.[propertyName] ?? propertyName;
    const rawValue = readPath(component, propertyPath);

    if (schema.type === 'number') {
      if (isValueMetadata(rawValue)) {
        fields.push({ key: propertyName, label: schema.label, schema, currentValue: rawValue.value, constraints: rawValue.constraints, unit: rawValue.unit });
      } else {
        fields.push({ key: propertyName, label: schema.label, schema, currentValue: typeof rawValue === 'number' ? rawValue : undefined, unit: isUnit(schema.unit) ? schema.unit : undefined });
      }
      continue;
    }

    if (schema.type === 'boolean') {
      fields.push({ key: propertyName, label: schema.label, schema, currentValue: typeof rawValue === 'boolean' ? rawValue : Boolean(catalogItem.defaultProps[propertyName]) });
      continue;
    }

    if (schema.type === 'enum') {
      const fallback = catalogItem.defaultProps[propertyName];
      fields.push({ key: propertyName, label: schema.label, schema, currentValue: typeof rawValue === 'string' ? rawValue : typeof fallback === 'string' ? fallback : schema.options?.[0] ?? '' });
      continue;
    }

    const fallback = catalogItem.defaultProps[propertyName];
    fields.push({ key: propertyName, label: schema.label, schema, currentValue: typeof rawValue === 'string' ? rawValue : typeof fallback === 'string' ? fallback : '' });
  }

  return fields;
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

const NumericWithUnitInput = ({ value, prefix, unit, onChangeValue, onChangePrefix }: { value: string; prefix: Prefix; unit?: Unit; onChangeValue: (next: string) => void; onChangePrefix: (next: Prefix) => void }) => (
  <div className="unit-input-row">
    <input type="text" value={value} onChange={(event) => onChangeValue(event.target.value)} />
    <select value={prefix} onChange={(event) => onChangePrefix(event.target.value as Prefix)}>
      <option value="">(base)</option>
      <option value="µ">micro (µ)</option>
      <option value="m">milli (m)</option>
      <option value="k">kilo (k)</option>
      <option value="M">mega (M)</option>
    </select>
    {unit && <span>{unit}</span>}
  </div>
);

const BooleanInput = ({ value, onChange }: { value: boolean; onChange: (next: boolean) => void }) => (
  <input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} />
);

const EnumInput = ({ value, options, onChange }: { value: string; options: string[]; onChange: (next: string) => void }) => (
  <select value={value} onChange={(event) => onChange(event.target.value)}>
    {options.map((option) => (
      <option key={option} value={option}>{option}</option>
    ))}
  </select>
);

const TextInput = ({ value, onChange }: { value: string; onChange: (next: string) => void }) => (
  <input type="text" value={value} onChange={(event) => onChange(event.target.value)} />
);

export const PropertyPanel = ({ selectedComponent, selectedNodeId, solved, targetResult, selectedTarget, onChangeSelectedTarget, onSolveForTarget, solveShortcutHint, onUpdateComponentProperty, onValueApplied, onJumpToEquationRow }: PropertyPanelProps) => {
  const editableFields = getEditableFields(selectedComponent);
  const selectedCatalogItem = selectedComponent ? COMPONENT_CATALOG_ITEMS.find((item) => item.id === selectedComponent.catalogTypeId) : undefined;
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [draftPrefixes, setDraftPrefixes] = useState<Record<string, Prefix>>({});
  const [isValueUpdated, setIsValueUpdated] = useState(false);

  const targetDiagnostic = useMemo(() => solved.diagnostics.find((diagnostic) => diagnostic.code.startsWith('target_')), [solved.diagnostics]);

  const computedValues = useMemo(() => {
    if (!selectedComponent) {
      return [];
    }

    return Object.values(solved.values).filter((value) => value.key.startsWith(`component:${selectedComponent.id}:`) && value.computed);
  }, [selectedComponent, solved.values]);

  const validationMessages = useMemo(() => {
    const messages: Record<string, string | undefined> = {};

    for (const field of editableFields) {
      const draft = draftValues[field.key] ?? '';
      if (field.schema.type !== 'number' || draft.length === 0) {
        messages[field.key] = undefined;
        continue;
      }

      const expectedUnit = field.unit ?? (isUnit(field.schema.unit) ? field.schema.unit : undefined);
      const parsed = parseValueWithUnit(draft, { expectedUnit, fallbackPrefix: draftPrefixes[field.key] ?? '' });
      if ('error' in parsed) {
        messages[field.key] = parsed.error;
        continue;
      }

      const convertedValue = parsed.value;
      const min = field.constraints?.min ?? field.schema.min;
      const max = field.constraints?.max ?? field.schema.max;
      const nonZero = field.constraints?.nonZero;

      if (nonZero && convertedValue === 0) {
        messages[field.key] = 'Value must be non-zero.';
      } else if (min != null && convertedValue < min) {
        messages[field.key] = `Value must be ≥ ${min}${expectedUnit ? ` ${expectedUnit}` : ''}.`;
      } else if (max != null && convertedValue > max) {
        messages[field.key] = `Value must be ≤ ${max}${expectedUnit ? ` ${expectedUnit}` : ''}.`;
      } else {
        messages[field.key] = undefined;
      }
    }

    return messages;
  }, [draftPrefixes, draftValues, editableFields]);

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

      <div className={`field-group ${!selectedComponent || editableFields.length === 0 ? 'collapsed' : ''} ${isValueUpdated ? 'value-updated' : ''}`}>
        {selectedComponent && editableFields.length > 0 && (
          <>
            <h3>{selectedComponent.label ?? selectedComponent.kind}</h3>
            {selectedCatalogItem && (
              <p>
                <span
                  className={`support-badge support-${selectedCatalogItem.support.level}`}
                  title={selectedCatalogItem.support.notes}
                >
                  {supportBadgeLabel[selectedCatalogItem.support.level]}
                </span>
              </p>
            )}
            {editableFields.map((field) => {
              const draft = draftValues[field.key] ?? '';
              const validationMessage = validationMessages[field.key];
              const hasValue = draft.length > 0;

              return (
                <div key={field.key}>
                  <label>
                    {field.label}
                    {field.schema.type === 'number' && (
                      <NumericWithUnitInput
                        value={draft}
                        prefix={draftPrefixes[field.key] ?? ''}
                        unit={field.unit ?? (isUnit(field.schema.unit) ? field.schema.unit : undefined)}
                        onChangeValue={(next) => setDraftValues((current) => ({ ...current, [field.key]: next }))}
                        onChangePrefix={(next) => setDraftPrefixes((current) => ({ ...current, [field.key]: next }))}
                      />
                    )}
                    {field.schema.type === 'boolean' && (
                      <BooleanInput
                        value={draft ? draft === 'true' : Boolean(field.currentValue)}
                        onChange={(next) => setDraftValues((current) => ({ ...current, [field.key]: String(next) }))}
                      />
                    )}
                    {field.schema.type === 'enum' && (
                      <EnumInput
                        value={draft || String(field.currentValue ?? '')}
                        options={field.schema.options ?? []}
                        onChange={(next) => setDraftValues((current) => ({ ...current, [field.key]: next }))}
                      />
                    )}
                    {field.schema.type === 'string' && <TextInput value={draft} onChange={(next) => setDraftValues((current) => ({ ...current, [field.key]: next }))} />}
                  </label>
                  <button
                    type="button"
                    disabled={(field.schema.type === 'number' && (!hasValue || validationMessage != null)) || (field.schema.type !== 'number' && !hasValue)}
                    onClick={() => {
                      if (!selectedComponent) {
                        return;
                      }

                      if (field.schema.type === 'number') {
                        const parsed = parseValueWithUnit(draft, { expectedUnit: field.unit ?? (isUnit(field.schema.unit) ? field.schema.unit : undefined), fallbackPrefix: draftPrefixes[field.key] ?? '' });
                        if ('error' in parsed) {
                          return;
                        }
                        onUpdateComponentProperty(selectedComponent.id, field.key, parsed.value);
                      } else if (field.schema.type === 'boolean') {
                        onUpdateComponentProperty(selectedComponent.id, field.key, draft === 'true');
                      } else {
                        onUpdateComponentProperty(selectedComponent.id, field.key, draft);
                      }

                      setDraftValues((current) => ({ ...current, [field.key]: '' }));
                      setDraftPrefixes((current) => ({ ...current, [field.key]: '' }));
                      setIsValueUpdated(true);
                      onValueApplied();
                    }}
                  >
                    Apply
                  </button>
                  {validationMessage && <p className="validation-error">{validationMessage}</p>}
                </div>
              );
            })}
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
