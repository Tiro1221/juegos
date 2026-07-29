// ============================================================================
// Inventory: hotbar (9 slots) + backpack (27 slots) + armor slots.
// Simple stack-based system with add/remove/hasItems helpers used by
// crafting, mining drops, farming and combat/loot.
// ============================================================================
import { getItem } from './Items.js';

export const HOTBAR_SIZE = 9;
export const BACKPACK_SIZE = 27;

export class Inventory {
  constructor() {
    this.slots = new Array(HOTBAR_SIZE + BACKPACK_SIZE).fill(null); // {id, count}
    this.armor = { chest: null };
    this.selectedHotbar = 0;
    this.listeners = [];
  }

  onChange(cb) { this.listeners.push(cb); }
  _notify() { for (const cb of this.listeners) cb(); }

  get selectedItem() { return this.slots[this.selectedHotbar]; }

  addItem(id, count = 1) {
    const def = getItem(id);
    const maxStack = def?.stack || 64;
    let remaining = count;
    // fill existing stacks first
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < maxStack) {
        const add = Math.min(maxStack - s.count, remaining);
        s.count += add; remaining -= add;
      }
    }
    // then empty slots
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      if (!this.slots[i]) {
        const add = Math.min(maxStack, remaining);
        this.slots[i] = { id, count: add };
        remaining -= add;
      }
    }
    this._notify();
    return remaining === 0; // true if fully added
  }

  countItem(id) {
    return this.slots.reduce((sum, s) => sum + (s && s.id === id ? s.count : 0), 0);
  }

  hasItems(reqs) {
    return Object.entries(reqs).every(([id, qty]) => this.countItem(id) >= qty);
  }

  removeItem(id, count = 1) {
    let remaining = count;
    for (let i = 0; i < this.slots.length && remaining > 0; i++) {
      const s = this.slots[i];
      if (s && s.id === id) {
        const take = Math.min(s.count, remaining);
        s.count -= take; remaining -= take;
        if (s.count <= 0) this.slots[i] = null;
      }
    }
    this._notify();
    return remaining === 0;
  }

  consumeRecipe(reqs) {
    if (!this.hasItems(reqs)) return false;
    for (const [id, qty] of Object.entries(reqs)) this.removeItem(id, qty);
    return true;
  }

  removeFromSlot(index, count = 1) {
    const s = this.slots[index];
    if (!s) return null;
    const take = Math.min(s.count, count);
    s.count -= take;
    const removed = { id: s.id, count: take };
    if (s.count <= 0) this.slots[index] = null;
    this._notify();
    return removed;
  }

  swapSlots(a, b) {
    const tmp = this.slots[a];
    this.slots[a] = this.slots[b];
    this.slots[b] = tmp;
    this._notify();
  }

  equipArmor(slotType, itemId) {
    this.armor[slotType] = itemId;
    this._notify();
  }

  getArmorTotal() {
    let total = 0;
    for (const id of Object.values(this.armor)) {
      if (id) total += getItem(id)?.armor || 0;
    }
    return total;
  }

  damageSelected(amount = 1) {
    const s = this.selectedItem;
    if (!s) return;
    const def = getItem(s.id);
    if (!def?.durability) return;
    s.durability = (s.durability ?? def.durability) - amount;
    if (s.durability <= 0) {
      this.slots[this.selectedHotbar] = null;
    }
    this._notify();
  }
}
