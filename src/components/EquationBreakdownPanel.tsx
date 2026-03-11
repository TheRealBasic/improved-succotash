import { useMemo, useState } from 'react';
import type { EquationTraceRow, SolveCircuitResult } from '../engine/model';

type EquationBreakdownPanelProps = {
  solved: SolveCircuitResult;
  focusedRowId?: string;
  onFocusRow?: (rowId: string) => void;
};

const formatNumber = (value: number | undefined): string => (value == null || Number.isNaN(value) ? '—' : value.toFixed(4));

const variableToValueKey = (variableKey: string): string | undefined => {
  if (variableKey.startsWith('V:')) {
    return `node:${variableKey.slice(2)}:voltage`;
  }
  if (variableKey.startsWith('I:')) {
    return `component:${variableKey.slice(2)}:current`;
  }
  return undefined;
};

const renderSymbolicRow = (row: EquationTraceRow): string => {
  const lhs = row.terms.map((term, index) => `${index > 0 && term.coefficient >= 0 ? '+' : ''}${term.coefficient.toFixed(4)}·${term.variableKey}`).join(' ');
  return `${lhs || '0'} = ${row.rhs.toFixed(4)}`;
};

export const EquationBreakdownPanel = ({ solved, focusedRowId, onFocusRow }: EquationBreakdownPanelProps) => {
  const [expanded, setExpanded] = useState(true);

  const rows = solved.equationTrace ?? [];
  const substitutions = useMemo(
    () =>
      rows.map((row) => {
        const parts = row.terms.map((term) => {
          const valueKey = variableToValueKey(term.variableKey);
          const solvedValue = valueKey ? solved.values[valueKey]?.value : undefined;
          const evaluated = solvedValue == null ? undefined : term.coefficient * solvedValue;
          return `${term.coefficient.toFixed(4)}×${formatNumber(solvedValue)}=${formatNumber(evaluated)}`;
        });
        return { rowId: row.rowId, text: `${parts.join(' + ') || '0'} ≈ ${row.rhs.toFixed(4)}` };
      }),
    [rows, solved.values]
  );

  return (
    <section className="panel equation-breakdown-panel">
      <button type="button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'Hide Equation Breakdown' : 'Show Equation Breakdown'}
      </button>
      {expanded && (
        <div className="computed-block">
          {rows.length === 0 && <p className="readonly">No equation trace available.</p>}
          {rows.map((row) => {
            const substitution = substitutions.find((entry) => entry.rowId === row.rowId);
            return (
              <article
                key={row.rowId}
                id={`eq-row-${row.rowId}`}
                className={`equation-row ${focusedRowId === row.rowId ? 'equation-row-focused' : ''}`}
              >
                <h4>
                  Row {row.rowIndex + 1}: {row.rowType === 'kcl' ? `KCL @ ${row.kclNodeId}` : `Constraint @ ${row.constrainedComponentId}`}
                </h4>
                <p className="readonly">{renderSymbolicRow(row)}</p>
                <p className="readonly">Substitute: {substitution?.text}</p>
                {row.constants.length > 0 && (
                  <ul>
                    {row.constants.map((term, index) => (
                      <li key={`${row.rowId}-const-${index}`} className="readonly">
                        {term.description}: {formatNumber(term.value)}
                      </li>
                    ))}
                  </ul>
                )}
                {onFocusRow && (
                  <button type="button" onClick={() => onFocusRow(row.rowId)}>
                    Focus row
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
