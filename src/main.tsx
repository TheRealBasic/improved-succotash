import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircuitCanvas, type CanvasComponent } from './components/CircuitCanvas';
import { EquationBreakdownPanel } from './components/EquationBreakdownPanel';
import { PropertyPanel } from './components/PropertyPanel';
import { SHORTCUTS, isTextInputLike, shortcutLabel } from './components/shortcuts';
import { getSfxSettings, isSfxBlocked, playSfx, setSfxVolume, subscribeToSfxSettings, toggleSfxMute, unlockSfx } from './audio/sfx';
import { cloneCircuit, circuitPresets, type EditorCircuit } from './data/presets';
import type { CircuitComponent, ComponentKind, SolveCircuitResult, SolveTarget, SubcircuitDefinition, TargetSolveResult, Unit, ValueMetadata } from './engine/model';
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
const decodeCircuit = (encoded: string): EditorCircuit => normalizeCircuit(JSON.parse(decodeURIComponent(escape(window.atob(encoded)))) as EditorCircuit);


const normalizeCircuit = (circuit: EditorCircuit): EditorCircuit => ({
  ...circuit,
  subcircuits: circuit.subcircuits ?? []
});

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
      return normalizeCircuit(JSON.parse(local) as EditorCircuit);
    } catch {
      return cloneCircuit(circuitPresets.starter);
    }
  }

  return cloneCircuit(circuitPresets.starter);
};

const App = () => {
  type HistoryEntry = { circuit: EditorCircuit; action: string; timestamp: number };
  const [circuit, setCircuit] = useState<EditorCircuit>(getInitialCircuit);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [future, setFuture] = useState<HistoryEntry[]>([]);
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
  const [rerouteWiresOnMove, setRerouteWiresOnMove] = useState(true);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

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

  const applyCircuitUpdate = (updater: (current: EditorCircuit) => EditorCircuit, action = 'Edit') => {
    setCircuit((current) => {
      const next = updater(current);
      if (JSON.stringify(next) === JSON.stringify(current)) {
        return current;
      }

      setHistory((prev) => [...prev.slice(-HISTORY_LIMIT + 1), { circuit: cloneCircuit(current), action, timestamp: Date.now() }]);
      setFuture([]);
      return next;
    });
  };

  const timeline = useMemo(() => [...history, { circuit, action: 'Current', timestamp: Date.now() }, ...future], [history, circuit, future]);
  const timelineIndex = history.length;

  const jumpToTimelineIndex = (targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= timeline.length || targetIndex === timelineIndex) {
      return;
    }
    const target = timeline[targetIndex];
    setCircuit(cloneCircuit(target.circuit));
    setHistory(timeline.slice(0, targetIndex).map((entry) => ({ ...entry, circuit: cloneCircuit(entry.circuit) })));
    setFuture(timeline.slice(targetIndex + 1).map((entry) => ({ ...entry, circuit: cloneCircuit(entry.circuit) })));
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
      if (isTextInputLike(event.target)) {
        return;
      }

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

      if (event.key === '?') {
        setShowShortcutHelp((value) => !value);
      }
      if (!mod && !event.shiftKey) {
        const key = event.key.toLowerCase();
        if (key === 'r') addComponentAt('resistor', 380, 260);
        if (key === 'c') addComponentAt('capacitor', 380, 260);
        if (key === 'l') addComponentAt('inductor', 380, 260);
        if (key === 'v') addComponentAt('voltageSource', 380, 260);
        if (key === 'i') addComponentAt('currentSource', 380, 260);
        if (key === 's') addSubcircuitAt(380, 260);
        if (key === 'w' && selectedNodeId) startOrCompleteWire(selectedNodeId);
        if (key === 'd') duplicateSelected();
        if (key === 'g') groupSelected();
        if (key === 'x') solveForTarget();
        if (key === '[') jumpToTimelineIndex(timelineIndex - 1);
        if (key === ']') jumpToTimelineIndex(timelineIndex + 1);
      }

      if (!mod && event.shiftKey && event.key.toLowerCase() === 'g') {
        ungroupSelected();
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
      setFuture((curr) => [{ circuit: cloneCircuit(circuit), action: 'Redo target', timestamp: Date.now() }, ...curr].slice(0, HISTORY_LIMIT));
      setCircuit(previous.circuit);
      return prev.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((prev) => {
      const next = prev[0];
      if (!next) {
        return prev;
      }
      setHistory((curr) => [...curr, { circuit: cloneCircuit(circuit), action: 'Undo target', timestamp: Date.now() }].slice(-HISTORY_LIMIT));
      setCircuit(next.circuit);
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
        ...current,
        nodes: [
          ...current.nodes,
          { id: fromNodeId, x: x - 40, y },
          { id: toNodeId, x: x + 40, y }
        ],
        components: [...current.components, componentFactory(kind, baseId, fromNodeId, toNodeId)]
      };
    }, `Place ${kind}`);
    playSfx('place');
  };

  const moveNode = (nodeId: string, x: number, y: number) => {
    applyCircuitUpdate((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node))
    }), 'Move node');
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
    }, 'Delete selected');

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
    }), 'Connect wire');
    playSfx('connect');
    setPendingWireFromNodeId(undefined);
  };


  const addSubcircuitAt = (x: number, y: number) => {
    applyCircuitUpdate((current) => {
      const template = current.subcircuits?.[0];
      if (!template) {
        return current;
      }

      const instanceId = `sub-${Date.now()}`;
      const leftNodeId = `${instanceId}-in`;
      const rightNodeId = `${instanceId}-out`;
      const component: CircuitComponent = {
        id: instanceId,
        kind: 'wire',
        from: leftNodeId,
        to: rightNodeId,
        label: template.label,
        groupId: template.groupId
      };

      return {
        ...current,
        nodes: [...current.nodes, { id: leftNodeId, x: x - 40, y, groupId: template.groupId }, { id: rightNodeId, x: x + 40, y, groupId: template.groupId }],
        components: [...current.components, component]
      };
    }, 'Place subcircuit');
  };

  const duplicateSelected = () => {
    applyCircuitUpdate((current) => {
      if (selectedComponentId) {
        const selectedComponent = current.components.find((component) => component.id === selectedComponentId);
        if (!selectedComponent) {
          return current;
        }
        const fromNode = current.nodes.find((node) => node.id === selectedComponent.from);
        const toNode = current.nodes.find((node) => node.id === selectedComponent.to);
        if (!fromNode || !toNode) {
          return current;
        }
        const cloneId = `${selectedComponent.kind}-${Date.now()}`;
        const fromId = `${cloneId}-from`;
        const toId = `${cloneId}-to`;
        return {
          ...current,
          nodes: [...current.nodes, { ...fromNode, id: fromId, x: fromNode.x + 20, y: fromNode.y + 20 }, { ...toNode, id: toId, x: toNode.x + 20, y: toNode.y + 20 }],
          components: [...current.components, { ...selectedComponent, id: cloneId, from: fromId, to: toId, label: `${selectedComponent.label ?? selectedComponent.kind} copy` }]
        };
      }
      if (selectedNodeId) {
        const node = current.nodes.find((item) => item.id === selectedNodeId);
        if (!node) {
          return current;
        }
        return { ...current, nodes: [...current.nodes, { ...node, id: `${node.id}-copy-${Date.now()}`, x: node.x + 20, y: node.y + 20 }] };
      }
      return current;
    }, 'Duplicate selected');
  };

  const groupSelected = () => {
    const selectedIds = {
      nodeId: selectedNodeId,
      componentId: selectedComponentId
    };

    if (!selectedIds.nodeId && !selectedIds.componentId) {
      return;
    }

    applyCircuitUpdate((current) => {
      const memberNodeIds = new Set<string>();
      const memberComponentIds = new Set<string>();

      if (selectedIds.nodeId) {
        memberNodeIds.add(selectedIds.nodeId);
      }
      if (selectedIds.componentId) {
        memberComponentIds.add(selectedIds.componentId);
        const component = current.components.find((entry) => entry.id === selectedIds.componentId);
        if (component) {
          memberNodeIds.add(component.from);
          memberNodeIds.add(component.to);
        }
      }

      if (!memberNodeIds.size && !memberComponentIds.size) {
        return current;
      }

      const groupId = `group-${Date.now()}`;
      const memberNodes = current.nodes.filter((node) => memberNodeIds.has(node.id));
      const memberComponents = current.components.filter((component) => memberComponentIds.has(component.id));
      const externalPins = memberNodes.slice(0, 2).map((node, index) => ({ id: `${groupId}-pin-${index + 1}`, label: `P${index + 1}`, memberNodeId: node.id }));
      const sub: SubcircuitDefinition = {
        id: `subdef-${Date.now()}`,
        groupId,
        label: `Subcircuit ${((current.subcircuits?.length ?? 0) + 1)}`,
        externalPins,
        internalMembers: {
          nodes: memberNodes,
          components: memberComponents
        }
      };

      return {
        ...current,
        nodes: current.nodes.map((node) => (memberNodeIds.has(node.id) ? { ...node, groupId } : node)),
        components: current.components.map((component) => (memberComponentIds.has(component.id) ? { ...component, groupId } : component)),
        subcircuits: [...(current.subcircuits ?? []), sub]
      };
    }, 'Group selected');
  };

  const ungroupSelected = () => {
    applyCircuitUpdate((current) => {
      const selectedGroupId =
        current.components.find((component) => component.id === selectedComponentId)?.groupId ??
        current.nodes.find((node) => node.id === selectedNodeId)?.groupId;

      if (!selectedGroupId) {
        return current;
      }

      return {
        ...current,
        nodes: current.nodes.map((node) => (node.groupId === selectedGroupId ? { ...node, groupId: undefined } : node)),
        components: current.components.map((component) => (component.groupId === selectedGroupId ? { ...component, groupId: undefined } : component)),
        subcircuits: (current.subcircuits ?? []).filter((sub) => sub.groupId !== selectedGroupId)
      };
    }, 'Ungroup selected');
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
    }), 'Update value');
  };

  const loadPreset = (preset: keyof typeof circuitPresets) => {
    setCircuit(normalizeCircuit(cloneCircuit(circuitPresets[preset])));
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
      const parsed = normalizeCircuit(JSON.parse(raw) as EditorCircuit);
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
        <button type="button" onClick={() => setCircuit(normalizeCircuit(getInitialCircuit()))}>
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
        <button type="button" onClick={duplicateSelected} title={`Shortcut: ${shortcutLabel('duplicate')}`}>
          Duplicate Selected
        </button>
        <button type="button" onClick={() => setShowShortcutHelp((value) => !value)} title={`Shortcut: ${shortcutLabel('help')}`}>
          Keyboard Help
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
          rerouteWiresOnMove={rerouteWiresOnMove}
          onSetRerouteWiresOnMove={setRerouteWiresOnMove}
          onAddComponentAt={addComponentAt}
          onAddSubcircuitAt={addSubcircuitAt}
          onGroupSelected={groupSelected}
          onUngroupSelected={ungroupSelected}
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
            solveShortcutHint={shortcutLabel('probe')}
            onUpdateComponentValue={updateComponentValue}
            onValueApplied={() => playSfx('connect')}
            onJumpToEquationRow={setFocusedEquationRowId}
          />
          <EquationBreakdownPanel solved={solved} focusedRowId={focusedEquationRowId} onFocusRow={setFocusedEquationRowId} />
          <aside className="panel timeline-panel">
            <h2>Timeline</h2>
            {timeline.map((entry, index) => (
              <button key={`${entry.timestamp}-${index}`} type="button" className={`timeline-item ${index === timelineIndex ? 'active' : ''}`} onClick={() => jumpToTimelineIndex(index)}>
                {index === timelineIndex ? '●' : '○'} {entry.action}
              </button>
            ))}
          </aside>
          {showShortcutHelp && (
            <aside className="panel shortcut-help">
              <h2>Keyboard Shortcuts</h2>
              <ul>
                {SHORTCUTS.map((shortcut) => (
                  <li key={shortcut.id}>
                    <strong>{shortcut.keys.join(' / ')}</strong>: {shortcut.description}
                  </li>
                ))}
              </ul>
            </aside>
          )}
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
