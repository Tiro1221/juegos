// ============ ELDERMERE — Interfaz: HUD, inventario, crafteo, diario, diálogos ============
import { BLOCKS, ITEMS, RECIPES, FACTIONS, SEASONS } from './config.js';
import { LORE } from './systems.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.openPanel = null;      // 'inventory' | 'crafting' | 'journal' | 'dialog' | 'pause' | 'help'
    this.craftTab = 'basic';
    this.journalTab = 'lore';
    this.buildHotbar();
    this.bindTabs();
  }

  // ---------- Hotbar ----------
  buildHotbar() {
    const bar = $('hotbar');
    bar.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      d.dataset.slot = i;
      d.innerHTML = `<span class="key">${i + 1}</span><span class="icon"></span><span class="count"></span>`;
      d.addEventListener('click', () => { this.game.inventory.hotSel = i; this.refreshHotbar(); });
      bar.appendChild(d);
    }
  }
  entryVisual(entry) {
    if (!entry) return { icon: '', name: '' };
    const def = entry.type === 'block' ? BLOCKS[entry.key] : ITEMS[entry.key];
    return { icon: def ? def.icon || '❔' : '❔', name: def ? def.name : entry.key };
  }
  refreshHotbar() {
    const inv = this.game.inventory;
    const slots = $('hotbar').children;
    for (let i = 0; i < 9; i++) {
      const el = slots[i];
      const entry = inv.slots[i];
      const v = this.entryVisual(entry);
      el.querySelector('.icon').textContent = entry ? v.icon : '';
      el.querySelector('.count').textContent = entry && entry.n > 1 ? entry.n : '';
      el.classList.toggle('selected', i === inv.hotSel);
      el.title = v.name;
    }
  }

  // ---------- Inventario ----------
  refreshInventory() {
    const inv = this.game.inventory;
    const grid = $('inventory-grid');
    grid.innerHTML = '';
    for (let i = 0; i < 36; i++) {
      const entry = inv.slots[i];
      const v = this.entryVisual(entry);
      const d = document.createElement('div');
      d.className = 'slot';
      d.innerHTML = `<span class="icon">${entry ? v.icon : ''}</span><span class="count">${entry && entry.n > 1 ? entry.n : ''}</span><span class="tooltip">${v.name}${entry ? ' ×' + entry.n : ''}</span>`;
      d.addEventListener('click', () => this.swapWithHotbar(i));
      grid.appendChild(d);
    }
  }
  swapWithHotbar(i) {
    const inv = this.game.inventory;
    const h = inv.hotSel;
    const tmp = inv.slots[h];
    inv.slots[h] = inv.slots[i];
    inv.slots[i] = tmp;
    this.game.audio.sfx('place');
    this.refreshAll();
  }

  // ---------- Crafteo ----------
  refreshCrafting() {
    const list = $('craft-list');
    list.innerHTML = '';
    const inv = this.game.inventory;
    const recipes = this.game.crafting.recipesByTab(this.craftTab);
    for (const r of recipes) {
      const outDef = r.out.block ? BLOCKS[r.out.block] : ITEMS[r.out.item];
      const can = this.game.crafting.canCraft(r);
      const reqParts = Object.entries(r.req).map(([k, n]) => {
        const def = BLOCKS[k] || ITEMS[k] || { name: k };
        if (n === 0) return `<span>${def.icon || ''} ${def.name} (herramienta)</span>`;
        const rk = inv.resolveReqKey(k);
        const have = rk ? inv.count(rk.type, rk.key) : 0;
        const cls = have < n ? 'lack' : '';
        return `<span class="${cls}">${def.icon || ''} ${def.name} ${have}/${n}</span>`;
      }).join(' · ');
      const el = document.createElement('div');
      el.className = 'recipe' + (can ? '' : ' locked');
      el.innerHTML = `<div class="r-icon">${outDef.icon || '❔'}</div>
        <div class="r-info"><div class="r-name">${outDef.name} ×${r.out.n}</div><div class="r-req">${reqParts}</div></div>`;
      const btn = document.createElement('button');
      btn.className = 'parchment-btn small';
      btn.textContent = 'Crear';
      btn.disabled = !can;
      btn.addEventListener('click', () => { this.game.crafting.craft(r); });
      el.appendChild(btn);
      list.appendChild(el);
    }
  }
  bindTabs() {
    document.querySelectorAll('#craft-tabs .tab').forEach((t) => {
      t.addEventListener('click', () => {
        document.querySelectorAll('#craft-tabs .tab').forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
        this.craftTab = t.dataset.tab;
        this.refreshCrafting();
      });
    });
    document.querySelectorAll('#journal-tabs .tab').forEach((t) => {
      t.addEventListener('click', () => {
        document.querySelectorAll('#journal-tabs .tab').forEach((x) => x.classList.remove('active'));
        t.classList.add('active');
        this.journalTab = t.dataset.tab;
        this.refreshJournal();
      });
    });
  }

  // ---------- Diario ----------
  refreshJournal() {
    const c = $('journal-content');
    if (this.journalTab === 'lore') {
      c.innerHTML = LORE.map((l) => `<h3>📜 ${l.title}</h3><p>${l.text}</p>`).join('') +
        `<p style="text-align:center;color:#7a6238;font-style:italic">— Las crónicas se escriben con cada hazaña… —</p>`;
    } else if (this.journalTab === 'factions') {
      const rep = this.game.factions.rep;
      c.innerHTML = Object.entries(FACTIONS).map(([k, f]) => {
        const r = rep[k];
        const pct = (r + 100) / 2;
        const title = this.game.factions.title(k);
        return `<div class="faction-card">
          <div class="f-head"><span class="f-name" style="color:${f.color}">⚜ ${f.name}</span>
          <span class="f-rep">${title} (${r > 0 ? '+' : ''}${r})</span></div>
          <div class="f-bar"><div class="f-fill" style="width:${pct}%;background:${f.color}"></div></div>
          <p style="margin-top:6px">${f.desc}</p></div>`;
      }).join('');
    } else {
      c.innerHTML = this.game.quests.list().map((q) =>
        `<div class="quest-item ${q.done ? 'done' : ''}">
          <div class="q-name">${q.done ? '✅' : '⬜'} ${q.name} ${q.done ? '' : `(${Math.min(q.n, q.target)}/${q.target})`}</div>
          <div class="q-desc">${q.desc}</div></div>`).join('');
    }
  }

  // ---------- Diálogo NPC ----------
  showDialog(npc) {
    this.open('dialog');
    $('dialog-name').textContent = `💬 ${npc.npcName} · ${npc.routinePhase || ''}`;
    const line = npc.lines[(Math.random() * npc.lines.length) | 0];
    $('dialog-text').textContent = `"${line}"`;
    const opts = $('dialog-options');
    opts.innerHTML = '';
    const game = this.game;
    const addOpt = (label, fn) => {
      const b = document.createElement('button');
      b.className = 'parchment-btn small';
      b.style.margin = '2px 0';
      b.textContent = label;
      b.addEventListener('click', fn);
      opts.appendChild(b);
    };
    addOpt('🗨 Escuchar consejo', () => {
      $('dialog-text').textContent = `"${npc.tips}"`;
      game.factions.change(npc.faction, 1, 'por conversar');
    });
    if (npc.type === 'merchant') {
      addOpt('🪙 Vender 1 lingote de oro (+rep Corona)', () => {
        if (game.inventory.count('item', 'item_gold') >= 1) {
          game.inventory.remove('item', 'item_gold', 1);
          game.inventory.add('item', 'item_bread', 2);
          game.factions.change('aldoria', 4, 'por comerciar');
          $('dialog-text').textContent = '"Un placer hacer negocios. Toma pan recién horneado."';
          this.refreshAll();
        } else $('dialog-text').textContent = '"Vuelve cuando tengas oro, amigo."';
      });
      addOpt('🐴 Comprar silla de montar (2 oro)', () => {
        if (game.inventory.count('item', 'item_gold') >= 2) {
          game.inventory.remove('item', 'item_gold', 2);
          game.inventory.add('item', 'item_saddle', 1);
          $('dialog-text').textContent = '"¡Excelente elección! Los caballos salvajes pastan en las praderas."';
          this.refreshAll();
        } else $('dialog-text').textContent = '"Dos lingotes de oro, ni uno menos."';
      });
    }
    if (npc.type === 'sage') {
      addOpt('💜 Entregar 1 cristal arcano (+rep Velo)', () => {
        if (game.inventory.count('item', 'item_crystal') >= 1) {
          game.inventory.remove('item', 'item_crystal', 1);
          game.factions.change('veil', 8, 'por el cristal');
          $('dialog-text').textContent = '"El Velo te sonríe. Este cristal cerrará una grieta… o abrirá un camino."';
          this.refreshAll();
        } else $('dialog-text').textContent = '"Los cristales duermen en vetas profundas, bajo la piedra."';
      });
    }
    if (npc.type === 'villager') {
      addOpt('🍞 Regalar 1 pan (+rep Corona)', () => {
        if (game.inventory.count('item', 'item_bread') >= 1) {
          game.inventory.remove('item', 'item_bread', 1);
          game.factions.change('aldoria', 6, 'por tu generosidad');
          $('dialog-text').textContent = '"¡Que los Antiguos te bendigan! Los tiempos son duros."';
          this.refreshAll();
        } else $('dialog-text').textContent = '"No hace falta, forastero. Guárdate el pan."';
      });
    }
    if (npc.type === 'warden') {
      addOpt('🌿 Entregar 2 hierbas (+rep Guardianes)', () => {
        if (game.inventory.count('item', 'item_herb') >= 2) {
          game.inventory.remove('item', 'item_herb', 2);
          game.factions.change('wardens', 7, 'por honrar el bosque');
          $('dialog-text').textContent = '"El bosque agradece tus manos cuidadosas."';
          this.refreshAll();
        } else $('dialog-text').textContent = '"Las hierbas medicinales crecen entre las flores silvestres."';
      });
    }
    addOpt('👋 Despedirse', () => this.closeAll());
  }

  // ---------- Paneles ----------
  open(name) {
    this.closeAll();
    this.openPanel = name;
    const map = { inventory: 'inventory-panel', crafting: 'crafting-panel', journal: 'journal-panel', dialog: 'dialog-panel', pause: 'pause-panel', help: 'help-panel' };
    $(map[name]).classList.remove('hidden');
    if (name === 'inventory') this.refreshInventory();
    if (name === 'crafting') this.refreshCrafting();
    if (name === 'journal') this.refreshJournal();
    document.exitPointerLock && document.exitPointerLock();
  }
  closeAll() {
    for (const id of ['inventory-panel', 'crafting-panel', 'journal-panel', 'dialog-panel', 'pause-panel', 'help-panel']) {
      $(id).classList.add('hidden');
    }
    this.openPanel = null;
    this.game.relockPointer();
  }

  // ---------- HUD ----------
  refreshHUD() {
    const p = this.game.player;
    $('hp-bar').style.width = Math.max(0, (p.hp / p.maxHp) * 100) + '%';
    $('food-bar').style.width = Math.max(0, p.food) + '%';
    $('stam-bar').style.width = Math.max(0, p.stam) + '%';
    const sky = this.game.sky;
    const isNight = sky.isNight;
    $('clock-icon').textContent = isNight ? '🌙' : '☀️';
    $('clock-text').textContent = `Día ${sky.dayCount} — ${sky.dayPhaseName()}`;
    const s = sky.seasonInfo;
    $('season-text').textContent = `${s.icon} ${s.name}`;
    $('weather-text').textContent = sky.weatherName();
    const boss = this.game.entities.boss;
    const bw = $('boss-bar-wrap');
    if (boss && boss.pos.distanceTo(p.pos) < 40) {
      bw.classList.remove('hidden');
      $('boss-bar').style.width = Math.max(0, (boss.hp / boss.maxHp) * 100) + '%';
    } else bw.classList.add('hidden');
  }
  setBiome(name) { $('biome-text').textContent = name; }

  message(text, ms = 5200) {
    const log = $('message-log');
    const d = document.createElement('div');
    d.className = 'msg';
    d.textContent = text;
    log.appendChild(d);
    while (log.children.length > 6) log.removeChild(log.firstChild);
    setTimeout(() => d.classList.add('fade'), ms);
    setTimeout(() => d.remove(), ms + 900);
  }
  setPrompt(text) {
    const el = $('interact-prompt');
    if (!text) el.classList.add('hidden');
    else { el.textContent = text; el.classList.remove('hidden'); }
  }
  refreshAll() {
    this.refreshHotbar();
    if (this.openPanel === 'inventory') this.refreshInventory();
    if (this.openPanel === 'crafting') this.refreshCrafting();
    if (this.openPanel === 'journal') this.refreshJournal();
  }
}
