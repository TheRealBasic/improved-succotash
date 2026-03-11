import { useMemo } from 'react';
import { simulateStep } from '../engine/simulation';
import { playInteractionSfx } from '../audio/sfx';

export const CircuitCanvas = () => {
  const preview = useMemo(() => simulateStep({ voltage: 5, resistance: 10 }, 0.016), []);

  return (
    <article className="panel circuit-canvas" onClick={() => playInteractionSfx('tap')}>
      <h2>Circuit Canvas</h2>
      <p>Click to place and connect components.</p>
      <p>Preview current: {preview.current.toFixed(2)} A</p>
    </article>
  );
};
