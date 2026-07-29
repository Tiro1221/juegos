// ============================================================================
// MenuManager: wires up all overlay screens (main menu, pause, inventory,
// crafting, chest, map/factions, death) and their button interactions.
// Handles pointer-lock friendly show/hide + pause state coordination.
// ============================================================================
import { getItem } from '../systems/Items.js';
import { recipesFor } from '../systems/Recipes.js';
import { Factions } from '../systems/Factions.js';

export class MenuManager {
  constructor({ inventory, onResume, onPause, onCraft, onQuit, onRespawn, audio, factionSystem }) {
    this.inventory = inventory;
    this.audio = audio;
    this.factionSystem = factionSystem;
    this.onCraft = onCraft;
    this.onQuit = onQuit;
    this.onRespawn = onRespawn;
    this.onPause = onPause;
    this.onResume = onResume;
    this.currentStation = 'carpentry';
    this.activeChest = null;

    this._bindMainMenu();
    this._bindHowTo();
    this._bindPause();
    this._bindInventory();
    this._bindCrafting();
    this._bindChest();
    this._bindMap();
    this._bindDeath();

    this.isAnyPanelOpen = () => {
      return !document.getElementById('inventory-screen').classList.contains('hidden') ||
        !document.getElementById('crafting-screen').classList.contains('hidden') ||
        !document.getElementById('chest-screen').classList.contains('hidden') ||
        !document.getElementById('map-screen').classList.contains('hidden') ||
        !document.getElementById('pause-screen').classList.contains('hidden');
    };
  }

  showMainMenu() {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
  }
  hideMainMenu() { document.getElementById('main-menu').classList.add('hidden'); }

  _bindMainMenu() {
    document.getElementById('btn-new-world').addEventListener('click', () => {
      this.hideMainMenu();
      this.onResume?.('new');
    });
    document.getElementById('btn-continue').addEventListener('click', () => {
      this.hideMainMenu();
      this.onResume?.('continue');
    });
    document.getElementById('btn-how-to-play').addEventListener('click', () => {
      document.getElementById('howto-screen').classList.remove('hidden');
    });
  }

  _bindHowTo() {
    document.getElementById('btn-close-howto').addEventListener('click', () => {
      document.getElementById('howto-screen').classList.add('hidden');
    });
  }

  _bindPause() {
    document.getElementById('btn-resume').addEventListener('click', () => this.closePause());
    document.getElementById('btn-quit-menu').addEventListener('click', () => {
      this.closePause();
      document.getElementById('hud').classList.add('hidden');
      this.onQuit?.();
      this.showMainMenu();
    });
    document.getElementById('vol-music').addEventListener('input', (e) => this.audio?.setMusicVolume(parseFloat(e.target.value)));
    document.getElementById('vol-ambient').addEventListener('input', (e) => { if (this.audio?.ambientGain) this.audio.ambientGain.gain.value = parseFloat(e.target.value); });
    document.getElementById('vol-sfx').addEventListener('input', (e) => { if (this.audio?.sfxGain) this.audio.sfxGain.gain.value = parseFloat(e.target.value); });
  }

  openPause() {
    document.getElementById('pause-screen').classList.remove('hidden');
    this.onPause?.(true);
  }
  closePause() {
    document.getElementById('pause-screen').classList.add('hidden');
    this.onPause?.(false);
  }
  togglePause() {
    const el = document.getElementById('pause-screen');
    if (el.classList.contains('hidden')) this.openPause(); else this.closePause();
  }

  _bindInventory() {
    document.getElementById('btn-close-inventory').addEventListener('click', () => this.closeInventory());
    document.getElementById('btn-inventory-mobile')?.addEventListener('touchstart', (e) => { e.preventDefault(); this.toggleInventory(); });
  }

  toggleInventory() {
    const el = document.getElementById('inventory-screen');
    if (el.classList.contains('hidden')) this.openInventory(); else this.closeInventory();
  }

  openInventory() {
    this.renderInventoryGrid();
    document.getElementById('inventory-screen').classList.remove('hidden');
    this.onPause?.(true);
  }
  closeInventory() {
    document.getElementById('inventory-screen').classList.add('hidden');
    this.onPause?.(false);
  }

  renderInventoryGrid() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';
    this.inventory.slots.forEach((item, i) => {
      const div = document.createElement('div');
      div.className = 'item-slot';
      if (item) {
        const def = getItem(item.id);
        div.innerHTML = `<span>${def?.icon || '❔'}</span>` + (item.count > 1 ? `<span class="count">${item.count}</span>` : '');
        div.title = def?.name || item.id;
        if (def?.type === 'armor') {
          div.addEventListener('click', () => {
            this.inventory.equipArmor(def.slot, item.id);
            this.renderInventoryGrid();
          });
        }
      }
      grid.appendChild(div);
    });
    const armorSlot = document.getElementById('armor-slot');
    const armorId = this.inventory.armor.chest;
    armorSlot.innerHTML = armorId ? `<span>${getItem(armorId)?.icon}</span>` : '';
  }

  _bindCrafting() {
    document.getElementById('btn-close-crafting').addEventListener('click', () => this.closeCrafting());
  }

  openCrafting(station) {
    this.currentStation = station;
    const titles = { hand: 'Manualidades', carpentry: 'Banco de Carpintero', forge: 'Forja Ancestral', alchemy: 'Caldero Alquímico' };
    document.getElementById('crafting-title').textContent = titles[station] || 'Crafting';
    this.renderRecipes(station);
    document.getElementById('crafting-screen').classList.remove('hidden');
    this.onPause?.(true);
  }
  closeCrafting() {
    document.getElementById('crafting-screen').classList.add('hidden');
    this.onPause?.(false);
  }

  renderRecipes(station) {
    const list = document.getElementById('recipe-list');
    list.innerHTML = '';
    const recipes = recipesFor(station === 'carpentry' ? 'carpentry' : station);
    const allRecipes = station === 'carpentry' ? [...recipesFor('hand'), ...recipesFor('carpentry')] : recipesFor(station);
    for (const recipe of allRecipes) {
      const can = this.inventory.hasItems(recipe.inputs);
      const div = document.createElement('div');
      div.className = 'recipe-card' + (can ? '' : ' disabled');
      const costText = Object.entries(recipe.inputs).map(([id, qty]) => `${getItem(id)?.icon || ''}${qty}`).join(' ');
      div.innerHTML = `<div class="recipe-icon">${recipe.icon}</div><div class="recipe-info"><div class="recipe-name">${recipe.name}</div><div class="recipe-cost">${costText}</div></div>`;
      div.addEventListener('click', () => {
        if (!this.inventory.hasItems(recipe.inputs)) return;
        this.onCraft?.(recipe);
        this.renderRecipes(station);
      });
      list.appendChild(div);
    }
  }

  _bindChest() {
    document.getElementById('btn-close-chest').addEventListener('click', () => {
      document.getElementById('chest-screen').classList.add('hidden');
      this.onPause?.(false);
    });
  }

  openChest(chestData) {
    this.activeChest = chestData;
    this.renderChest();
    document.getElementById('chest-screen').classList.remove('hidden');
    this.onPause?.(true);
  }

  renderChest() {
    const grid = document.getElementById('chest-grid');
    grid.innerHTML = '';
    for (const item of this.activeChest.items) {
      const def = getItem(item.id);
      const div = document.createElement('div');
      div.className = 'item-slot';
      div.innerHTML = `<span>${def?.icon}</span><span class="count">${item.count}</span>`;
      div.title = 'Click para recoger';
      div.addEventListener('click', () => {
        this.inventory.addItem(item.id, item.count);
        this.activeChest.items = this.activeChest.items.filter(i => i !== item);
        this.renderChest();
      });
      grid.appendChild(div);
    }
    if (this.activeChest.items.length === 0) grid.innerHTML = '<p style="grid-column: span 9; text-align:center;">El cofre está vacío.</p>';
  }

  _bindMap() {
    document.getElementById('btn-close-map').addEventListener('click', () => {
      document.getElementById('map-screen').classList.add('hidden');
      this.onPause?.(false);
    });
  }

  openMap() {
    this.renderFactions();
    document.getElementById('map-screen').classList.remove('hidden');
    this.onPause?.(true);
  }
  toggleMap() {
    const el = document.getElementById('map-screen');
    if (el.classList.contains('hidden')) this.openMap();
    else { el.classList.add('hidden'); this.onPause?.(false); }
  }

  renderFactions() {
    const list = document.getElementById('faction-list');
    list.innerHTML = '';
    for (const [id, faction] of Object.entries(Factions)) {
      const rep = this.factionSystem.get(id);
      const standing = this.factionSystem.standingLabel(id);
      const pct = ((rep + 100) / 200) * 100;
      const color = rep >= 20 ? '#3a8f4a' : rep <= -20 ? '#a5302f' : '#c9a23a';
      const div = document.createElement('div');
      div.className = 'faction-card';
      div.innerHTML = `
        <div class="faction-name">${faction.name}</div>
        <div class="faction-standing">${standing} (${rep})</div>
        <div class="faction-rep-bar"><div class="faction-rep-fill" style="width:${pct}%; background:${color}"></div></div>
        <p style="margin:6px 0 0; font-size:13px;">${faction.description}</p>
      `;
      list.appendChild(div);
    }
  }

  _bindDeath() {
    document.getElementById('btn-respawn').addEventListener('click', () => {
      document.getElementById('death-screen').classList.add('hidden');
      this.onRespawn?.();
    });
  }

  showDeath() {
    document.getElementById('death-screen').classList.remove('hidden');
  }

  anyModalOpen() {
    return this.isAnyPanelOpen() ||
      !document.getElementById('death-screen').classList.contains('hidden') ||
      !document.getElementById('howto-screen').classList.contains('hidden') ||
      !document.getElementById('main-menu').classList.contains('hidden');
  }
}
