import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircuitCanvas, type CanvasComponent } from './components/CircuitCanvas';
import { EquationBreakdownPanel } from './components/EquationBreakdownPanel';
import { PropertyPanel } from './components/PropertyPanel';
import { ComponentLibrarySidebar } from './components/ComponentLibrarySidebar';
import { SHORTCUTS, isTextInputLike, shortcutLabel } from './components/shortcuts';
import {
  getSfxSettings,
  isSfxBlocked,
  playSfx,
  setSfxAccessibilityMode,
  setSfxIntensity,
  setSfxThemeProfile,
  setSfxVolume,
  subscribeToSfxSettings,
  toggleSfxMute,
  unlockSfx
} from './audio/sfx';
import { cloneCircuit, circuitPresets, type EditorCircuit } from './data/presets';
import type { CircuitComponent, ComponentCatalogTypeId, SolveCircuitResult, SolveTarget, SubcircuitDefinition, TargetSolveResult, Unit, ValueMetadata } from './engine/model';
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

const componentFactory = (catalogTypeId: ComponentCatalogTypeId, id: string, from: string, to: string): CircuitComponent => {
  switch (catalogTypeId) {
    case 'resistor':
      return { id, kind: 'passive2p', catalogTypeId, from, to, label: `R-${id}`, resistance: createValueMetadata('Ω', 100, { min: 0.001, nonZero: true }) };
    case 'capacitor':
      return { id, kind: 'passive2p', catalogTypeId, from, to, label: `C-${id}`, capacitance: createValueMetadata('F', 0.000001, { min: 0 }) };
    case 'inductor':
      return { id, kind: 'passive2p', catalogTypeId, from, to, label: `L-${id}`, inductance: createValueMetadata('H', 0.01, { min: 0 }) };
    case 'voltage-source':
      return { id, kind: 'source2p', catalogTypeId, from, to, label: `V-${id}`, voltage: createValueMetadata('V', 5, { nonZero: true }) };
    case 'current-source':
      return { id, kind: 'source2p', catalogTypeId, from, to, label: `I-${id}`, current: createValueMetadata('A', 0.01), nonIdeal: { internalResistance: createValueMetadata('Ω', 0), rippleAmplitude: createValueMetadata('A', 0), rippleFrequencyHz: createValueMetadata('Hz' as Unit, 0) } };
    case 'diode':
      return { id, kind: 'switch', catalogTypeId, from, to, label: `D-${id}`, forwardDrop: createValueMetadata('V', 0.7), onResistance: createValueMetadata('Ω', 10, { min: 0.001, nonZero: true }), offResistance: createValueMetadata('Ω', 1_000_000, { min: 1 }) };
    case 'bjt':
      return { id, kind: 'switch', catalogTypeId, from, to, label: `Q-${id}`, beta: createValueMetadata('A', 100), vbeOn: createValueMetadata('V', 0.7) };
    case 'mosfet':
      return { id, kind: 'switch', catalogTypeId, from, to, label: `M-${id}`, thresholdVoltage: createValueMetadata('V', 2), onResistance: createValueMetadata('Ω', 5, { min: 0.001, nonZero: true }) };
    case 'op-amp':
      return { id, kind: 'amplifier', catalogTypeId, from, to, label: `U-${id}`, gain: createValueMetadata('V', 100000), outputLimitHigh: createValueMetadata('V', 12), outputLimitLow: createValueMetadata('V', -12) };
    case 'logic-gate':
      return { id, kind: 'digital', catalogTypeId, from, to, label: `G-${id}`, gateType: 'not', bridge: { highThreshold: createValueMetadata('V', 3), lowThreshold: createValueMetadata('V', 1), highLevel: createValueMetadata('V', 5), lowLevel: createValueMetadata('V', 0) } };
    case 'wire':
      return { id, kind: 'passive2p', catalogTypeId, from, to, label: 'wire' };
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [analysisState, setAnalysisState] = useState<'idle' | 'running' | 'converged' | 'warning' | 'error'>('idle');
  const previousAnalysisState = useRef<'idle' | 'running' | 'converged' | 'warning' | 'error'>('idle');

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
    setAnalysisState('running');
    const timer = window.setTimeout(() => {
      const analysisResult = runAnalysis({
        nodes: circuit.nodes.map((node) => ({
          id: node.id,
          reference: node.reference,
          voltage: node.reference ? { value: 0, known: true, computed: false, unit: 'V' } : undefined
        })),
        components: circuit.components
      }).result;

      setSolved(analysisResult);

      const hasErrors = analysisResult.diagnostics.some((diagnostic) => diagnostic.severity === 'error');
      const hasWarnings = analysisResult.diagnostics.some((diagnostic) => diagnostic.severity === 'warning');
      if (hasErrors) {
        setAnalysisState('error');
      } else if (hasWarnings) {
        setAnalysisState('warning');
      } else {
        setAnalysisState('converged');
      }
    }, 140);

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(circuit));

    return () => window.clearTimeout(timer);
  }, [circuit]);


  useEffect(() => {
    const previous = previousAnalysisState.current;
    if (analysisState !== previous) {
      if (analysisState === 'running') {
        playSfx('start');
      }
      if (analysisState === 'converged') {
        playSfx('converge');
      }
      if (analysisState === 'warning') {
        playSfx('warning');
      }
      if (analysisState === 'error') {
        playSfx('error');
      }
      previousAnalysisState.current = analysisState;
    }
  }, [analysisState]);

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
        if (key === 'v') addComponentAt('voltage-source', 380, 260);
        if (key === 'i') addComponentAt('current-source', 380, 260);
        if (key === 'o') addComponentAt('diode', 380, 260);
        if (key === 'b') addComponentAt('bjt', 380, 260);
        if (key === 'm') addComponentAt('mosfet', 380, 260);
        if (key === 'p') addComponentAt('op-amp', 380, 260);
        if (key === 't') addComponentAt('logic-gate', 380, 260);
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

  const addComponentAt = (catalogTypeId: ComponentCatalogTypeId, x: number, y: number) => {
    applyCircuitUpdate((current) => {
      const baseId = `${catalogTypeId}-${Date.now()}`;
      const fromNodeId = `${baseId}-from`;
      const toNodeId = `${baseId}-to`;
      return {
        ...current,
        nodes: [
          ...current.nodes,
          { id: fromNodeId, x: x - 40, y },
          { id: toNodeId, x: x + 40, y }
        ],
        components: [...current.components, componentFactory(catalogTypeId, baseId, fromNodeId, toNodeId)]
      };
    }, `Place ${catalogTypeId}`);
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
          kind: 'passive2p', catalogTypeId: 'wire',
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
        kind: 'passive2p', catalogTypeId: 'wire',
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

  const updateComponentProperty = (
    componentId: string,
    valueKey: string,
    value: number | string | boolean
  ) => {
    applyCircuitUpdate((current) => ({
      ...current,
      components: current.components.map((component) => {
        if (component.id !== componentId) {
          return component;
        }

        if (valueKey === 'resistance' && component.catalogTypeId === 'resistor' && typeof value === 'number') {
          return { ...component, resistance: { ...component.resistance, value } };
        }
        if (valueKey === 'capacitance' && component.catalogTypeId === 'capacitor' && typeof value === 'number') {
          return { ...component, capacitance: { ...component.capacitance, value } };
        }
        if (valueKey === 'inductance' && component.catalogTypeId === 'inductor' && typeof value === 'number') {
          return { ...component, inductance: { ...component.inductance, value } };
        }
        if (valueKey === 'voltage' && component.catalogTypeId === 'voltage-source' && typeof value === 'number') {
          return { ...component, voltage: { ...component.voltage, value } };
        }
        if (valueKey === 'current' && component.catalogTypeId === 'current-source' && typeof value === 'number') {
          return { ...component, current: { ...component.current, value } };
        }
        if (valueKey === 'internalResistance' && (component.catalogTypeId === 'current-source' || component.catalogTypeId === 'voltage-source') && typeof value === 'number') {
          return { ...component, nonIdeal: { ...component.nonIdeal, internalResistance: { ...(component.nonIdeal?.internalResistance ?? createValueMetadata('Ω', 0)), value } } };
        }
        if (valueKey === 'rippleAmplitude' && component.catalogTypeId === 'voltage-source' && typeof value === 'number') {
          return { ...component, nonIdeal: { ...component.nonIdeal, rippleAmplitude: { ...(component.nonIdeal?.rippleAmplitude ?? createValueMetadata('V', 0)), value } } };
        }
        if (valueKey === 'rippleAmplitude' && component.catalogTypeId === 'current-source' && typeof value === 'number') {
          return { ...component, nonIdeal: { ...component.nonIdeal, rippleAmplitude: { ...(component.nonIdeal?.rippleAmplitude ?? createValueMetadata('A', 0)), value } } };
        }
        if (valueKey === 'forwardDrop' && component.catalogTypeId === 'diode' && typeof value === 'number') {
          return { ...component, forwardDrop: { ...component.forwardDrop, value } };
        }
        if (valueKey === 'beta' && component.catalogTypeId === 'bjt' && typeof value === 'number') {
          return { ...component, beta: { ...component.beta, value } };
        }
        if (valueKey === 'thresholdVoltage' && component.catalogTypeId === 'mosfet' && typeof value === 'number') {
          return { ...component, thresholdVoltage: { ...component.thresholdVoltage, value } };
        }
        if (valueKey === 'gain' && component.catalogTypeId === 'op-amp' && typeof value === 'number') {
          return { ...component, gain: { ...component.gain, value } };
        }
        if (valueKey === 'highThreshold' && component.catalogTypeId === 'logic-gate' && typeof value === 'number') {
          return { ...component, bridge: { ...component.bridge, highThreshold: { ...component.bridge.highThreshold, value } } };
        }
        if (valueKey === 'gateType' && component.catalogTypeId === 'logic-gate' && typeof value === 'string') {
          return { ...component, gateType: value as typeof component.gateType };
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


  const closeSidebarOnMobile = () => {
    if (window.matchMedia('(max-width: 960px)').matches) {
      setSidebarOpen(false);
    }
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
      <header className="top-toolbar panel">
        <h1>Circuit Workbench</h1>
        <div className="toolbar-main">
          <button type="button" className="menu-toggle" onClick={() => setSidebarOpen((value) => !value)}>
            {sidebarOpen ? 'Close Inventory' : 'Open Inventory'}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !simulationActive;
              setSimulationActive(next);
              playSfx(next ? 'start' : 'stop');
            }}
          >
            {simulationActive ? 'Stop' : 'Simulate'}
          </button>
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
        </div>
        <div className="toolbar-secondary">
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
          <button type="button" onClick={shareCircuit}>Copy Link</button>
          <button type="button" onClick={() => window.navigator.clipboard.writeText(JSON.stringify(circuit, null, 2))}>Export</button>
          <button type="button" onClick={importCircuit}>Import</button>
          <button type="button" onClick={duplicateSelected} title={`Shortcut: ${shortcutLabel('duplicate')}`}>
            Duplicate
          </button>
          <button type="button" onClick={() => setShowShortcutHelp((value) => !value)} title={`Shortcut: ${shortcutLabel('help')}`}>
            Shortcuts
          </button>
          <label>
            SFX
            <input type="range" min={0} max={100} value={Math.round(sfxSettings.volume * 100)} onChange={(event) => setSfxVolume(Number(event.target.value) / 100)} />
          </label>
          <button type="button" onClick={toggleSfxMute}>{sfxSettings.muted ? 'Unmute' : 'Mute'}</button>
          {audioBlocked && <p className="hint">Audio is blocked by autoplay policy until user interaction.</p>}
        </div>
      </header>

      <section className="workspace">
        <aside className={`inventory-sidebar panel ${sidebarOpen ? 'is-open' : ''}`}>
          <ComponentLibrarySidebar shortcutLabel={shortcutLabel} />

          <div className="sidebar-section">
            <h2>Canvas Actions</h2>
            <div className="inventory-grid">
              <button type="button" onClick={groupSelected} title={`Shortcut: ${shortcutLabel('group')}`}>Group</button>
              <button type="button" onClick={ungroupSelected} title={`Shortcut: ${shortcutLabel('ungroup')}`}>Ungroup</button>
              <label className="sidebar-checkbox">
                <input type="checkbox" checked={rerouteWiresOnMove} onChange={(event) => setRerouteWiresOnMove(event.target.checked)} />
                Reroute wires
              </label>
              <button type="button" onClick={deleteSelected} className="danger" title={`Shortcut: ${shortcutLabel('delete')}`}>
                Delete Selected
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <h2>Status</h2>
            <section className="status-grid">
              <p>
                <strong>Mode:</strong> {mode.toUpperCase()} {mode === 'ac' ? '(preview)' : ''}
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
          </div>
        </aside>

        <section className="canvas-pane">
          <CircuitCanvas
            nodes={circuit.nodes}
            components={circuit.components as CanvasComponent[]}
            selectedNodeId={selectedNodeId}
            selectedComponentId={selectedComponentId}
            pendingWireFromNodeId={pendingWireFromNodeId}
            simulationActive={simulationActive}
            rerouteWiresOnMove={rerouteWiresOnMove}
            onAddComponentAt={addComponentAt}
            onAddSubcircuitAt={addSubcircuitAt}
            onMoveNode={moveNode}
            onSelectNode={(nodeId) => {
              setSelectedNodeId(nodeId);
              setSelectedComponentId(undefined);
              closeSidebarOnMobile();
            }}
            onSelectComponent={(componentId) => {
              setSelectedComponentId(componentId);
              setSelectedNodeId(undefined);
              closeSidebarOnMobile();
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
              onUpdateComponentProperty={updateComponentProperty}
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
      </section>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
