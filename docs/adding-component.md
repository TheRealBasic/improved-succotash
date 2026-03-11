# Adding a Component

This guide is the standard workflow for adding new entries to the component catalog, from basic symbol-only additions to fully simulated components.

## Required files to touch

When introducing a new component, always review and usually update the following areas.

### 1) Catalog definition
- `src/data/componentCatalog.ts`
  - Add the new `ComponentCatalogItem`.
  - Ensure a unique `id`, `kind`, and sensible `displayName`.
  - Provide `pins`, `editablePropertySchema`, `solverBehavior`, and `defaultProps`.
  - Add `metadata.shortcut` only if a keyboard shortcut is needed and non-conflicting.

### 2) UI mapping and discoverability
- `src/components/componentCatalog.ts`
  - Ensure the component resolves to an intended sidebar category/subcategory (via `sidebar` on the catalog item, or legacy fallback behavior).
  - Confirm search token discoverability (`displayName`, aliases, tags, part number).
- `src/components/ComponentLibrarySidebar.tsx`
  - Validate visual placement and grouping if introducing a new grouping pattern.
- `src/components/shortcuts.ts`
  - Update only if introducing or changing shortcut behavior.

### 3) Solver capability and behavior
- `src/engine/componentBehavior.ts`
  - Map catalog type to a behavior family in `getBehaviorFamilyForCatalogType`.
  - Define/override analysis support (`dc`, `ac`, `transient`, `monteCarlo`) as needed.
  - Ensure unsupported analyses produce intentional diagnostics.
- `src/engine/solver.ts` and analysis modules under `src/engine/analysis/`
  - Update solver/model logic when the component affects equation building or analysis execution.

### 4) Tests
- `src/components/__tests__/component-library-sidebar.test.tsx`
  - Validate discoverability and sidebar grouping.
- `src/engine/__tests__/analysis.test.ts`
  - Validate capability gating and unsupported-analysis diagnostics.
- `src/engine/__tests__/solver.circuit.test.ts` and/or `src/test/solver.test.ts`
  - Validate equation inclusion and solve behavior for the new component.

---

## Validation steps

Run these checks before opening a PR:

1. Build and type-check:
   - `npm run build`
2. Run full tests:
   - `npm run test`
3. Manual sanity checks in the app:
   - Component appears in expected sidebar location.
   - Search finds it by id, label, alias, and relevant tags.
   - Default values render correctly in property panel.
   - Solver behavior is correct for supported analyses.
   - Unsupported analyses show warning diagnostics (not silent failures).

## Common failure modes

- **Duplicate ids** in `componentCatalog.ts`
  - Symptoms: wrong component appears, shortcut collisions, stale lookup behavior.
- **Missing or mismatched defaults** (`defaultProps` vs `editablePropertySchema` / `solverBehavior.propertyMap`)
  - Symptoms: undefined values, wrong units, property panel inconsistencies, solver NaNs.
- **Unsupported analysis not explicitly handled**
  - Symptoms: silent drop from analysis, confusing output, or missing diagnostics.
- **Sidebar mapping mismatch**
  - Symptoms: component lands in unexpected category/subcategory.
- **Shortcut collisions**
  - Symptoms: keypress triggers wrong component placement.

---

## Templates

Use these as a baseline and adapt field names/units to your model.

### Minimal component (catalog + basic solver family)

```ts
// src/data/componentCatalog.ts
{
  id: 'example-passive',
  displayName: 'Example Passive',
  kind: 'resistor',
  category: 'passive',
  subcategory: 'generic',
  description: 'Minimal two-pin passive example.',
  tags: ['example', 'passive'],
  pinCount: 2,
  symbolVariant: 'generic',
  pins: [
    { id: 'a', label: 'A', index: 0, role: 'passive' },
    { id: 'b', label: 'B', index: 1, role: 'passive' }
  ],
  editablePropertySchema: {
    resistance: { type: 'number', label: 'Resistance', unit: 'Ω', min: 0.001 }
  },
  solverBehavior: {
    model: 'resistor',
    propertyMap: { resistance: 'resistanceOhms' }
  },
  defaultProps: {
    resistanceOhms: 1000
  },
  sidebar: { category: 'passive', subcategory: 'generic' }
}

// src/engine/componentBehavior.ts
case 'example-passive':
  return 'passive2p';
```

### Fully simulated component (catalog + capability gating + solver integration)

```ts
// src/data/componentCatalog.ts
{
  id: 'example-simulated',
  displayName: 'Example Simulated Device',
  kind: 'op-amp',
  category: 'ics',
  subcategory: 'op-amps',
  description: 'Demonstrates a richer model with multiple mapped parameters.',
  tags: ['example', 'simulated', 'analog'],
  pinCount: 5,
  symbolVariant: 'op-amp',
  pins: [
    { id: 'vin+', label: 'VIN+', index: 0, role: 'input' },
    { id: 'vin-', label: 'VIN-', index: 1, role: 'input' },
    { id: 'vout', label: 'VOUT', index: 2, role: 'output' },
    { id: 'vcc', label: 'VCC', index: 3, role: 'power' },
    { id: 'vee', label: 'VEE', index: 4, role: 'power' }
  ],
  editablePropertySchema: {
    gain: { type: 'number', label: 'Open-loop gain', min: 1 },
    inputOffsetMv: { type: 'number', label: 'Input offset', unit: 'mV' },
    slewRateVPerUs: { type: 'number', label: 'Slew rate', unit: 'V/µs', min: 0 }
  },
  solverBehavior: {
    model: 'op-amp',
    propertyMap: {
      gain: 'gain',
      inputOffsetMv: 'inputOffsetMv',
      slewRateVPerUs: 'slewRateVPerUs'
    },
    pinMap: {
      nonInverting: 'vin+',
      inverting: 'vin-',
      output: 'vout'
    }
  },
  defaultProps: {
    gain: 100000,
    inputOffsetMv: 1,
    slewRateVPerUs: 0.5
  },
  sidebar: { category: 'ics', subcategory: 'op-amps' }
}

// src/engine/componentBehavior.ts
case 'example-simulated':
  return 'amplifier';

// Optional explicit capability override if needed.
const catalogCapabilityRegistry = {
  // ...existing entries
  'example-simulated': { ac: false, transient: false, monteCarlo: false }
};

// src/engine/solver.ts and/or src/engine/analysis/*.ts
// - Read solverBehavior.model/propertyMap/pinMap.
// - Include device equations in supported analyses.
// - Emit diagnostics for unsupported analyses.
```

---

## PR checklist for high-volume component additions

Use this checklist in every component-addition PR:

- [ ] Component `id` is unique and naming is consistent with existing catalog entries.
- [ ] `defaultProps` keys match `solverBehavior.propertyMap` targets.
- [ ] Property schema includes correct units, bounds, and labels.
- [ ] Pin metadata (`id`, `index`, `role`) is complete and stable.
- [ ] Sidebar category/subcategory is intentional and verified in UI.
- [ ] Search discoverability validated (id, display name, aliases, tags).
- [ ] Shortcut assignment checked for collisions (if shortcut added).
- [ ] Behavior family mapping added/updated in `componentBehavior.ts`.
- [ ] Analysis capability support is explicit; unsupported analyses produce diagnostics.
- [ ] Solver and/or analysis tests updated.
- [ ] Regression tests pass (`npm run test`) and build passes (`npm run build`).

For bulk additions, include a short table in the PR body with each new component id, behavior family, supported analyses, and test coverage reference.
