// ============================================================================
// Farming system: seasons cycle (Spring/Summer/Autumn/Winter) affect crop
// growth speed and which crops can grow; tracks planted crop tiles and
// advances their growth stage over time.
// ============================================================================
import { BlockId } from '../world/Blocks.js';

export const Season = { SPRING: 'spring', SUMMER: 'summer', AUTUMN: 'autumn', WINTER: 'winter' };
const SEASON_ORDER = [Season.SPRING, Season.SUMMER, Season.AUTUMN, Season.WINTER];
const SEASON_LABELS = { spring: 'Primavera', summer: 'Verano', autumn: 'Otoño', winter: 'Invierno' };

export class FarmingSystem {
  constructor(world, dayLengthSeconds) {
    this.world = world;
    this.dayLengthSeconds = dayLengthSeconds;
    this.seasonLengthDays = 6; // days per season
    this.totalDays = 0;
    this.dayTimer = 0;
    this.seasonIndex = 0;
    this.plots = new Map(); // "x,y,z" -> {stage, growTimer, wx,wy,wz}
  }

  get season() { return SEASON_ORDER[this.seasonIndex]; }
  get seasonLabel() { return SEASON_LABELS[this.season]; }

  growthMultiplier() {
    switch (this.season) {
      case Season.SPRING: return 1.4;
      case Season.SUMMER: return 1.1;
      case Season.AUTUMN: return 0.8;
      case Season.WINTER: return 0.0; // nothing grows in winter
      default: return 1;
    }
  }

  registerPlant(wx, wy, wz) {
    const key = `${wx},${wy},${wz}`;
    this.plots.set(key, { stage: 0, growTimer: 0, wx, wy, wz });
  }

  unregisterPlant(wx, wy, wz) {
    this.plots.delete(`${wx},${wy},${wz}`);
  }

  update(dt) {
    this.dayTimer += dt;
    if (this.dayTimer >= this.dayLengthSeconds) {
      this.dayTimer = 0;
      this.totalDays++;
      if (this.totalDays % this.seasonLengthDays === 0) {
        this.seasonIndex = (this.seasonIndex + 1) % SEASON_ORDER.length;
      }
    }

    const mult = this.growthMultiplier();
    if (mult <= 0) return;

    for (const plot of this.plots.values()) {
      if (plot.stage >= 3) continue;
      plot.growTimer += dt * mult;
      const threshold = 24; // seconds (scaled by season) per stage
      if (plot.growTimer >= threshold) {
        plot.growTimer = 0;
        plot.stage++;
        const blockId = [BlockId.CROP_0, BlockId.CROP_1, BlockId.CROP_2, BlockId.CROP_3][plot.stage];
        this.world.setBlock(plot.wx, plot.wy, plot.wz, blockId);
      }
    }
  }
}
