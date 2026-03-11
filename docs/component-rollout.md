# Component Rollout Plan

This document outlines a staged rollout for expanding the component set while keeping implementation quality, solver stability, and review throughput predictable.

## Rollout Waves

### Wave 1: Easy passives and sources
Focus: low-complexity, high-coverage building blocks that unblock many circuits.

Example scope:
- Passive fundamentals (resistor variants, capacitor variants, inductor variants where behavior is already supported)
- Independent sources (DC/AC voltage/current source variants)
- Basic grounding/reference helpers

Goals:
- Quickly increase usable catalog breadth.
- Validate catalog/symbol/property workflows end-to-end with low solver risk.

### Wave 2: Switches and relays
Focus: stateful components with topology changes but bounded behavior complexity.

Example scope:
- SPST/SPDT switches
- Push-button/toggle style controls
- Relay families (coil + contact variants)

Goals:
- Prove robust handling of dynamic connectivity/state transitions.
- Establish diagnostics and UX patterns for switch-state-dependent circuits.

### Wave 3: Analog ICs
Focus: higher-behavior analog blocks requiring richer properties and model assumptions.

Example scope:
- Op-amp families
- Comparator-like analog blocks
- Regulator/reference-style IC abstractions (as supported by the solver model)

Goals:
- Standardize property schemas for IC-grade components.
- Ensure solver behavior remains explainable with clear diagnostics.

### Wave 4: Digital, sensors, and specialty
Focus: mixed-domain and niche components with larger model variance.

Example scope:
- Digital gates/logic primitives
- Sensor abstractions (temperature/light/pressure, etc.)
- Specialty components with unique constraints

Goals:
- Integrate cross-domain behavior without regressing editor/search responsiveness.
- Capture edge-case diagnostics and documentation for advanced users.

## Definition of Done (per component)
A component is considered complete only when all items below are done:

1. **Catalog entry**
   - Registered in the component catalog with correct category, metadata, and discoverability tags.
2. **Symbol**
   - Editor symbol and visual representation implemented and verified for readability.
3. **Property schema**
   - Typed/defaulted property contract defined, including units, validation bounds, and migration safety as needed.
4. **Placement**
   - Placeable from sidebar/search with correct defaults and expected canvas interactions.
5. **Solver behavior and diagnostics**
   - Deterministic solver/model behavior implemented.
   - Actionable diagnostics for unsupported/invalid configurations.
6. **Tests**
   - Unit/integration coverage for parsing, placement, model behavior, and diagnostics.
7. **Docs**
   - User-facing usage notes and constraints documented.

## Per-Wave Acceptance Metrics
Each rollout wave is accepted only when all of the following are true:

1. **No validation errors**
   - Newly introduced components pass schema/model validation in expected usage paths.
2. **Passing test suite**
   - Existing and newly added tests pass in CI/local baseline.
3. **Stable sidebar/search performance**
   - No meaningful regressions in component library sidebar rendering and search interactions.

## Ownership and Batching Guidance

- Assign one **primary owner** per component batch, with at least one **review partner** for solver and UX checks.
- Keep changes to **10–15 components per PR** to maintain review quality and reduce merge risk.
- Prefer batching by **wave + component family** (e.g., passive sources together) rather than by unrelated features.
- For high-risk components (stateful switching, IC abstractions), use smaller PR slices where needed.
- Require each PR to include:
  - Explicit list of components added/updated
  - DoD checklist completion status
  - Test evidence and any known limitations
