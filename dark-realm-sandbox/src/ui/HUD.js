// ============================================================================
// HUD controller: syncs DOM elements (health/stamina/hunger/warmth bars,
// clock, biome/weather badges, hotbar, toasts, mining progress, vignette)
// with live game state each frame — kept framework-free for simplicity.
// ============================================================================
import { getItem } from '../systems/Items.js';

export class HUD {
  constructor() {
    this.el = {
      health: document.getElementById('bar-health'),
      stamina: document.getElementById('bar-stamina'),
      hunger: document.getElementById('bar-hunger'),
      warmth: document.getElementById('bar-warmth'),
      clockIcon: document.getElementById('clock-icon'),
      clockText: document.getElementById('clock-text'),
      season: document.getElementById('season-badge'),
      biome: document.getElementById('biome-badge'),
      weather: document.getElementById('weather-badge'),
      hotbar: document.getElementById('hotbar'),
      miningWrap: document.getElementById('mining-progress-wrap'),
      miningFill: document.getElementById('mining-progress-fill'),
      interactHint: document.getElementById('interact-hint'),
      mountHint: document.getElementById('mount-hint'),
      vignette: document.getElementById('damage-vignette'),
      waterOverlay: document.getElementById('water-overlay'),
      toastContainer: document.getElementById('toast-container'),
    };
    this._buildHotbar();
  }

  _buildHotbar() {
    this.el.hotbar.innerHTML = '';
    this.slots = [];
    for (let i = 0; i < 9; i++) {
      const div = document.createElement('div');
      div.className = 'hotbar-slot';
      div.dataset.index = i;
      this.el.hotbar.appendChild(div);
      this.slots.push(div);
    }
  }

  updateStats(player) {
    this.el.health.style.width = `${Math.max(0, player.health)}%`;
    this.el.stamina.style.width = `${Math.max(0, player.stamina)}%`;
    this.el.hunger.style.width = `${Math.max(0, player.hunger)}%`;
    this.el.warmth.style.width = `${Math.max(0, player.warmth)}%`;
    this.el.vignette.classList.toggle('active', player.health < 30);
    this.el.waterOverlay.classList.toggle('hidden', !player.inWater);
  }

  updateClock(timeOfDay, isNight) {
    const totalMinutes = Math.floor(timeOfDay * 24 * 60);
    const hh = Math.floor(totalMinutes / 60).toString().padStart(2, '0');
    const mm = (totalMinutes % 60).toString().padStart(2, '0');
    this.el.clockText.textContent = `${hh}:${mm}`;
    this.el.clockIcon.textContent = isNight ? '🌙' : '☀';
  }

  updateSeason(label, icon) { this.el.season.textContent = `${icon} ${label}`; }
  updateBiome(name) { this.el.biome.textContent = name; }
  updateWeather(weather) {
    const map = { clear: null, rain: '🌧 Lluvia', storm: '⛈ Tormenta', snow: '❄ Nevada', fog: '🌫 Niebla' };
    const txt = map[weather];
    if (!txt) { this.el.weather.classList.add('hidden'); return; }
    this.el.weather.textContent = txt;
    this.el.weather.classList.remove('hidden');
  }

  updateHotbar(inventory) {
    for (let i = 0; i < 9; i++) {
      const slotEl = this.slots[i];
      const item = inventory.slots[i];
      slotEl.classList.toggle('selected', i === inventory.selectedHotbar);
      slotEl.innerHTML = '';
      if (item) {
        const def = getItem(item.id);
        slotEl.innerHTML = `<span>${def?.icon || '❔'}</span>`;
        if (item.count > 1) {
          const c = document.createElement('span');
          c.className = 'count'; c.textContent = item.count;
          slotEl.appendChild(c);
        }
        if (def?.durability && item.durability !== undefined) {
          const bar = document.createElement('div');
          bar.className = 'durability-bar';
          const fill = document.createElement('div');
          fill.className = 'durability-fill';
          fill.style.width = `${Math.max(0, (item.durability / def.durability) * 100)}%`;
          bar.appendChild(fill);
          slotEl.appendChild(bar);
        }
      }
    }
  }

  setMiningProgress(p) {
    if (p <= 0) { this.el.miningWrap.classList.add('hidden'); return; }
    this.el.miningWrap.classList.remove('hidden');
    this.el.miningFill.style.width = `${Math.min(1, p) * 100}%`;
  }

  showInteractHint(show, text) {
    this.el.interactHint.classList.toggle('hidden', !show);
    if (show && text) this.el.interactHint.textContent = text;
  }

  showMountHint(show) { this.el.mountHint.classList.toggle('hidden', !show); }

  toast(message, ms = 3000) {
    const div = document.createElement('div');
    div.className = 'toast';
    div.textContent = message;
    this.el.toastContainer.appendChild(div);
    setTimeout(() => div.remove(), ms);
  }
}
