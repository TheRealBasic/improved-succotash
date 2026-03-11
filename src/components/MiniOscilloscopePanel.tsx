import { useMemo } from 'react';

export type ProbeChannel = {
  id: string;
  label: string;
  unit: 'V' | 'A';
  quantity: 'voltage' | 'current';
  targetType: 'node' | 'component';
  targetId: string;
};

export type ProbeSeries = {
  time: number;
  value: number;
};

type MiniOscilloscopePanelProps = {
  channels: ProbeChannel[];
  traces: Record<string, ProbeSeries[]>;
  onRemoveChannel: (channelId: string) => void;
  onUpdateQuantity: (channelId: string, quantity: 'voltage' | 'current') => void;
};

const COLORS = ['#6de2ff', '#ffd36d', '#9dffcc', '#ff9cbc', '#c2a1ff'];

export const MiniOscilloscopePanel = ({ channels, traces, onRemoveChannel, onUpdateQuantity }: MiniOscilloscopePanelProps) => {
  const bounds = useMemo(() => {
    const values = channels.flatMap((channel) => traces[channel.id]?.map((point) => point.value) ?? []);
    if (!values.length) {
      return { min: -1, max: 1 };
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (Math.abs(max - min) < 1e-9) {
      return { min: min - 1, max: max + 1 };
    }
    return { min, max };
  }, [channels, traces]);

  const maxTime = useMemo(() => Math.max(1, ...channels.flatMap((channel) => traces[channel.id]?.map((point) => point.time) ?? [0])), [channels, traces]);

  return (
    <aside className="panel oscilloscope-panel">
      <h2>Mini Oscilloscope</h2>
      <svg viewBox="0 0 420 200" className="scope-surface" role="img" aria-label="Probe traces">
        <rect x="0" y="0" width="420" height="200" fill="#0a132d" rx="8" />
        <path d="M 0 100 L 420 100" stroke="#2a3f75" strokeWidth="1" />
        <path d="M 40 0 L 40 200" stroke="#2a3f75" strokeWidth="1" />
        {channels.map((channel, index) => {
          const series = traces[channel.id] ?? [];
          if (!series.length) {
            return null;
          }
          const color = COLORS[index % COLORS.length];
          const points = series
            .map((point) => {
              const x = 40 + (point.time / maxTime) * 360;
              const y = 185 - ((point.value - bounds.min) / (bounds.max - bounds.min)) * 170;
              return `${x},${y}`;
            })
            .join(' ');
          return <polyline key={channel.id} points={points} fill="none" stroke={color} strokeWidth={2} />;
        })}
      </svg>
      <div className="scope-meta">
        <p>Y range: {bounds.min.toFixed(3)} to {bounds.max.toFixed(3)}</p>
        <p>X range: 0 to {maxTime.toFixed(2)}s</p>
      </div>
      <ul className="probe-channel-list">
        {channels.map((channel, index) => (
          <li key={channel.id}>
            <span style={{ color: COLORS[index % COLORS.length] }}>●</span> {channel.label}
            {channel.targetType === 'component' && (
              <select value={channel.quantity} onChange={(event) => onUpdateQuantity(channel.id, event.target.value as 'voltage' | 'current')}>
                <option value="voltage">Voltage</option>
                <option value="current">Current</option>
              </select>
            )}
            <button type="button" onClick={() => onRemoveChannel(channel.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </aside>
  );
};
