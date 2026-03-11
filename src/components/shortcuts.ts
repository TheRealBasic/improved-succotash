export type ShortcutDefinition = {
  id: string;
  description: string;
  keys: string[];
};

export const SHORTCUTS: ShortcutDefinition[] = [
  { id: 'place-resistor', description: 'Place resistor', keys: ['R'] },
  { id: 'place-capacitor', description: 'Place capacitor', keys: ['C'] },
  { id: 'place-inductor', description: 'Place inductor', keys: ['L'] },
  { id: 'place-voltage', description: 'Place voltage source', keys: ['V'] },
  { id: 'place-current', description: 'Place current source', keys: ['I'] },
  { id: 'place-diode', description: 'Place diode', keys: ['O'] },
  { id: 'place-bjt', description: 'Place BJT', keys: ['B'] },
  { id: 'place-mosfet', description: 'Place MOSFET', keys: ['M'] },
  { id: 'place-opamp', description: 'Place op-amp', keys: ['P'] },
  { id: 'place-logic', description: 'Place logic gate', keys: ['T'] },
  { id: 'place-subcircuit', description: 'Place subcircuit', keys: ['S'] },
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
