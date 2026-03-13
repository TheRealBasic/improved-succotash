import type {
  CircuitComponent,
  CircuitState,
  ComponentCatalogTypeId,
  ComponentKind,
  SolverDiagnostic
} from './model';

export const assertNever = (value: never, message: string): never => {
  throw new Error(`${message}: ${String(value)}`);
};

export type AnalysisCapability = 'dc' | 'ac' | 'transient' | 'monteCarlo';

type CapabilityMap = Record<AnalysisCapability, boolean>;

const fullCapability: CapabilityMap = {
  dc: true,
  ac: true,
  transient: true,
  monteCarlo: true
};

const reducedCapability = (overrides: Partial<CapabilityMap>): CapabilityMap => ({
  ...fullCapability,
  ...overrides
});

export const getBehaviorFamilyForCatalogType = (catalogTypeId: ComponentCatalogTypeId): ComponentKind => {
  switch (catalogTypeId) {
    case 'resistor':
    case 'capacitor':
    case 'inductor':
    case 'wire':
      return 'passive2p';
    case 'voltage-source':
    case 'current-source':
    case 'ac-voltage-source':
    case 'pulse-voltage-source':
    case 'reference-source':
    case 'battery-cell':
    case 'battery-pack':
    case 'battery-coin-cell':
    case 'ldo-regulator':
    case 'buck-regulator':
    case 'boost-regulator':
    case 'charge-pump':
    case 'current-regulator':
      return 'source2p';
    case 'diode':
    case 'bjt':
    case 'mosfet':
      return 'switch';
    case 'op-amp':
      return 'amplifier';
    case 'logic-gate':
      return 'digital';
  }
};

const familyCapabilityRegistry: Record<ComponentKind, CapabilityMap> = {
  passive2p: fullCapability,
  source2p: fullCapability,
  switch: reducedCapability({ ac: false, transient: false, monteCarlo: false }),
  amplifier: reducedCapability({ ac: false, transient: false, monteCarlo: false }),
  digital: reducedCapability({ ac: false, transient: false, monteCarlo: false }),
  sensor: reducedCapability({ dc: false, ac: false, transient: false, monteCarlo: false })
};

const catalogCapabilityRegistry: Partial<Record<ComponentCatalogTypeId, Partial<CapabilityMap>>> = {

  'ac-voltage-source': { dc: false, ac: true, transient: true, monteCarlo: false },
  'pulse-voltage-source': { dc: false, ac: false, transient: true, monteCarlo: false },
  'reference-source': { dc: true, ac: true, transient: true, monteCarlo: true },
  'battery-cell': { dc: true, ac: false, transient: false, monteCarlo: true },
  'battery-pack': { dc: true, ac: false, transient: false, monteCarlo: true },
  'battery-coin-cell': { dc: true, ac: false, transient: false, monteCarlo: true },
  'ldo-regulator': { dc: true, ac: false, transient: false, monteCarlo: false },
  'buck-regulator': { dc: true, ac: false, transient: false, monteCarlo: false },
  'boost-regulator': { dc: true, ac: false, transient: false, monteCarlo: false },
  'charge-pump': { dc: false, ac: false, transient: false, monteCarlo: false },
  'current-regulator': { dc: true, ac: false, transient: false, monteCarlo: false },
  diode: { ac: false, transient: false, monteCarlo: false },
  bjt: { ac: false, transient: false, monteCarlo: false },
  mosfet: { ac: false, transient: false, monteCarlo: false },
  'op-amp': { ac: false, transient: false, monteCarlo: false },
  'logic-gate': { ac: false, transient: false, monteCarlo: false }
};

export const getComponentCapabilities = (component: CircuitComponent): CapabilityMap => {
  const family = getBehaviorFamilyForCatalogType(component.catalogTypeId);
  const familyCapabilities = familyCapabilityRegistry[family];
  const catalogCapabilities = catalogCapabilityRegistry[component.catalogTypeId];
  return {
    ...familyCapabilities,
    ...catalogCapabilities
  };
};

const capabilityActionByType: Record<AnalysisCapability, string> = {
  dc: 'Run DC or remove this component from the netlist.',
  ac: 'Use DC analysis for this component or replace it with an AC-supported equivalent model.',
  transient: 'Use DC analysis for this component or replace it with a transient-supported equivalent model.',
  monteCarlo: 'Exclude this component from Monte Carlo sensitivity runs or replace it with a supported model.'
};

export const getUnsupportedComponentDiagnostics = (
  circuit: CircuitState,
  analysisType: AnalysisCapability
): SolverDiagnostic[] =>
  circuit.components
    .filter((component) => !getComponentCapabilities(component)[analysisType])
    .map((component) => ({
      code: 'unsupported_analysis_mode' as const,
      severity: 'warning' as const,
      componentId: component.id,
      message: `Component ${component.id} (${component.catalogTypeId}/${getBehaviorFamilyForCatalogType(component.catalogTypeId)}) is not supported by ${analysisType.toUpperCase()} analysis. ${capabilityActionByType[analysisType]}`
    }));

export const filterCircuitByCapability = (circuit: CircuitState, analysisType: AnalysisCapability): CircuitState => ({
  ...circuit,
  components: circuit.components.filter((component) => getComponentCapabilities(component)[analysisType])
});

export const assertSupportedBehaviorFamily = (_component: CircuitComponent): void => {};
