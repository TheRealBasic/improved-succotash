import type { Unit } from '../model';

const SI_PREFIX_FACTORS = {
  '': 1,
  p: 1e-12,
  n: 1e-9,
  u: 1e-6,
  'µ': 1e-6,
  m: 1e-3,
  k: 1e3,
  M: 1e6,
  G: 1e9
} as const;

type SIPrefix = keyof typeof SI_PREFIX_FACTORS;

const UNIT_TOKEN_ALIASES: Record<string, Unit> = {
  V: 'V',
  A: 'A',
  F: 'F',
  H: 'H',
  'Ω': 'Ω',
  ohm: 'Ω',
  OHM: 'Ω',
  ns: 'ns',
  NS: 'ns'
};

export type ParseValueWithUnitResult =
  | {
      value: number;
      unit?: Unit;
      prefix: SIPrefix;
      rawValue: number;
    }
  | {
      error: string;
    };

const parseUnitToken = (token: string): Unit | undefined => {
  if (UNIT_TOKEN_ALIASES[token]) {
    return UNIT_TOKEN_ALIASES[token];
  }

  if (UNIT_TOKEN_ALIASES[token.toUpperCase()]) {
    return UNIT_TOKEN_ALIASES[token.toUpperCase()];
  }

  return undefined;
};

export const parseValueWithUnit = (
  input: string,
  options?: { expectedUnit?: Unit; fallbackPrefix?: SIPrefix }
): ParseValueWithUnitResult => {
  const match = input.match(/^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*([a-zA-ZµΩ]*)\s*$/);
  if (!match) {
    return { error: 'Enter a valid numeric value.' };
  }

  const rawValue = Number(match[1]);
  if (Number.isNaN(rawValue)) {
    return { error: 'Enter a valid numeric value.' };
  }

  const suffixToken = match[2] ?? '';
  let parsedPrefix: SIPrefix = '';
  let parsedUnit: Unit | undefined;
  let hasInlinePrefix = false;

  if (suffixToken.length > 0) {
    const unitOnly = parseUnitToken(suffixToken);
    if (unitOnly) {
      parsedUnit = unitOnly;
    } else {
      const prefixToken = suffixToken[0] as SIPrefix;
      const unitToken = suffixToken.slice(1);
      if (prefixToken in SI_PREFIX_FACTORS) {
        if (unitToken.length === 0 && options?.expectedUnit) {
          parsedPrefix = prefixToken;
          parsedUnit = options.expectedUnit;
          hasInlinePrefix = true;
        } else {
          const withPrefixUnit = parseUnitToken(unitToken);
          if (withPrefixUnit) {
            parsedPrefix = prefixToken;
            parsedUnit = withPrefixUnit;
            hasInlinePrefix = true;
          } else {
            return { error: `Unsupported unit suffix "${suffixToken}".` };
          }
        }
      } else {
        return { error: `Unsupported unit suffix "${suffixToken}".` };
      }
    }
  }

  if (!hasInlinePrefix && options?.fallbackPrefix) {
    parsedPrefix = options.fallbackPrefix;
  }

  if (options?.expectedUnit) {
    if (parsedUnit && parsedUnit !== options.expectedUnit) {
      return { error: `Unit ${parsedUnit} is incompatible with expected ${options.expectedUnit}.` };
    }
    parsedUnit = options.expectedUnit;
  }

  return {
    value: rawValue * SI_PREFIX_FACTORS[parsedPrefix],
    rawValue,
    unit: parsedUnit,
    prefix: parsedPrefix
  };
};

