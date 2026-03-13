# Component Backlog

This backlog tracks current target components from the catalog and sequences delivery by user value and simulation readiness.

## Batch plan (ordered)

### Batch 1 — Core circuit value (10 components)
Focus: high-usage passives, sources, and first-level active parts with existing solver paths.

Components: resistor, capacitor, inductor, voltage-source, current-source, diode, bjt, mosfet, op-amp, logic-gate.

### Batch 2 — Catalog breadth and diagnostics-first release (5 components)
Focus: high discoverability catalog entries that can ship as UI-first or diagnostic-gated while simulation models are added.

Components: ne555, lm358, 74hc00, ad9833, subcircuit.

## Backlog table

| Component | Batch | Category | Behavior family | Complexity | Solver support level | Release priority | Delivery mode | Owner | Target milestone |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| resistor | 1 | passive | passive2p | Low | Full (DC/AC/transient/Monte Carlo) | P0 | fully simulated | Solver Foundations | M1 |
| capacitor | 1 | passive | passive2p | Low | Full (DC/AC/transient/Monte Carlo) | P0 | fully simulated | Solver Foundations | M1 |
| inductor | 1 | passive | passive2p | Medium | Full (DC/AC/transient/Monte Carlo) | P1 | fully simulated | Solver Foundations | M1 |
| voltage-source | 1 | sources | source2p | Low | Full (DC/AC/transient/Monte Carlo) | P0 | fully simulated | Solver Foundations | M1 |
| current-source | 1 | sources | source2p | Low | Full (DC/AC/transient/Monte Carlo) | P1 | fully simulated | Solver Foundations | M1 |
| diode | 1 | semiconductors | switch | Medium | Partial (DC only; AC/transient/Monte Carlo gated) | P1 | diagnostic-only | Devices & Diagnostics | M1 |
| bjt | 1 | semiconductors | switch | High | Partial (DC only; AC/transient/Monte Carlo gated) | P1 | diagnostic-only | Devices & Diagnostics | M2 |
| mosfet | 1 | semiconductors | switch | High | Partial (DC only; AC/transient/Monte Carlo gated) | P1 | diagnostic-only | Devices & Diagnostics | M2 |
| op-amp | 1 | ics | amplifier | High | Partial (DC only; AC/transient/Monte Carlo gated) | P1 | diagnostic-only | Analog Modeling | M2 |
| logic-gate | 1 | ics | digital | Medium | Partial (DC only; AC/transient/Monte Carlo gated) | P2 | diagnostic-only | Digital Modeling | M2 |
| ne555 | 2 | ics | timer-ic (planned) | High | None in solver today | P2 | UI-only | Catalog & UX | M3 |
| lm358 | 2 | ics | amplifier-ic (planned) | Medium | None in solver today | P2 | UI-only | Catalog & UX | M3 |
| 74hc00 | 2 | ics | digital-ic (planned) | Medium | None in solver today | P2 | UI-only | Catalog & UX | M3 |
| ad9833 | 2 | specialty | waveform-generator (planned) | High | None in solver today | P3 | UI-only | Catalog & UX | M4 |
| subcircuit | 2 | specialty | hierarchy (planned) | High | None in solver today | P1 | UI-only | Platform Architecture | M4 |

## Delivery mode definitions

- **UI-only**: Visible in catalog/editor with properties and placement; solver treats as non-simulated placeholder.
- **diagnostic-only**: Included in solve flow with explicit unsupported-analysis diagnostics beyond supported modes.
- **fully simulated**: Supported by solver equations for standard analyses without fallback diagnostics.
