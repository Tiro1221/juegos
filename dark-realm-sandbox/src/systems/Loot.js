// ============================================================================
// Loot tables for chests found in villages, castles and dungeons.
// ============================================================================
function rollCount(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }

export function generateLoot(kind) {
  const items = [];
  const push = (id, min, max) => { const c = rollCount(min, max); if (c > 0) items.push({ id, count: c }); };

  if (kind === 'castle') {
    push('gold_ore', 1, 3);
    push('iron_ingot', 1, 2);
    push('sword_iron', 1, 1);
    push('cooked_meat', 1, 3);
    push('potion_heal', 1, 2);
  } else if (kind === 'dungeon') {
    push('mithril_ore', 1, 2);
    push('bone', 2, 5);
    push('potion_heal', 1, 3);
    push('arrow', 4, 12);
    push('gold_ingot', 0, 2);
  } else {
    // village chest
    push('bread', 1, 3);
    push('seeds', 2, 5);
    push('wood', 3, 8);
    push('apple', 1, 4);
    push('herb', 1, 3);
  }
  return items.filter(i => i.count > 0 && Math.random() < 0.85);
}
