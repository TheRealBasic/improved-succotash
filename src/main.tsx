import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CircuitCanvas, type CanvasComponent, type CanvasNodePosition } from './components/CircuitCanvas';
import { PropertyPanel } from './components/PropertyPanel';
import type { CircuitComponent, ComponentKind, SolveCircuitResult, Unit, ValueMetadata } from './engine/model';
import { solveCircuit } from './engine/solver';
import './styles/theme.css';
import './styles/animations.css';

type EditorCircuit = {
  nodes: CanvasNodePosition[];
  components: CircuitComponent[];
};

const initialCircuit: EditorCircuit = {
  nodes: [
    { id: 'n-ref', x: 200, y: 260, reference: true },
    { id: 'n-1', x: 360, y: 260 }
  ],
  components: [
    {
      id: 'c-vs-1',
      kind: 'voltageSource',
      from: 'n-1',
      to: 'n-ref',
      label: 'V1',
      voltage: { value: 5, known: true, computed: false, unit: 'V', constraints: { nonZero: true } }
    }
  ]
};

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

const App = () => {
  const [circuit, setCircuit] = useState<EditorCircuit>(initialCircuit);
  const [selectedNodeId, setSelectedNodeId] = useState<string | undefined>(undefined);
  const [selectedComponentId, setSelectedComponentId] = useState<string | undefined>(initialCircuit.components[0]?.id);
  const [pendingWireFromNodeId, setPendingWireFromNodeId] = useState<string | undefined>(undefined);
  const [solved, setSolved] = useState<SolveCircuitResult>({ values: {}, diagnostics: [] });

  const selectedComponent = useMemo(
    () => circuit.components.find((component) => component.id === selectedComponentId),
    [circuit.components, selectedComponentId]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSolved(
        solveCircuit({
          nodes: circuit.nodes.map((node) => ({
            id: node.id,
            reference: node.reference,
            voltage: node.reference ? { value: 0, known: true, computed: false, unit: 'V' } : undefined
          })),
          components: circuit.components
        })
      );
    }, 140);

    return () => window.clearTimeout(timer);
  }, [circuit]);

  const addComponentAt = (kind: Exclude<ComponentKind, 'wire'>, x: number, y: number) => {
    setCircuit((current) => {
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
  };

  const moveNode = (nodeId: string, x: number, y: number) => {
    setCircuit((current) => ({
      ...current,
      nodes: current.nodes.map((node) => (node.id === nodeId ? { ...node, x, y } : node))
    }));
  };

  const deleteSelected = () => {
    setCircuit((current) => {
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
      return;
    }

    if (pendingWireFromNodeId === nodeId) {
      setPendingWireFromNodeId(undefined);
      return;
    }

    setCircuit((current) => ({
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
    setPendingWireFromNodeId(undefined);
  };

  const updateComponentValue = (
    componentId: string,
    valueKey: 'resistance' | 'capacitance' | 'inductance' | 'voltage' | 'current',
    value: number
  ) => {
    setCircuit((current) => ({
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

  return (
    <main className="app-shell">
      <h1>Circuit Workbench</h1>
      <section className="workspace">
        <CircuitCanvas
          nodes={circuit.nodes}
          components={circuit.components as CanvasComponent[]}
          selectedNodeId={selectedNodeId}
          selectedComponentId={selectedComponentId}
          pendingWireFromNodeId={pendingWireFromNodeId}
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
        <PropertyPanel selectedComponent={selectedComponent} solved={solved} onUpdateComponentValue={updateComponentValue} />
      </section>
    </main>
  );
};

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
