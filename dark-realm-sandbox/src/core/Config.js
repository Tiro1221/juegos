// ============================================================================
// Global tunable configuration constants.
// ============================================================================
export const CHUNK_SIZE = 16;      // blocks on X/Z
export const CHUNK_HEIGHT = 96;    // blocks on Y
export const SEA_LEVEL = 34;
export const WORLD_SEED = 918273;

export const RENDER_DISTANCE = 5;  // chunks radius (desktop default)
export const RENDER_DISTANCE_MOBILE = 3;

export const GRAVITY = 28;
export const PLAYER_HEIGHT = 1.7;
export const PLAYER_RADIUS = 0.32;
export const PLAYER_EYE_HEIGHT = 1.58;
export const WALK_SPEED = 4.3;
export const SPRINT_SPEED = 6.6;
export const SWIM_SPEED = 3.0;
export const JUMP_SPEED = 8.6;

export const DAY_LENGTH_SECONDS = 600; // full day/night cycle length

export function isMobile() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 1 && window.innerWidth < 1100);
}
