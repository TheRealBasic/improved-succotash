import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircuitCanvas, type CanvasComponent } from './components/CircuitCanvas';
import { EquationBreakdownPanel } from './components/EquationBreakdownPanel';
import { PropertyPanel } from './components/PropertyPanel';
import { getSfxSettings, isSfxBlocked, playSfx, setSfxVolume, subscribeToSfxSettings, toggleSfxMute, unlockSfx } from './audio/sfx';
import { cloneCircuit, circuitPresets, type EditorCircuit } from './data/presets';
import type { CircuitComponent, ComponentKind, SolveCircuitResult, SolveTarget, TargetSolveResult, Unit, ValueMetadata } from './engine/model';
import { runAnalysis, simulateStep } from './engine/simulation';
import { solveCircuitForTarget, solveCircuitValues } from './engine/solver';
import './styles/theme.css';
import './styles/animations.css';

const HISTORY_LIMIT = 40;
const STORAGE_KEY = 'circuit-workbench-state';

const createValueMetadata = (unit: Unit, value: number, constraints?: ValueMetadata['constraints']): ValueMetadata => ({
  value,
  unit,
  known: true,
  computed: false,
  constraints
});

const componentFactory = (kind: Exclude<ComponentKind, 'wire'>, id: string, from: string, to: string): CircuitComponent => {
  switch (kind) {
    case 'resistor':
      return { id, kind, from, to, label: `R-${id}`, resistance: createValueMetadata('Ω', 100, { min: 0.001, nonZero: true }) };
    case 'capacitor':
      return { id, kind, from, to, label: `C-${id}`, capacitance: createValueMetadata('F', 0.000001, { min: 0 }) };
    case 'inductor':
      return { id, kind, from, to, label: `L-${id}`, inductance: createValueMetadata('H', 0.01, { min: 0 }) };
    case 'voltageSource':
      return { id, kind, from, to, label: `V-${id}`, voltage: createValueMetadata('V', 5, { nonZero: true }) };
    case 'currentSource':
      return { id, kind, from, to, label: `I-${id}`, current: createValueMetadata('A', 0.01) };
  }
};

const encodeCircuit = (circuit: EditorCircuit): string => window.btoa(unescape(encodeURIComponent(JSON.stringify(circuit))));
const decodeCircuit = (encoded: string): EditorCircuit => JSON.parse(decodeURIComponent(escape(window.atob(encoded)))) as EditorCircuit;

const getInitialCircuit = (): EditorCircuit => {
  if (typeof window === 'undefined') {
    return cloneCircuit(circuitPresets.starter);
  }

  const shared = new URLSearchParams(window.location.search).get('c');
  if (shared) {
    try {
      return decodeCircuit(shared);
    } catch {
      return cloneCircuit(circuitPresets.starter);
    }
  }

  const local = window.localStorage.getItem(STORAGE_KEY);
  if (local) {
    try {
      return JSON.parse(local) as EditorCircuit;
    } catch {
      return cloneCircuit(circuitPresets.starter);
    }
  }

  return cloneCircuit(circuitPresets.starter);
};

const App = () => {
  const [circuit, setCircuit] = useState<EditorCircuit>(getInitialCircuit);
  const [history, setHistory] = useState<EditorCircuit[]>([]);
  const [future, setFuture] = useState<EditorCircuit[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [selectedComponentId, setSelectedComponentId] = useState<string | undefined>(undefined);
  const [pendingWireFromNodeId, setPendingWireFromNodeId] = useState<string | undefined>(undefined);
  const [solved, setSolved] = useState<SolveCircuitResult>({ values: {}, diagnostics: [] });
  const [selectedTarget, setSelectedTarget] = useState<SolveTarget>({ type: 'node_voltage', nodeId: 'gnd' });
  const [targetResult, setTargetResult] = useState<TargetSolveResult | undefined>(undefined);
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationTime, setSimulationTime] = useState(0);
  const [mode, setMode] = useState<'dc' | 'ac'>('dc');
  const [sfxSettings, setSfxSettings] = useState(getSfxSettings());
  const [audioBlocked, setAudioBlocked] = useState(isSfxBlocked());
  const [focusedEquationRowId, setFocusedEquationRowId] = useState<string | undefined>(undefined);

  const selectedComponent = useMemo(
    () => circuit.components.find((component) => component.id === selectedComponentId),
    [circuit.components, selectedComponentId]
  );

  const primaryVoltage = useMemo(() => Object.values(solved.values).find((value) => value.key.includes(':voltage'))?.value ?? 0, [solved.values]);
  const primaryCurrent = useMemo(() => Object.values(solved.values).find((value) => value.key.includes(':current'))?.value ?? 0, [solved.values]);

  const solvedTriangle = useMemo(
    () =>
      solveCircuitValues({
        voltage: Number.isFinite(primaryVoltage) ? primaryVoltage : undefined,
        current: Number.isFinite(primaryCurrent) ? primaryCurrent : undefined,
        resistance: undefined
      }),
    [primaryCurrent, primaryVoltage]
  );

  const applyCircuitUpdate = (updater: (current: EditorCircuit) => EditorCircuit) => {
    setCircuit((current) => {
      const next = updater(current);
      if (JSON.stringify(next) === JSON.stringify(current)) {
        return current;
      }

      setHistory((prev) => [...prev.slice(-HISTORY_LIMIT + 1), cloneCircuit(current)]);
      setFuture([]);
      return next;
    });
  };

  useEffect(() => subscribeToSfxSettings(setSfxSettings), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSolved(
        runAnalysis({
          nodes: circuit.nodes.map((node) => ({
            id: node.id,
            reference: node.reference,
            voltage: node.reference ? { value: 0, known: true, computed: false, unit: 'V' } : undefined
          })),
          components: circuit.components
        }).result
      );
    }, 140);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(circuit));

    return () => window.clearTimeout(timer);
  }, [circuit]);

  useEffect(() => {
    if (!simulationActive) {
      return;
    }

    const ticker = window.setInterval(() => {
      setSimulationTime((time) => time + 0.1);
    }, 100);

    return () => window.clearInterval(ticker);
  }, [simulationActive]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        deleteSelected();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  useEffect(() => {
    if (!focusedEquationRowId) {
      return;
    }
    const rowElement = document.getElementById(`eq-row-${focusedEquationRowId}`);
    rowElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [focusedEquationRowId]);

  const undo = () => {
    setHistory((prev) => {
      const previous = prev[prev.length - 1];
      if (!previous) {
        return prev;
      }
      setFuture((curr) => [cloneCircuit(circuit), ...curr].slice(0, HISTORY_LIMIT));
      setCircuit(previous);
      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((prev) => {
      const next = prev[0];
      if (!next) {
        return prev;
      }
      setHistory((curr) => [...curr, cloneCircuit(circuit)].slice(-HISTORY_LIMIT));
      setCircuit(next);
      return prev.slice(1);
    });
  };

  const tryUnlockAudio = () => {
    unlockSfx().finally(() => setAudioBlocked(isSfxBlocked()));
  };

  const addComponentAt = (kind: Exclude<ComponentKind, 'wire'>, x: number, y: number) => {
    applyCircuitUpdate((current) => {
      const baseId = `${kind}-${Date.now()}`;
      const fromNodeId = `${baseId}-from`;
      const toNodeId = `${baseId}-to`;
      return {
        nodes: [
          ...current.nodes,
          { id: fromNodeId, x: x - 40, y },
          { id: toNodeId, x: x + 40, y }
        ],
        components: [...current.components, componentFactory(kind, baseId, fromNodeId, toNodeId)]
      };
    });
    playSfx('place');
  };

  const moveNode = (nodeId: string, x: number, y: number) => {
    applyCircuitUpdate((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node))
    }));
  };

  const deleteSelected = () => {
    if (!selectedComponentId && !selectedNodeId) {
      playSfx('error');
      return;
    }

    applyCircuitUpdate((current) => {
      if (selectedComponentId) {
        return {
          ...current,
          components: current.components.filter((component) => component.id !== selectedComponentId)
        };
      }

      if (selectedNodeId) {
        return {
          nodes: current.nodes.filter((node) => node.id !== selectedNodeId),
          components: current.components.filter((component) => component.from !== selectedNodeId && component.to !== selectedNodeId)
        };
      }

      return current;
    });

    setSelectedComponentId(undefined);
    setSelectedNodeId(undefined);
  };

  const startOrCompleteWire = (nodeId: string) => {
    if (!pendingWireFromNodeId) {
      setPendingWireFromNodeId(nodeId);
      playSfx('start');
      return;
    }

    if (pendingWireFromNodeId === nodeId) {
      setPendingWireFromNodeId(undefined);
      playSfx('stop');
      return;
    }

    applyCircuitUpdate((current) => ({
      ...current,
      components: [
        ...current.components,
        {
          id: `wire-${Date.now()}`,
          kind: 'wire',
          from: pendingWireFromNodeId,
          to: nodeId,
          label: 'wire'
        }
      ]
    }));
    playSfx('connect');
    setPendingWireFromNodeId(undefined);
  };

  const updateComponentValue = (
    componentId: string,
    valueKey: 'resistance' | 'capacitance' | 'inductance' | 'voltage' | 'current',
    value: number
  ) => {
    applyCircuitUpdate((current) => ({
      ...current,
      components: current.components.map((component) => {
        if (component.id !== componentId) {
          return component;
        }

        if (valueKey === 'resistance' && component.kind === 'resistor') {
          return { ...component, resistance: { ...component.resistance, value } };
        }
        if (valueKey === 'capacitance' && component.kind === 'capacitor') {
          return { ...component, capacitance: { ...component.capacitance, value } };
        }
        if (valueKey === 'inductance' && component.kind === 'inductor') {
          return { ...component, inductance: { ...component.inductance, value } };
        }
        if (valueKey === 'voltage' && component.kind === 'voltageSource') {
          return { ...component, voltage: { ...component.voltage, value } };
        }
        if (valueKey === 'current' && component.kind === 'currentSource') {
          return { ...component, current: { ...component.current, value } };
        }

        return component;
      })
    }));
  };

  const loadPreset = (preset: keyof typeof circuitPresets) => {
    setCircuit(cloneCircuit(circuitPresets[preset]));
    setHistory([]);
    setFuture([]);
    setSelectedComponentId(undefined);
    setSelectedNodeId(undefined);
    playSfx('place');
  };

  const shareCircuit = async () => {
    const encoded = encodeCircuit(circuit);
    const url = `${window.location.origin}${window.location.pathname}?c=${encoded}`;
    await navigator.clipboard.writeText(url);
    playSfx('connect');
  };

  const importCircuit = () => {
    const raw = window.prompt('Paste exported circuit JSON');
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as EditorCircuit;
      setCircuit(parsed);
      playSfx('place');
    } catch {
      playSfx('error');
    }
  };

  const solveForTarget = () => {
    const result = solveCircuitForTarget(
      {
        nodes: circuit.nodes.map((node) => ({
          id: node.id,
          reference: node.reference,
          voltage: node.reference ? { value: 0, known: true, computed: false, unit: 'V' } : undefined
        })),
        components: circuit.components
      },
      selectedTarget
    );

    setSolved(result);
    setTargetResult(result.target);
  };

  const simulationSnapshot = simulateStep(
    {
      voltage: solvedTriangle.voltage,
      resistance: solvedTriangle.resistance || 1
    },
    simulationTime
  );

  return (
    <main className="app-shell" onPointerDown={tryUnlockAudio}>
      <h1>Circuit Workbench</h1>
      <div className="app-controls panel">
        <button
          type="button"
          onClick={() => {
            const next = !simulationActive;
            setSimulationActive(next);
            playSfx(next ? 'start' : 'stop');
          }}
        >
          {simulationActive ? 'Stop Simulation' : 'Start Simulation'}
        </button>
        <label>
          Mode
          <select value={mode} onChange={(event) => setMode(event.target.value as 'dc' | 'ac')}>
            <option value="dc">DC Solve</option>
            <option value="ac">AC preview</option>
          </select>
        </label>
        <label>
          Preset
          <select onChange={(event) => loadPreset(event.target.value as keyof typeof circuitPresets)} defaultValue="">
            <option value="" disabled>
              Load example
            </option>
            <option value="starter">Starter</option>
            <option value="voltageDivider">Voltage Divider</option>
            <option value="currentLoop">Current Loop</option>
          </select>
        </label>
        <button type="button" onClick={undo} disabled={!history.length}>
          Undo
        </button>
        <button type="button" onClick={redo} disabled={!future.length}>
          Redo
        </button>
        <button type="button" onClick={() => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(circuit))}>
          Save
        </button>
        <button type="button" onClick={() => setCircuit(getInitialCircuit())}>
          Load
        </button>
        <button type="button" onClick={shareCircuit}>
          Copy Share Link
        </button>
        <button type="button" onClick={() => window.navigator.clipboard.writeText(JSON.stringify(circuit, null, 2))}>
          Export JSON
        </button>
        <button type="button" onClick={importCircuit}>
          Import JSON
        </button>
        <label>
          SFX Volume: {Math.round(sfxSettings.volume * 100)}%
          <input type="range" min={0} max={100} value={Math.round(sfxSettings.volume * 100)} onChange={(event) => setSfxVolume(Number(event.target.value) / 100)} />
        </label>
        <button type="button" onClick={toggleSfxMute}>
          {sfxSettings.muted ? 'Unmute SFX' : 'Mute SFX'}
        </button>
        {audioBlocked && <p className="hint">Audio is blocked by autoplay policy until user interaction.</p>}
      </div>

      <section className="status-grid panel">
        <p>
          <strong>Mode:</strong> {mode.toUpperCase()} {mode === 'ac' ? '(preview phase-shift animations only)' : ''}
        </p>
        <p>
          <strong>Sim Time:</strong> {simulationSnapshot.time.toFixed(1)}s
        </p>
        <p>
          <strong>Current:</strong> {simulationSnapshot.current.toFixed(4)} A
        </p>
        <p>
          <strong>Solve for R:</strong> {solvedTriangle.summary}
        </p>
      </section>

      <section className="workspace">
        <CircuitCanvas
          nodes={circuit.nodes}
          components={circuit.components as CanvasComponent[]}
          selectedNodeId={selectedNodeId}
          selectedComponentId={selectedComponentId}
          pendingWireFromNodeId={pendingWireFromNodeId}
          simulationActive={simulationActive}
          onAddComponentAt={addComponentAt}
          onMoveNode={moveNode}
          onDeleteSelected={deleteSelected}
          onSelectNode={(nodeId) => {
            setSelectedNodeId(nodeId);
            setSelectedComponentId(undefined);
          }}
          onSelectComponent={(componentId) => {
            setSelectedComponentId(componentId);
            setSelectedNodeId(undefined);
          }}
          onStartOrCompleteWire={startOrCompleteWire}
        />
        <div className="side-panels">
          <PropertyPanel
            selectedComponent={selectedComponent}
            selectedNodeId={selectedNodeId}
            solved={solved}
            targetResult={targetResult}
            selectedTarget={selectedTarget}
            onChangeSelectedTarget={(target) => {
              if (target.type === 'node_voltage') {
                setSelectedTarget({ type: 'node_voltage', nodeId: target.nodeId || selectedNodeId || 'gnd' });
                return;
              }

              setSelectedTarget({ type: target.type, componentId: target.componentId || selectedComponentId || '' });
            }}
            onSolveForTarget={solveForTarget}
            onUpdateComponentValue={updateComponentValue}
            onValueApplied={() => playSfx('connect')}
            onJumpToEquationRow={setFocusedEquationRowId}
          />
          <EquationBreakdownPanel solved={solved} focusedRowId={focusedEquationRowId} onFocusRow={setFocusedEquationRowId} />
        </div>
      </section>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
