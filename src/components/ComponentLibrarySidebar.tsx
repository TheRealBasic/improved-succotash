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

export const ComponentLibrarySidebar = ({ shortcutLabel }: ComponentLibrarySidebarProps) => {
  const [query, setQuery] = useState('');
  const [expandedByCategory, setExpandedByCategory] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COMPONENT_CATALOG.map((category) => [category.id, true]))
  );

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setExpandedByCategory((current) => ({ ...current, ...parsed }));
    } catch {
      // ignore malformed localStorage payload
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(expandedByCategory));
  }, [expandedByCategory]);

  const normalizedQuery = normalize(query);

  const filteredCategories = useMemo(
    () =>
      COMPONENT_CATALOG.map((category) => {
        const entries = category.entries.filter((entry) =>
          matchesQuery(normalizedQuery, [entry.label, ...entry.aliases, ...entry.tags, entry.partNumber ?? ''].map(normalize))
        );
        return { ...category, entries };
      }),
    [normalizedQuery]
  );

  const totalMatches = filteredCategories.reduce((sum, category) => sum + category.entries.length, 0);

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
          const expanded = expandedByCategory[category.id] ?? true;
          return (
            <section key={category.id} className="library-category">
              <button
                type="button"
                className="library-accordion-trigger"
                onClick={() => setExpandedByCategory((current) => ({ ...current, [category.id]: !expanded }))}
                aria-expanded={expanded}
                aria-controls={`library-category-${category.id}`}
              >
                <span>{category.label}</span>
                <span>{category.entries.length}</span>
              </button>

              {expanded && (
                <div id={`library-category-${category.id}`} className="inventory-grid">
                  {category.entries.length > 0 ? (
                    category.entries.map((entry) => (
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
                    <p className="hint">No components in this category yet.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};
