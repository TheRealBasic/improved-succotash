import { COMPONENT_CATALOG_ITEMS, type ComponentCategory } from './componentCatalog';

export const REQUIRED_CERTIFICATION_CHECKS = [
  'catalogValidation',
  'placement',
  'propertyEdit',
  'solverBehaviorOrDiagnostics',
  'serialization'
] as const;

export type CertificationCheck = (typeof REQUIRED_CERTIFICATION_CHECKS)[number];
export type CertificationStatus = 'pass' | 'fail';
export type CertificationReadiness = 'ready' | 'in-progress';

export type ComponentCertificationRecord = {
  category: ComponentCategory;
  readiness: CertificationReadiness;
  checks: Record<CertificationCheck, CertificationStatus>;
};

export const COMPONENT_CERTIFICATION_MATRIX: Record<string, ComponentCertificationRecord> = {
  resistor: {
    category: 'passive',
    readiness: 'ready',
    checks: {
      catalogValidation: 'pass',
      placement: 'pass',
      propertyEdit: 'pass',
      solverBehaviorOrDiagnostics: 'pass',
      serialization: 'pass'
    }
  },
  capacitor: {
    category: 'passive',
    readiness: 'ready',
    checks: {
      catalogValidation: 'pass',
      placement: 'pass',
      propertyEdit: 'pass',
      solverBehaviorOrDiagnostics: 'pass',
      serialization: 'pass'
    }
  },
  inductor: {
    category: 'passive',
    readiness: 'in-progress',
    checks: {
      catalogValidation: 'pass',
      placement: 'fail',
      propertyEdit: 'fail',
      solverBehaviorOrDiagnostics: 'pass',
      serialization: 'fail'
    }
  },
  'voltage-source': {
    category: 'sources',
    readiness: 'ready',
    checks: {
      catalogValidation: 'pass',
      placement: 'pass',
      propertyEdit: 'pass',
      solverBehaviorOrDiagnostics: 'pass',
      serialization: 'pass'
    }
  },
  'current-source': {
    category: 'sources',
    readiness: 'in-progress',
    checks: {
      catalogValidation: 'pass',
      placement: 'fail',
      propertyEdit: 'fail',
      solverBehaviorOrDiagnostics: 'pass',
      serialization: 'pass'
    }
  },
  diode: {
    category: 'semiconductors',
    readiness: 'in-progress',
    checks: {
      catalogValidation: 'pass',
      placement: 'pass',
      propertyEdit: 'fail',
      solverBehaviorOrDiagnostics: 'fail',
      serialization: 'fail'
    }
  },
  bjt: {
    category: 'semiconductors',
    readiness: 'in-progress',
    checks: {
      catalogValidation: 'pass',
      placement: 'fail',
      propertyEdit: 'fail',
      solverBehaviorOrDiagnostics: 'fail',
      serialization: 'fail'
    }
  },
  mosfet: {
    category: 'semiconductors',
    readiness: 'in-progress',
    checks: {
      catalogValidation: 'pass',
      placement: 'fail',
      propertyEdit: 'fail',
      solverBehaviorOrDiagnostics: 'fail',
      serialization: 'fail'
    }
  },
  'op-amp': {
    category: 'ics',
    readiness: 'in-progress',
    checks: {
      catalogValidation: 'pass',
      placement: 'fail',
      propertyEdit: 'fail',
      solverBehaviorOrDiagnostics: 'fail',
      serialization: 'fail'
    }
  },
  'logic-gate': {
    category: 'ics',
    readiness: 'in-progress',
    checks: {
      catalogValidation: 'pass',
      placement: 'pass',
      propertyEdit: 'pass',
      solverBehaviorOrDiagnostics: 'pass',
      serialization: 'fail'
    }
  },
  ne555: {
    category: 'timing',
    readiness: 'in-progress',
    checks: {
      catalogValidation: 'pass',
      placement: 'fail',
      propertyEdit: 'fail',
      solverBehaviorOrDiagnostics: 'fail',
      serialization: 'fail'
    }
  },
  lm358: {
    category: 'ics',
    readiness: 'in-progress',
    checks: {
      catalogValidation: 'pass',
      placement: 'fail',
      propertyEdit: 'fail',
      solverBehaviorOrDiagnostics: 'fail',
      serialization: 'fail'
    }
  },
  '74hc00': {
    category: 'interface',
    readiness: 'in-progress',
    checks: {
      catalogValidation: 'pass',
      placement: 'fail',
      propertyEdit: 'fail',
      solverBehaviorOrDiagnostics: 'fail',
      serialization: 'fail'
    }
  },
  ad9833: {
    category: 'rf',
    readiness: 'in-progress',
    checks: {
      catalogValidation: 'pass',
      placement: 'fail',
      propertyEdit: 'fail',
      solverBehaviorOrDiagnostics: 'fail',
      serialization: 'fail'
    }
  },
  subcircuit: {
    category: 'specialty',
    readiness: 'in-progress',
    checks: {
      catalogValidation: 'pass',
      placement: 'fail',
      propertyEdit: 'fail',
      solverBehaviorOrDiagnostics: 'fail',
      serialization: 'fail'
    }
  }
};

const catalogIds = new Set(COMPONENT_CATALOG_ITEMS.map((item) => item.id));
const matrixIds = new Set(Object.keys(COMPONENT_CERTIFICATION_MATRIX));

for (const id of catalogIds) {
  if (!matrixIds.has(id)) {
    throw new Error(`Missing certification matrix entry for catalog id: ${id}`);
  }
}

for (const id of matrixIds) {
  if (!catalogIds.has(id)) {
    throw new Error(`Certification matrix entry does not map to a catalog id: ${id}`);
  }
}
