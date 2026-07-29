// Benchmark del generador de mundo (ejecutar: node dev/bench.mjs)
import { generateChunk } from '../js/worldgen.js';

// 1) Un chunk: tiempo + histograma de bloques
let t0 = performance.now();
const g = generateChunk(0, 0);
const t1 = performance.now();
const hist = {};
for (const b of g.data) hist[b] = (hist[b] || 0) + 1;
const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log(`generateChunk(0,0): ${(t1 - t0).toFixed(1)} ms`);
console.log('Top bloques:', top.map(([k, v]) => `${k}:${v}`).join('  '));
const solid = g.data.filter((b) => b !== 'air').length;
console.log(`Bloques no-aire: ${solid} / ${g.data.length} (${(100 * solid / g.data.length).toFixed(1)}%)`);
console.log('NPCs:', g.props.npcSpawns.length, ' Mobs:', g.props.mobSpawns.length, ' Cofres:', g.props.chests.length, ' Estructuras:', g.props.structures.map((s) => s.type).join(',') || '—');

// 2) Lote de 25 chunks (radio 2) para estimar precarga
t0 = performance.now();
let air = 0, total = 0;
for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
  const c = generateChunk(dx, dz);
  for (const b of c.data) { total++; if (b === 'air') air++; }
}
console.log(`25 chunks: ${(performance.now() - t0).toFixed(0)} ms total, no-aire medio: ${(100 * (1 - air / total)).toFixed(1)}%`);
