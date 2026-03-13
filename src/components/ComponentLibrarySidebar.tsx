import { useEffect, useMemo, useState, type UIEvent } from 'react';
import { COMPONENT_CATALOG, type ComponentCatalogCategory, type ComponentCatalogEntry } from './componentCatalog';

type ComponentLibrarySidebarProps = {
  shortcutLabel: (shortcutId: string) => string;
};

type ComponentLibraryFilters = {
  categories: string[];
  subcategories: string[];
  tags: string[];
  pinCounts: number[];
  manufacturers: string[];
  fullySimulatedOnly: boolean;
  newComponentsOnly: boolean;
};

type PersistedSidebarSessionState = {
  query: string;
  filters: ComponentLibraryFilters;
};


const supportLabel: Record<ComponentCatalogEntry['supportLevel'], string> = {
  full: 'Full',
  partial: 'Partial',
  'visual-only': 'Visual only'
};

const STORAGE_KEY = 'circuit-workbench-component-library-state-v1';
const SESSION_STORAGE_KEY = 'circuit-workbench-component-library-session-v1';

const defaultFilters = (): ComponentLibraryFilters => ({
  categories: [],
  subcategories: [],
  tags: [],
  pinCounts: [],
  manufacturers: [],
  fullySimulatedOnly: false,
  newComponentsOnly: false
});

const normalize = (value: string): string => value.trim().toLowerCase();

const tokenizeQuery = (query: string): string[] => normalize(query).split(/\s+/).filter(Boolean);

const matchesQuery = (tokens: string[], searchTokens: string[]): boolean => {
  if (tokens.length === 0) {
    return true;
  }

  return tokens.every((token) => searchTokens.some((term) => term.includes(token)));
};

const getSubcategoryStorageKey = (categoryId: string, subcategoryId: string): string => `${categoryId}::${subcategoryId}`;

const filterComponentCatalog = (
  catalog: ComponentCatalogCategory[],
  queryTokens: string[],
  filters: ComponentLibraryFilters
): ComponentCatalogCategory[] =>
  catalog.map((category) => ({
    ...category,
    subcategories: category.subcategories.map((subcategory) => ({
      ...subcategory,
      entries: subcategory.entries.filter((entry) => {
        if (!matchesQuery(queryTokens, entry.searchTokens)) {
          return false;
        }

        if (filters.categories.length > 0 && !filters.categories.includes(entry.categoryId)) {
          return false;
        }

        if (filters.subcategories.length > 0 && !filters.subcategories.includes(entry.subcategoryId)) {
          return false;
        }

        if (filters.tags.length > 0 && !filters.tags.some((tag) => entry.tags.includes(tag))) {
          return false;
        }

        if (filters.pinCounts.length > 0 && !filters.pinCounts.includes(entry.pinCount)) {
          return false;
        }

        if (filters.manufacturers.length > 0 && !filters.manufacturers.includes(entry.manufacturer ?? 'Unknown')) {
          return false;
        }

        if (filters.fullySimulatedOnly && !entry.fullySimulated) {
          return false;
        }

        if (filters.newComponentsOnly && !entry.isNew) {
          return false;
        }

        return true;
      })
    }))
  }));

const VIRTUALIZATION_THRESHOLD = 120;
const VIRTUALIZED_ROW_HEIGHT = 44;
const VIRTUALIZED_VIEWPORT_HEIGHT = 320;
const VIRTUALIZED_OVERSCAN = 10;

const EntryButton = ({ entry, shortcutLabel }: { entry: ComponentCatalogEntry; shortcutLabel: (shortcutId: string) => string }) => (
  <button
    key={entry.id}
    type="button"
    className="palette-item"
    draggable
    onDragStart={(event) => event.dataTransfer.setData('application/x-component-kind', entry.kind)}
    title={entry.shortcutId ? `Shortcut: ${shortcutLabel(entry.shortcutId)}` : undefined}
  >
    <span className="palette-item-main">{entry.label}</span>
    <span className={`support-badge support-${entry.supportLevel}`} title={entry.supportNotes ?? `Solver support: ${supportLabel[entry.supportLevel]}`}>
      {supportLabel[entry.supportLevel]}
    </span>
    {entry.partNumber && <small>{entry.partNumber}</small>}
  </button>
);

export const ComponentLibrarySidebar = ({ shortcutLabel }: ComponentLibrarySidebarProps) => {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<ComponentLibraryFilters>(defaultFilters);
  const [virtualOffsetsBySubcategory, setVirtualOffsetsBySubcategory] = useState<Record<string, number>>({});
  const [expandedBySection, setExpandedBySection] = useState<Record<string, boolean>>(() => {
    const initial = Object.fromEntries(COMPONENT_CATALOG.map((category) => [category.id, true]));
    for (const category of COMPONENT_CATALOG) {
      for (const subcategory of category.subcategories) {
        initial[getSubcategoryStorageKey(category.id, subcategory.id)] = true;
      }
    }
    return initial;
  });

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setExpandedBySection((current) => ({ ...current, ...parsed }));
    } catch {
      // ignore malformed localStorage payload
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedBySection));
  }, [expandedBySection]);

  useEffect(() => {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<PersistedSidebarSessionState>;
      setQuery(parsed.query ?? '');
      setFilters((current) => ({ ...current, ...parsed.filters }));
    } catch {
      // ignore malformed sessionStorage payload
    }
  }, []);

  useEffect(() => {
    const payload: PersistedSidebarSessionState = { query, filters };
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
  }, [filters, query]);

  const normalizedQuery = normalize(query);
  const queryTokens = useMemo(() => tokenizeQuery(query), [query]);

  const filterOptions = useMemo(() => {
    const entries = COMPONENT_CATALOG.flatMap((category) => category.subcategories.flatMap((subcategory) => subcategory.entries));
    return {
      categories: COMPONENT_CATALOG.map((category) => ({ id: category.id, label: category.label })),
      subcategories: COMPONENT_CATALOG.flatMap((category) =>
        category.subcategories.map((subcategory) => ({ id: subcategory.id, label: subcategory.label }))
      ),
      tags: Array.from(new Set(entries.flatMap((entry) => entry.tags))).sort((left, right) => left.localeCompare(right)),
      pinCounts: Array.from(new Set(entries.map((entry) => entry.pinCount))).sort((left, right) => left - right),
      manufacturers: Array.from(new Set(entries.map((entry) => entry.manufacturer ?? 'Unknown'))).sort((left, right) =>
        left.localeCompare(right)
      )
    };
  }, []);

  const filteredCategories = useMemo(() => filterComponentCatalog(COMPONENT_CATALOG, queryTokens, filters), [filters, queryTokens]);

  useEffect(() => {
    const hasActiveSearch =
      normalizedQuery.length > 0 ||
      filters.categories.length > 0 ||
      filters.subcategories.length > 0 ||
      filters.tags.length > 0 ||
      filters.pinCounts.length > 0 ||
      filters.manufacturers.length > 0 ||
      filters.fullySimulatedOnly ||
      filters.newComponentsOnly;

    if (!hasActiveSearch) {
      return;
    }

    setExpandedBySection((current) => {
      const next = { ...current };
      for (const category of filteredCategories) {
        const hasMatch = category.subcategories.some((subcategory) => subcategory.entries.length > 0);
        if (hasMatch) {
          next[category.id] = true;
        }
        for (const subcategory of category.subcategories) {
          if (subcategory.entries.length > 0) {
            next[getSubcategoryStorageKey(category.id, subcategory.id)] = true;
          }
        }
      }
      return next;
    });
  }, [filteredCategories, filters, normalizedQuery]);

  const totalMatches = useMemo(
    () =>
      filteredCategories.reduce(
        (sum, category) => sum + category.subcategories.reduce((subSum, subcategory) => subSum + subcategory.entries.length, 0),
        0
      ),
    [filteredCategories]
  );

  const hasActiveFilters =
    filters.categories.length > 0 ||
    filters.subcategories.length > 0 ||
    filters.tags.length > 0 ||
    filters.pinCounts.length > 0 ||
    filters.manufacturers.length > 0 ||
    filters.fullySimulatedOnly ||
    filters.newComponentsOnly;

  const canUseVirtualization = queryTokens.length === 0 && !hasActiveFilters;

  return (
    <div className="sidebar-section component-library">
      <h2>Component Library</h2>
      <label className="library-search">
        <span>Search</span>
        <input
          type="search"
          placeholder="Name, alias, tag, part #"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

      <section className="library-filters" aria-label="Component filters">
        <div className="library-filter-grid">
          <label>
            Category
            <select
              aria-label="Category filter"
              multiple
              value={filters.categories}
              onChange={(event) => {
                const selected = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                setFilters((current) => ({ ...current, categories: selected }));
              }}
            >
              {filterOptions.categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Subcategory
            <select
              aria-label="Subcategory filter"
              multiple
              value={filters.subcategories}
              onChange={(event) => {
                const selected = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                setFilters((current) => ({ ...current, subcategories: selected }));
              }}
            >
              {filterOptions.subcategories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Tags
            <select
              aria-label="Tags filter"
              multiple
              value={filters.tags}
              onChange={(event) => {
                const selected = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                setFilters((current) => ({ ...current, tags: selected }));
              }}
            >
              {filterOptions.tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>

          <label>
            Pin count
            <select
              aria-label="Pin count filter"
              multiple
              value={filters.pinCounts.map(String)}
              onChange={(event) => {
                const selected = Array.from(event.currentTarget.selectedOptions).map((option) => Number(option.value));
                setFilters((current) => ({ ...current, pinCounts: selected }));
              }}
            >
              {filterOptions.pinCounts.map((pinCount) => (
                <option key={pinCount} value={pinCount}>
                  {pinCount}
                </option>
              ))}
            </select>
          </label>

          <label>
            Manufacturer
            <select
              aria-label="Manufacturer filter"
              multiple
              value={filters.manufacturers}
              onChange={(event) => {
                const selected = Array.from(event.currentTarget.selectedOptions).map((option) => option.value);
                setFilters((current) => ({ ...current, manufacturers: selected }));
              }}
            >
              {filterOptions.manufacturers.map((manufacturer) => (
                <option key={manufacturer} value={manufacturer}>
                  {manufacturer}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="library-filter-toggles">
          <label>
            <input
              type="checkbox"
              checked={filters.fullySimulatedOnly}
              onChange={() =>
                setFilters((current) => ({
                  ...current,
                  fullySimulatedOnly: !current.fullySimulatedOnly
                }))
              }
            />
            Fully simulated only
          </label>
          <label>
            <input
              type="checkbox"
              checked={filters.newComponentsOnly}
              onChange={() =>
                setFilters((current) => ({
                  ...current,
                  newComponentsOnly: !current.newComponentsOnly
                }))
              }
            />
            New components
          </label>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setFilters(defaultFilters());
            }}
          >
            Clear filters
          </button>
        </div>
      </section>

      <p className="hint">{totalMatches} matching component{totalMatches === 1 ? '' : 's'}</p>

      <div className="library-categories">
        {filteredCategories.map((category) => {
          const categoryExpanded = expandedBySection[category.id] ?? true;
          const categoryMatchCount = category.subcategories.reduce((sum, subcategory) => sum + subcategory.entries.length, 0);
          return (
            <section key={category.id} className="library-category">
              <button
                type="button"
                className="library-accordion-trigger"
                onClick={() => setExpandedBySection((current) => ({ ...current, [category.id]: !categoryExpanded }))}
                aria-expanded={categoryExpanded}
                aria-controls={`library-category-${category.id}`}
              >
                <span>{category.label}</span>
                <span>{categoryMatchCount}</span>
              </button>

              {categoryExpanded && (
                <div id={`library-category-${category.id}`} className="library-subcategories">
                  {category.subcategories.map((subcategory) => {
                    const subcategoryKey = getSubcategoryStorageKey(category.id, subcategory.id);
                    const subcategoryExpanded = expandedBySection[subcategoryKey] ?? true;
                    return (
                      <section key={subcategory.id} className="library-subcategory">
                        <button
                          type="button"
                          className="library-subcategory-trigger"
                          onClick={() =>
                            setExpandedBySection((current) => ({
                              ...current,
                              [subcategoryKey]: !subcategoryExpanded
                            }))
                          }
                          aria-expanded={subcategoryExpanded}
                          aria-controls={`library-subcategory-${subcategory.id}`}
                        >
                          <span>{subcategory.label}</span>
                          <span>{subcategory.entries.length}</span>
                        </button>

                        {subcategoryExpanded && (
                          <div id={`library-subcategory-${subcategory.id}`} className="inventory-grid">
                            {subcategory.entries.length > 0 ? (
                              canUseVirtualization && subcategory.entries.length > VIRTUALIZATION_THRESHOLD ? (
                                <VirtualizedEntryGrid
                                  subcategoryId={subcategory.id}
                                  entries={subcategory.entries}
                                  shortcutLabel={shortcutLabel}
                                  offset={virtualOffsetsBySubcategory[subcategory.id] ?? 0}
                                  onOffsetChange={(offset) =>
                                    setVirtualOffsetsBySubcategory((current) => ({
                                      ...current,
                                      [subcategory.id]: offset
                                    }))
                                  }
                                />
                              ) : (
                                subcategory.entries.map((entry) => (
                                  <EntryButton key={entry.id} entry={entry} shortcutLabel={shortcutLabel} />
                                ))
                              )
                            ) : (
                              <p className="hint">No components in this subcategory yet.</p>
                            )}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

const VirtualizedEntryGrid = ({
  subcategoryId,
  entries,
  shortcutLabel,
  offset,
  onOffsetChange
}: {
  subcategoryId: string;
  entries: ComponentCatalogEntry[];
  shortcutLabel: (shortcutId: string) => string;
  offset: number;
  onOffsetChange: (offset: number) => void;
}) => {
  const totalHeight = entries.length * VIRTUALIZED_ROW_HEIGHT;
  const start = Math.max(Math.floor(offset / VIRTUALIZED_ROW_HEIGHT) - VIRTUALIZED_OVERSCAN, 0);
  const visibleCount = Math.ceil(VIRTUALIZED_VIEWPORT_HEIGHT / VIRTUALIZED_ROW_HEIGHT) + VIRTUALIZED_OVERSCAN * 2;
  const end = Math.min(entries.length, start + visibleCount);
  const visibleEntries = entries.slice(start, end);

  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    onOffsetChange(event.currentTarget.scrollTop);
  };

  return (
    <div
      className="inventory-grid-virtualized"
      onScroll={onScroll}
      style={{ maxHeight: `${VIRTUALIZED_VIEWPORT_HEIGHT}px` }}
      data-subcategory-id={subcategoryId}
    >
      <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
        <div style={{ transform: `translateY(${start * VIRTUALIZED_ROW_HEIGHT}px)` }}>
          {visibleEntries.map((entry) => (
            <EntryButton key={entry.id} entry={entry} shortcutLabel={shortcutLabel} />
          ))}
        </div>
      </div>
    </div>
  );
};

export const __componentLibraryPerf = {
  filterComponentCatalog,
  tokenizeQuery
};
