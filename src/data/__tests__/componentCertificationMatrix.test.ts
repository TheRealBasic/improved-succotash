import { describe, expect, it } from 'vitest';
import {
  COMPONENT_CERTIFICATION_MATRIX,
  REQUIRED_CERTIFICATION_CHECKS,
  type CertificationCheck
} from '../componentCertificationMatrix';

const findMissingChecks = (checks: Record<CertificationCheck, 'pass' | 'fail'>): CertificationCheck[] =>
  REQUIRED_CERTIFICATION_CHECKS.filter((check) => checks[check] !== 'pass');

describe('component certification matrix', () => {
  it('defines required certification checks for every component row', () => {
    for (const [catalogId, record] of Object.entries(COMPONENT_CERTIFICATION_MATRIX)) {
      expect(record).toHaveProperty('checks');
      expect(record).toHaveProperty('readiness');

      for (const check of REQUIRED_CERTIFICATION_CHECKS) {
        expect(record.checks[check], `${catalogId} is missing ${check}`).toBeDefined();
      }
    }
  });

  it('fails CI when a ready component is missing required certification checks', () => {
    const failingReadyComponents = Object.entries(COMPONENT_CERTIFICATION_MATRIX)
      .filter(([, record]) => record.readiness === 'ready')
      .map(([catalogId, record]) => ({
        catalogId,
        missingChecks: findMissingChecks(record.checks)
      }))
      .filter((entry) => entry.missingChecks.length > 0);

    expect(
      failingReadyComponents,
      failingReadyComponents
        .map((entry) => `${entry.catalogId}: ${entry.missingChecks.join(', ')}`)
        .join('\n')
    ).toEqual([]);
  });

  it('prints uncovered components by category', () => {
    const uncoveredByCategory = Object.entries(COMPONENT_CERTIFICATION_MATRIX)
      .map(([catalogId, record]) => ({
        catalogId,
        category: record.category,
        readiness: record.readiness,
        missingChecks: findMissingChecks(record.checks)
      }))
      .filter((entry) => entry.missingChecks.length > 0)
      .reduce<Record<string, Array<{ catalogId: string; readiness: string; missingChecks: CertificationCheck[] }>>>(
        (acc, entry) => {
          acc[entry.category] ??= [];
          acc[entry.category].push({
            catalogId: entry.catalogId,
            readiness: entry.readiness,
            missingChecks: entry.missingChecks
          });
          return acc;
        },
        {}
      );

    const summaryLines = Object.entries(uncoveredByCategory)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([category, entries]) => [
        `[${category}]`,
        ...entries
          .sort((left, right) => left.catalogId.localeCompare(right.catalogId))
          .map((entry) => `- ${entry.catalogId} (${entry.readiness}): ${entry.missingChecks.join(', ')}`)
      ]);

    console.info('Component certification uncovered summary:\n' + summaryLines.join('\n'));

    expect(summaryLines.length).toBeGreaterThan(0);
  });
});
