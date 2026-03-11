import { useEffect, useMemo, useState } from 'react';
import { COMPONENT_CATALOG } from './componentCatalog';

type ComponentLibrarySidebarProps = {
  shortcutLabel: (shortcutId: string) => string;
};

const STORAGE_KEY = 'circuit-workbench-component-library-state-v1';

const normalize = (value: string): string => value.trim().toLowerCase();

const matchesQuery = (query: string, terms: string[]): boolean => {
  if (!query) {
    return true;
  }

  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => terms.some((term) => term.includes(token)));
};

const getSubcategoryStorageKey = (categoryId: string, subcategoryId: string): string => `${categoryId}::${subcategoryId}`;

export const ComponentLibrarySidebar = ({ shortcutLabel }: ComponentLibrarySidebarProps) => {
  const [query, setQuery] = useState('');
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

  const filteredCategories = useMemo(
    () =>
      COMPONENT_CATALOG.map((category) => ({
        ...category,
        subcategories: category.subcategories.map((subcategory) => ({
          ...subcategory,
          entries: subcategory.entries.filter((entry) =>
            matchesQuery(normalizedQuery, [entry.label, ...entry.aliases, ...entry.tags, entry.partNumber ?? ''].map(normalize))
          )
        }))
      })),
    [normalizedQuery]
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

  const totalMatches = filteredCategories.reduce(
    (sum, category) => sum + category.subcategories.reduce((subSum, subcategory) => subSum + subcategory.entries.length, 0),
    0
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
                              subcategory.entries.map((entry) => (
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
                              ))
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
