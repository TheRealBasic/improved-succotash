import { useEffect, useMemo, useState, type DragEvent, type PointerEvent } from 'react';
import type { ComponentKind } from '../engine/model';
import { ANIMATION_CLASS, ANIMATION_MS } from '../styles/animations';

export type CanvasNodePosition = {
  id: string;
  x: number;
  y: number;
  reference?: boolean;
};

export type CanvasComponent = {
  id: string;
  kind: ComponentKind;
  from: string;
  to: string;
  label?: string;
};

type RenderStatus = 'stable' | 'entering' | 'exiting';

type CircuitCanvasProps = {
  nodes: CanvasNodePosition[];
  components: CanvasComponent[];
  selectedNodeId?: string;
  selectedComponentId?: string;
  pendingWireFromNodeId?: string;
  simulationActive: boolean;
  onAddComponentAt: (kind: Exclude<ComponentKind, 'wire'>, x: number, y: number) => void;
  onSelectNode: (nodeId: string) => void;
  onSelectComponent: (componentId: string) => void;
  onMoveNode: (nodeId: string, x: number, y: number) => void;
  onDeleteSelected: () => void;
  onStartOrCompleteWire: (nodeId: string) => void;
};

const GRID_SIZE = 20;
const CANVAS_WIDTH = 820;
const CANVAS_HEIGHT = 540;

const snapToGrid = (value: number): number => Math.round(value / GRID_SIZE) * GRID_SIZE;

const componentPalette: Array<{ kind: Exclude<ComponentKind, 'wire'>; label: string }> = [
  { kind: 'resistor', label: 'Resistor' },
  { kind: 'voltageSource', label: 'Voltage Source' },
  { kind: 'currentSource', label: 'Current Source' },
  { kind: 'capacitor', label: 'Capacitor' },
  { kind: 'inductor', label: 'Inductor' }
];

export const CircuitCanvas = ({
  nodes,
  components,
  selectedNodeId,
  selectedComponentId,
  pendingWireFromNodeId,
  simulationActive,
  onAddComponentAt,
  onSelectNode,
  onSelectComponent,
  onMoveNode,
  onDeleteSelected,
  onStartOrCompleteWire
}: CircuitCanvasProps) => {
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [renderedNodes, setRenderedNodes] = useState<Array<CanvasNodePosition & { status: RenderStatus }>>([]);
  const [renderedComponents, setRenderedComponents] = useState<Array<CanvasComponent & { status: RenderStatus }>>([]);

  const nodeById = useMemo(() => new Map(renderedNodes.map((node) => [node.id, node])), [renderedNodes]);

  useEffect(() => {
    setRenderedNodes((current) => {
      const incoming = new Map(nodes.map((node) => [node.id, node]));
      const merged: Array<CanvasNodePosition & { status: RenderStatus }> = current
        .map((node) => {
          const latest = incoming.get(node.id);
          if (!latest) {
            return node.status === 'exiting' ? node : { ...node, status: 'exiting' as RenderStatus };
          }

          incoming.delete(node.id);
          return { ...latest, status: (node.status === 'entering' ? 'entering' : 'stable') as RenderStatus };
        })
        .concat([...incoming.values()].map((node) => ({ ...node, status: 'entering' as const })));

      return merged;
    });
  }, [nodes]);

  useEffect(() => {
    const enterTimer = window.setTimeout(() => {
      setRenderedNodes((current) => current.map((node) => (node.status === 'entering' ? { ...node, status: 'stable' } : node)));
    }, ANIMATION_MS.enter);
    const exitTimer = window.setTimeout(() => {
      setRenderedNodes((current) => current.filter((node) => node.status !== 'exiting'));
    }, ANIMATION_MS.exit);
    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
    };
  }, [renderedNodes]);

  useEffect(() => {
    setRenderedComponents((current) => {
      const incoming = new Map(components.map((component) => [component.id, component]));
      const merged: Array<CanvasComponent & { status: RenderStatus }> = current
        .map((component) => {
          const latest = incoming.get(component.id);
          if (!latest) {
            return component.status === 'exiting' ? component : { ...component, status: 'exiting' as RenderStatus };
          }

          incoming.delete(component.id);
          return { ...latest, status: (component.status === 'entering' ? 'entering' : 'stable') as RenderStatus };
        })
        .concat([...incoming.values()].map((component) => ({ ...component, status: 'entering' as const })));

      return merged;
    });
  }, [components]);

  useEffect(() => {
    const enterTimer = window.setTimeout(() => {
      setRenderedComponents((current) => current.map((component) => (component.status === 'entering' ? { ...component, status: 'stable' } : component)));
    }, ANIMATION_MS.enter);
    const exitTimer = window.setTimeout(() => {
      setRenderedComponents((current) => current.filter((component) => component.status !== 'exiting'));
    }, ANIMATION_MS.exit);
    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
    };
  }, [renderedComponents]);

  const getPointInSvg = (event: PointerEvent<SVGSVGElement> | DragEvent<SVGSVGElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: snapToGrid(event.clientX - rect.left),
      y: snapToGrid(event.clientY - rect.top)
    };
  };

  return (
    <article className="panel circuit-canvas">
      <h2>Circuit Canvas</h2>
      <p>Drag a component into the grid, click terminals to wire, drag terminals to move.</p>
      <div className="canvas-toolbar">
        {componentPalette.map((entry) => (
          <button
            key={entry.kind}
            type="button"
            className="palette-item"
            draggable
            onDragStart={(event) => event.dataTransfer.setData('application/x-component-kind', entry.kind)}
          >
            {entry.label}
          </button>
        ))}
        <button type="button" onClick={onDeleteSelected} className="danger">
          Delete Selected
        </button>
      </div>

      <svg
        className="canvas-surface"
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        onDragOver={(event) => {
          event.preventDefault();
          setCursor(getPointInSvg(event));
        }}
        onDrop={(event) => {
          event.preventDefault();
          const kind = event.dataTransfer.getData('application/x-component-kind') as Exclude<ComponentKind, 'wire'>;
          if (!kind) {
            return;
          }
          const { x, y } = getPointInSvg(event);
          onAddComponentAt(kind, x, y);
          setCursor(null);
        }}
        onPointerMove={(event) => {
          setCursor(getPointInSvg(event));
          if (draggingNodeId != null) {
            const { x, y } = getPointInSvg(event);
            onMoveNode(draggingNodeId, x, y);
          }
        }}
        onPointerUp={() => setDraggingNodeId(null)}
        onPointerLeave={() => {
          setHoverNodeId(null);
          setDraggingNodeId(null);
          setCursor(null);
        }}
      >
        <defs>
          <pattern id="smallGrid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
            <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#263355" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#smallGrid)" rx="10" />

        {renderedComponents.map((component) => {
          const fromNode = nodeById.get(component.from);
          const toNode = nodeById.get(component.to);
          if (!fromNode || !toNode) {
            return null;
          }

          const isSelected = component.id === selectedComponentId;
          const animationClass = component.status === 'entering' ? ANIMATION_CLASS.entering : component.status === 'exiting' ? ANIMATION_CLASS.exiting : '';
          return (
            <g key={component.id} className={animationClass}>
              <line
                x1={fromNode.x}
                y1={fromNode.y}
                x2={toNode.x}
                y2={toNode.y}
                className={`component-line ${component.kind === 'wire' && simulationActive ? 'wire-line' : ''}`}
                stroke={isSelected ? '#8fc7ff' : component.kind === 'wire' ? '#8ef7b8' : '#d4dbff'}
                strokeWidth={isSelected ? 5 : 3}
                onClick={() => onSelectComponent(component.id)}
              />
              <text
                x={(fromNode.x + toNode.x) / 2}
                y={(fromNode.y + toNode.y) / 2 - 8}
                textAnchor="middle"
                fill="#dce5ff"
                className="component-label"
              >
                {component.label ?? component.kind}
              </text>
            </g>
          );
        })}

        {pendingWireFromNodeId && cursor && nodeById.get(pendingWireFromNodeId) && (
          <line
            x1={nodeById.get(pendingWireFromNodeId)!.x}
            y1={nodeById.get(pendingWireFromNodeId)!.y}
            x2={cursor.x}
            y2={cursor.y}
            className="signal-preview"
            stroke="#ffd36d"
            strokeWidth={2}
          />
        )}

        {renderedNodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const isPending = node.id === pendingWireFromNodeId;
          const isHoverTarget = hoverNodeId === node.id && pendingWireFromNodeId != null && pendingWireFromNodeId !== node.id;
          const animationClass = node.status === 'entering' ? ANIMATION_CLASS.entering : node.status === 'exiting' ? ANIMATION_CLASS.exiting : '';
          return (
            <circle
              key={node.id}
              cx={node.x}
              cy={node.y}
              r={isSelected ? 9 : 7}
              className={`node-dot ${animationClass}`}
              fill={node.reference ? '#9dffcc' : isHoverTarget ? '#ffe38f' : isPending ? '#ffd36d' : '#86a3ff'}
              stroke="#061127"
              strokeWidth={2}
              onPointerDown={() => {
                onSelectNode(node.id);
                setDraggingNodeId(node.id);
              }}
              onDoubleClick={() => onStartOrCompleteWire(node.id)}
              onMouseEnter={() => setHoverNodeId(node.id)}
              onMouseLeave={() => setHoverNodeId(null)}
            />
          );
        })}
      </svg>
      <p className="hint">Double-click a terminal to start/finish a wire. Grid snapping is enabled.</p>
    </article>
  );
};
