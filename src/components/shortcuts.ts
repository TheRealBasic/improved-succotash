import { SORTED_COMPONENT_CATALOG_ITEMS } from '../data/componentCatalog';

export type ShortcutDefinition = {
  id: string;
  description: string;
  keys: string[];
};

const toPlacementShortcut = (item: (typeof SORTED_COMPONENT_CATALOG_ITEMS)[number]): ShortcutDefinition | null => {
  if (!item.metadata?.shortcut) {
    return null;
  }

  return {
    id: item.metadata.shortcut.id ?? `place-${item.id}`,
    description: `Place ${item.displayName.toLowerCase()}`,
    keys: [item.metadata.shortcut.key]
  };
};

export const PLACEMENT_SHORTCUTS: ShortcutDefinition[] = SORTED_COMPONENT_CATALOG_ITEMS.map(toPlacementShortcut).filter(
  (shortcut): shortcut is ShortcutDefinition => shortcut !== null
);

const validateShortcutConflicts = (placementShortcuts: ShortcutDefinition[]): void => {
  const byKey = new Map<string, string>();
  const duplicateKeys: string[] = [];

  for (const shortcut of placementShortcuts) {
    const normalizedKey = shortcut.keys[0]?.trim().toLowerCase();
    if (!normalizedKey) {
      continue;
    }

    const previous = byKey.get(normalizedKey);
    if (previous && previous !== shortcut.id) {
      duplicateKeys.push(`${shortcut.keys[0]} (${previous}, ${shortcut.id})`);
      continue;
    }

    byKey.set(normalizedKey, shortcut.id);
  }

  if (duplicateKeys.length > 0) {
    throw new Error(`Duplicate placement shortcut keys found: ${duplicateKeys.join('; ')}`);
  }
};

validateShortcutConflicts(PLACEMENT_SHORTCUTS);

export const SHORTCUTS: ShortcutDefinition[] = [
  ...PLACEMENT_SHORTCUTS,
  { id: 'connect', description: 'Start/complete wire from selected node', keys: ['W'] },
  { id: 'delete', description: 'Delete selected', keys: ['Delete', 'Backspace'] },
  { id: 'duplicate', description: 'Duplicate selected item', keys: ['D'] },
  { id: 'group', description: 'Group selected', keys: ['G'] },
  { id: 'ungroup', description: 'Ungroup selected', keys: ['Shift+G'] },
  { id: 'probe', description: 'Probe selected target (solve for X)', keys: ['X'] },
  { id: 'undo', description: 'Undo', keys: ['Ctrl/Cmd+Z'] },
  { id: 'redo', description: 'Redo', keys: ['Ctrl/Cmd+Shift+Z'] },
  { id: 'timeline-prev', description: 'Jump to previous timeline state', keys: ['['] },
  { id: 'timeline-next', description: 'Jump to next timeline state', keys: [']'] },
  { id: 'help', description: 'Toggle shortcut help', keys: ['?'] }
];

export const getShortcutById = (id: string): ShortcutDefinition | undefined => SHORTCUTS.find((shortcut) => shortcut.id === id);

export const shortcutLabel = (id: string): string => getShortcutById(id)?.keys.join(' / ') ?? '';

export const isTextInputLike = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tagName = element.tagName;
  return element.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
};
