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


export type SharedSwitchBehaviorModel = {
  onResistancePath: string;
  offLeakagePath: string;
  controlThresholdPath: string;
  hysteresisPath?: string;
  controlSignalPath?: string;
  statePath?: string;
};

export const SHARED_SWITCH_BEHAVIOR_MODEL: SharedSwitchBehaviorModel = {
  onResistancePath: 'onResistance',
  offLeakagePath: 'offLeakageCurrent',
  controlThresholdPath: 'controlThreshold',
  hysteresisPath: 'hysteresis',
  controlSignalPath: 'controlSignal',
  statePath: 'state'
};

const SHARED_SWITCH_CATALOG_TYPES: ComponentCatalogTypeId[] = [
  'switch-spst',
  'switch-spdt',
  'switch-dpdt',
  'relay-reed',
  'relay-ssr',
  'switch-analog'
];

export const usesSharedSwitchBehavior = (catalogTypeId: ComponentCatalogTypeId): boolean =>
  SHARED_SWITCH_CATALOG_TYPES.includes(catalogTypeId);

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
    case 'switch-spst':
    case 'switch-spdt':
    case 'switch-dpdt':
    case 'relay-reed':
    case 'relay-ssr':
    case 'switch-analog':
      return 'switch';
    case 'op-amp':
    case 'comparator':
    case 'instrumentation-amplifier':
    case 'generic-regulator-controller':
    case 'voltage-reference':
      return 'amplifier';
    case 'logic-gate':
    case 'logic-buffer':
    case 'logic-schmitt-trigger':
    case 'logic-tri-state-buffer':
    case 'logic-latch':
    case 'logic-flip-flop':
    case 'logic-counter':
    case 'logic-multiplexer':
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
  'switch-spst': { ac: false, transient: false, monteCarlo: false },
  'switch-spdt': { ac: false, transient: false, monteCarlo: false },
  'switch-dpdt': { ac: false, transient: false, monteCarlo: false },
  'relay-reed': { ac: false, transient: false, monteCarlo: false },
  'relay-ssr': { ac: false, transient: false, monteCarlo: false },
  'switch-analog': { ac: false, transient: false, monteCarlo: false },
  'op-amp': { ac: false, transient: false, monteCarlo: false },
  comparator: { ac: false, transient: false, monteCarlo: false },
  'instrumentation-amplifier': { ac: false, transient: false, monteCarlo: false },
  'generic-regulator-controller': { ac: false, transient: false, monteCarlo: false },
  'voltage-reference': { ac: false, transient: false, monteCarlo: false },
  'logic-gate': { ac: false, transient: false, monteCarlo: false },
  'logic-buffer': { ac: false, transient: false, monteCarlo: false },
  'logic-schmitt-trigger': { ac: false, transient: false, monteCarlo: false },
  'logic-tri-state-buffer': { ac: false, transient: false, monteCarlo: false },
  'logic-latch': { ac: false, transient: false, monteCarlo: false },
  'logic-flip-flop': { ac: false, transient: false, monteCarlo: false },
  'logic-counter': { ac: false, transient: false, monteCarlo: false },
  'logic-multiplexer': { ac: false, transient: false, monteCarlo: false }
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
): SolverDiagnostic[] => {
  const unsupportedAnalysis = circuit.components
    .filter((component) => !getComponentCapabilities(component)[analysisType])
    .map((component) => {
      const family = getBehaviorFamilyForCatalogType(component.catalogTypeId);
      const macroModelNote = family === 'amplifier'
        ? 'Macro-model supports DC gain/rail limiting only; frequency response and dynamic behavior are not modeled.'
        : '';
      return {
        code: 'unsupported_analysis_mode' as const,
        severity: 'warning' as const,
        componentId: component.id,
        message: `Component ${component.id} (${component.catalogTypeId}/${family}) is not supported by ${analysisType.toUpperCase()} analysis. ${capabilityActionByType[analysisType]} ${macroModelNote}`.trim()
      };
    });

  const unsupportedTiming = analysisType === 'transient'
    ? circuit.components
      .filter((component) => component.kind === 'digital')
      .filter((component) => (component.propagationDelayNs?.value ?? 0) > 0 || ['logic-tri-state-buffer', 'logic-latch', 'logic-flip-flop', 'logic-counter', 'logic-multiplexer'].includes(component.catalogTypeId))
      .map((component) => ({
        code: 'unsupported_digital_timing' as const,
        severity: 'warning' as const,
        componentId: component.id,
        message: `Component ${component.id} (${component.catalogTypeId}) uses timing/edge behavior (delay, edge-triggering, or hi-z) that is not modeled in transient mode. Configure as static threshold abstraction or interpret waveform as DC-equivalent.`
      }))
    : [];

  return [...unsupportedAnalysis, ...unsupportedTiming];
};

export const filterCircuitByCapability = (circuit: CircuitState, analysisType: AnalysisCapability): CircuitState => ({
  ...circuit,
  components: circuit.components.filter((component) => getComponentCapabilities(component)[analysisType])
});

export const assertSupportedBehaviorFamily = (_component: CircuitComponent): void => {};
