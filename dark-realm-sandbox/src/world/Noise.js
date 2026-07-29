// ============================================================================
// Lightweight seeded 2D/3D simplex-like noise (Perlin-style) + FBM helpers.
// Self-contained (no deps) so it works fine inside Web Workers too.
// ============================================================================

function buildPermutation(seed) {
  let s = seed >>> 0;
  const rand = () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    s >>>= 0;
    return s / 4294967295;
  };
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
}

function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function lerp(t, a, b) { return a + t * (b - a); }
function grad2(hash, x, y) {
  const h = hash & 7;
  const u = h < 4 ? x : y;
  const v = h < 4 ? y : x;
  return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v);
}
function grad3(hash, x, y, z) {
  const h = hash & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : (h === 12 || h === 14 ? x : z);
  return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
}

export class Noise2D {
  constructor(seed = 1337) {
    this.perm = buildPermutation(seed);
  }
  get(x, y) {
    const perm = this.perm;
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const A = perm[X] + Y, B = perm[X + 1] + Y;
    return lerp(v,
      lerp(u, grad2(perm[A], x, y), grad2(perm[B], x - 1, y)),
      lerp(u, grad2(perm[A + 1], x, y - 1), grad2(perm[B + 1], x - 1, y - 1))
    );
  }
  fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.get(x * freq, y * freq) * amp;
      norm += amp;
      amp *= gain; freq *= lacunarity;
    }
    return sum / norm;
  }
}

export class Noise3D {
  constructor(seed = 4242) {
    this.perm = buildPermutation(seed);
  }
  get(x, y, z) {
    const perm = this.perm;
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[X] + Y, AA = perm[A] + Z, AB = perm[A + 1] + Z;
    const B = perm[X + 1] + Y, BA = perm[B] + Z, BB = perm[B + 1] + Z;
    return lerp(w,
      lerp(v, lerp(u, grad3(perm[AA], x, y, z), grad3(perm[BA], x - 1, y, z)),
              lerp(u, grad3(perm[AB], x, y - 1, z), grad3(perm[BB], x - 1, y - 1, z))),
      lerp(v, lerp(u, grad3(perm[AA + 1], x, y, z - 1), grad3(perm[BA + 1], x - 1, y, z - 1)),
              lerp(u, grad3(perm[AB + 1], x, y - 1, z - 1), grad3(perm[BB + 1], x - 1, y - 1, z - 1)))
    );
  }
  fbm(x, y, z, octaves = 3, lacunarity = 2, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += this.get(x * freq, y * freq, z * freq) * amp;
      norm += amp;
      amp *= gain; freq *= lacunarity;
    }
    return sum / norm;
  }
}
