import React from 'react';
import { createRoot } from 'react-dom/client';
import { CircuitCanvas } from './components/CircuitCanvas';
import { PropertyPanel } from './components/PropertyPanel';
import './styles/theme.css';
import './styles/animations.css';

const App = () => (
  <main className="app-shell">
    <h1>Circuit Workbench</h1>
    <section className="workspace">
      <CircuitCanvas />
      <PropertyPanel />
    </section>
  </main>
);

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
