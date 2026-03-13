// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  CATALOG_SYMBOL_INVENTORY,
  assertCatalogSymbolBindings,
  renderComponentSymbol,
  validateCatalogSymbolBindings
} from '../symbolRendering';
import type { CatalogPlacementKind } from '../../data/componentCatalog';

const fromNode = { x: 20, y: 20 };
const toNode = { x: 80, y: 20 };

const renderSymbolMarkup = (catalogTypeId: CatalogPlacementKind): string => {
  const symbol = renderComponentSymbol({ catalogTypeId }, fromNode, toNode);
  if (!symbol) {
    return '';
  }

  return renderToStaticMarkup(<svg>{symbol}</svg>).replace(/^<svg>|<\/svg>$/g, '');
};

describe('component symbol catalog validation', () => {
  it('has a renderer and compatible pin count for every catalog item', () => {
    expect(validateCatalogSymbolBindings()).toEqual([]);
    expect(() => assertCatalogSymbolBindings()).not.toThrow();
  });

  it('tracks an inventory of rendered symbols and pin metadata', () => {
    expect(CATALOG_SYMBOL_INVENTORY).toMatchSnapshot();
  });
});

describe('component symbol snapshots', () => {
  it('matches representative symbol snapshots for each renderer category', () => {
    const snapshots = {
      passive: renderSymbolMarkup('resistor'),
      source: renderSymbolMarkup('voltage-source'),
      semiconductorDiode: renderSymbolMarkup('diode'),
      semiconductorTransistor: renderSymbolMarkup('bjt'),
      opAmp: renderSymbolMarkup('op-amp'),
      logic: renderSymbolMarkup('logic-gate'),
      subcircuit: renderSymbolMarkup('subcircuit')
    };

    expect(snapshots).toMatchSnapshot();
  });
});
