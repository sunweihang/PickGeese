import { Color, Texture2D } from 'cc';

const cache = new Map<string, Texture2D>();

type Plot = (u: number, v: number) => [number, number, number];

function clamp(n: number, a = 0, b = 1): number {
  return n < a ? a : n > b ? b : n;
}

function shade(u: number, v: number, lit = 1): number {
  const x = u * 2 - 1;
  const y = v * 2 - 1;
  const r2 = x * x + y * y;
  const key = 0.55 + 0.45 * clamp(1.05 - r2);
  const top = 0.72 + 0.28 * (1 - v);
  const rim = 0.22 + 0.18 * clamp(r2);
  return clamp((0.38 + 0.62 * key * top + rim * 0.15) * lit);
}

function mix(a: number[], b: number[], t: number): [number, number, number] {
  const k = clamp(t);
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

function hash(u: number, v: number, s: number): number {
  const n = Math.sin(u * 127.1 + v * 311.7 + s * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function paint(id: string, plot: Plot, size = 128, lit = true): Texture2D {
  const hit = cache.get(id);
  if (hit) return hit;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const [r, g, b] = plot(u, v);
      const s = lit ? shade(u, v) : 1;
      const i = (y * size + x) * 4;
      data[i] = clamp(r * s, 0, 255);
      data[i + 1] = clamp(g * s, 0, 255);
      data[i + 2] = clamp(b * s, 0, 255);
      data[i + 3] = 255;
    }
  }
  const tex = new Texture2D();
  tex.reset({
    width: size,
    height: size,
    format: Texture2D.PixelFormat.RGBA8888,
  });
  tex.uploadData(data);
  tex.setWrapMode(Texture2D.WrapMode.REPEAT, Texture2D.WrapMode.REPEAT);
  tex.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
  cache.set(id, tex);
  return tex;
}

function woodAlbedo(u: number, v: number, dark: boolean): [number, number, number] {
  const along = dark ? v : u;
  const across = dark ? u : v;
  const planks = 6;
  const p = along * planks;
  const id = Math.floor(p);
  const local = p - id;
  const seam = local < 0.035 || local > 0.965 ? 0.62 : 1;
  const wave = Math.sin((across * 14 + id * 1.7) * 3.2) * 0.5 + 0.5;
  const fiber = 0.86 + 0.14 * Math.sin((across * 42 + along * 3 + id) * 2.4);
  const knot = hash(along * 3.1, across * 2.4, id + 2);
  const pore = hash(along * 18, across * 22, id) * 0.08;
  const warm = dark ? [148, 86, 42] : [214, 148, 78];
  const cool = dark ? [112, 64, 30] : [176, 108, 52];
  const c = mix(warm, cool, wave * 0.55 + knot * 0.2);
  const n = (hash(u, v, 9) - 0.5) * 16;
  const k = fiber * seam * (1 - pore);
  if (knot > 0.93) {
    const ring = Math.abs(hash(u * 8, v * 8, 4) - 0.5);
    const knotC = mix([96, 54, 26], c, 0.35 + ring);
    return [knotC[0] * k + n, knotC[1] * k + n * 0.6, knotC[2] * k];
  }
  return [c[0] * k + n, c[1] * k + n * 0.6, c[2] * k];
}

function rgb(c: Color): [number, number, number] {
  return [c.r, c.g, c.b];
}

export function skinOf(kind: string, tint?: Color): Texture2D {
  if (kind === 'wood') {
    return paint('wood', (u, v) => woodAlbedo(u, v, false), 256, false);
  }
  if (kind === 'woodDark') {
    return paint('woodDark', (u, v) => woodAlbedo(u, v, true), 256, false);
  }
  if (kind === 'woodRail') {
    return paint('woodRail', (u, v) => {
      const edge = u < 0.08 || u > 0.92 || v < 0.12 || v > 0.88 ? 0.72 : 1;
      const c = woodAlbedo(u * 0.4, v, true);
      return [c[0] * edge, c[1] * edge, c[2] * edge];
    }, 128, false);
  }
  if (kind === 'grass') {
    return paint('grass', (u, v) => {
      const n = hash(u * 6, v * 6, 1);
      const n2 = hash(u * 18, v * 14, 3);
      const tuft = hash(Math.floor(u * 28), Math.floor(v * 28), 5);
      const base = mix([118, 186, 86], [78, 148, 62], n * 0.65 + n2 * 0.2);
      const speck = tuft > 0.82 ? 18 : 0;
      return [base[0] + speck, base[1] + speck * 0.6, base[2]];
    }, 256, false);
  }

  switch (kind) {
    case 'goose':
      return paint('goose', (u, v) => {
        const down = mix([250, 248, 240], [226, 214, 196], v * 0.55 + hash(u, v, 3) * 0.12);
        return down;
      });
    case 'gooseBeak':
      return paint('gooseBeak', (u, v) => mix([255, 168, 48], [196, 96, 20], v * 0.6));
    case 'gooseEye':
      return paint('gooseEye', () => [28, 22, 18]);
    case 'watermelon':
      return paint('watermelon', (u) => {
        const stripe = Math.abs(Math.sin(u * Math.PI * 7));
        return mix([36, 110, 48], [86, 176, 72], stripe);
      });
    case 'apple':
      return paint('apple', (u, v) => {
        const spec = hash(u, v, 8) > 0.96 ? 40 : 0;
        const cheek = mix([214, 40, 44], [160, 18, 28], Math.abs(u - 0.5) * 0.8 + v * 0.2);
        return [cheek[0] + spec, cheek[1] + spec * 0.4, cheek[2]];
      });
    case 'banana':
      return paint('banana', (u, v) => {
        const tip = clamp(Math.max(0, 0.12 - v) * 8 + Math.max(0, v - 0.88) * 8);
        return mix([250, 214, 52], [92, 62, 22], tip);
      });
    case 'orange':
      return paint('orange', (u, v) => {
        const pore = hash(u * 6, v * 6, 4) * 28;
        return [240 - pore, 128 - pore * 0.4, 28];
      });
    case 'strawberry':
      return paint('strawberry', (u, v) => {
        if (v < 0.18) return mix([48, 150, 56], [28, 96, 36], hash(u, v, 1));
        const seed = hash(u * 8, v * 8, 5) > 0.82;
        if (seed) return [255, 214, 72];
        return mix([232, 40, 64], [168, 16, 36], v);
      });
    case 'grape':
      return paint('grape', (u, v) => mix([150, 72, 196], [72, 28, 110], Math.abs(u - 0.5) + v * 0.25));
    case 'peach':
      return paint('peach', (u, v) => {
        const crease = Math.abs(u - 0.5) < 0.04 ? 0.78 : 1;
        const c = mix([255, 168, 140], [236, 92, 88], v * 0.45);
        return [c[0] * crease, c[1] * crease, c[2] * crease];
      });
    case 'coconut':
      return paint('coconut', (u, v) => {
        const hair = 0.75 + 0.25 * hash(u * 10, v * 14, 6);
        return [118 * hair, 74 * hair, 40 * hair];
      });
    case 'coconutCut':
      return paint('coconutCut', (u, v) => {
        const r = Math.hypot(u - 0.5, v - 0.5);
        if (r < 0.28) return [248, 240, 214];
        if (r < 0.38) return [196, 168, 120];
        return [110, 70, 38];
      });
    case 'dragon':
      return paint('dragon', (u, v) => {
        const scale = Math.abs(Math.sin(u * 22) * Math.sin(v * 16));
        return mix([214, 48, 118], [96, 176, 72], scale * 0.55 + (v < 0.2 ? 0.4 : 0));
      });
    case 'kiwi':
      return paint('kiwi', (u, v) => {
        const n = hash(u * 12, v * 12, 7);
        return [140 + n * 30, 150 + n * 20, 48];
      });
    case 'pear':
      return paint('pear', (u, v) => mix([226, 214, 86], [150, 176, 56], v * 0.5));
    case 'leaf':
      return paint('leaf', (u, v) => mix([62, 160, 58], [30, 90, 32], v));
    case 'stem':
      return paint('stem', () => [78, 50, 26]);
    default: {
      const c = tint ?? new Color(200, 200, 200, 255);
      return paint(`solid_${c.r}_${c.g}_${c.b}`, () => rgb(c), 32);
    }
  }
}
