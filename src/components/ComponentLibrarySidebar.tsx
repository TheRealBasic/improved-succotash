import { useEffect, useMemo, useState, type UIEvent } from 'react';
import { COMPONENT_CATALOG, type ComponentCatalogCategory, type ComponentCatalogEntry } from './componentCatalog';

type ComponentLibrarySidebarProps = {
  shortcutLabel: (shortcutId: string) => string;
};

const STORAGE_KEY = 'circuit-workbench-component-library-state-v1';

const normalize = (value: string): string => value.trim().toLowerCase();

const tokenizeQuery = (query: string): string[] => normalize(query).split(/\s+/).filter(Boolean);

const matchesQuery = (tokens: string[], searchTokens: string[]): boolean => {
  if (tokens.length === 0) {
    return true;
  }

  return tokens.every((token) => searchTokens.some((term) => term.includes(token)));
};

const getSubcategoryStorageKey = (categoryId: string, subcategoryId: string): string => `${categoryId}::${subcategoryId}`;

const filterComponentCatalog = (catalog: ComponentCatalogCategory[], queryTokens: string[]): ComponentCatalogCategory[] =>
  catalog.map((category) => ({
    ...category,
    subcategories: category.subcategories.map((subcategory) => ({
      ...subcategory,
      entries: subcategory.entries.filter((entry) => matchesQuery(queryTokens, entry.searchTokens))
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
    <span>{entry.label}</span>
    {entry.partNumber && <small>{entry.partNumber}</small>}
  </button>
);

export const ComponentLibrarySidebar = ({ shortcutLabel }: ComponentLibrarySidebarProps) => {
  const [query, setQuery] = useState('');
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

  const normalizedQuery = normalize(query);
  const queryTokens = useMemo(() => tokenizeQuery(query), [query]);

  const filteredCategories = useMemo(
    () => filterComponentCatalog(COMPONENT_CATALOG, queryTokens),
    [queryTokens]
  );

  useEffect(() => {
    if (!normalizedQuery) {
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
  }, [filteredCategories, normalizedQuery]);

  const totalMatches = useMemo(
    () =>
      filteredCategories.reduce(
        (sum, category) => sum + category.subcategories.reduce((subSum, subcategory) => subSum + subcategory.entries.length, 0),
        0
      ),
    [filteredCategories]
  );

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
                              queryTokens.length === 0 && subcategory.entries.length > VIRTUALIZATION_THRESHOLD ? (
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
