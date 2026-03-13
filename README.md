# Circuit Workbench

Interactive circuit builder with:

- Drag-and-drop component placement and wire routing
- Auto-solving missing electrical values
- Real-time simulation status panel
- Fluid node/component animations
- Procedural SFX with volume and mute controls
- Example presets (starter, voltage divider, current loop)
- Undo/redo with keyboard shortcuts (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z)
- Save/load, import/export JSON, and share-link copy

## Scripts

- `npm run dev` - run local dev server
- `npm run build` - type-check and build
- `npm run test` - execute tests with Vitest

## Telemetry hooks

The app exposes lightweight telemetry hooks for three events:

- `component_placed`
- `component_property_edited`
- `solver_diagnostic`

All payloads intentionally avoid user-sensitive fields (for example solver diagnostic `message` text is never emitted).

### Feature flags

- `VITE_DISABLE_TELEMETRY=true` - hard disables telemetry in all environments.
- `VITE_ENABLE_DEV_TELEMETRY=true` - opt-in override to allow telemetry while running in local/dev mode.

Telemetry is disabled by default in local/dev environments.

### Event schema

| Event | Fields |
| --- | --- |
| `component_placed` | `event`, `componentId`, `componentType`, `analysisMode`, `ts` |
| `component_property_edited` | `event`, `componentId`, `propertyKey`, `analysisMode`, `ts` |
| `solver_diagnostic` | `event`, `componentId?`, `diagnosticCode`, `severity`, `analysisMode`, `ts` |

To attach a listener, subscribe with `subscribeTelemetry` from `src/telemetry.ts`.
