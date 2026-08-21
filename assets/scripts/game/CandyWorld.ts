import {
  BlendFactor,
  Color,
  Material,
  MeshRenderer,
  Node,
  Texture2D,
  Vec3,
  gfx,
  primitives,
  Tween,
  tween,
  utils,
} from 'cc';
import { LOOK_GRASS, LOOK_JELLY, muteShadow, toyMat, toyUnlit } from './ToyLit';

const meshCache = new Map<string, ReturnType<typeof utils.MeshUtils.createMesh>>();

function meshOf(kind: 'box' | 'sphere', opt?: Record<string, number>) {
  const k = kind + JSON.stringify(opt ?? {});
  const hit = meshCache.get(k);
  if (hit) return hit;
  const geo = kind === 'box'
    ? primitives.box({ width: opt?.w ?? 1, height: opt?.h ?? 1, length: opt?.l ?? 1 })
    : primitives.sphere(opt?.r ?? 0.5, { segments: opt?.segments ?? 20 });
  const u = utils as { MeshUtils?: { createMesh: (g: primitives.IGeometry) => unknown }; createMesh?: (g: primitives.IGeometry) => unknown };
  const mesh = (u.MeshUtils ? u.MeshUtils.createMesh(geo) : u.createMesh!(geo)) as ReturnType<typeof utils.MeshUtils.createMesh>;
  meshCache.set(k, mesh);
  return mesh;
}

function paint(id: string, size: number, plot: (u: number, v: number) => [number, number, number, number]): Texture2D {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / (size - 1);
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const [r, g, b, a] = plot(u, v);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  const tex = new Texture2D();
  tex.reset({ width: size, height: size, format: Texture2D.PixelFormat.RGBA8888 });
  tex.uploadData(data);
  tex.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
  tex.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
  return tex;
}

let skyTex: Texture2D | null = null;
let starTex: Texture2D | null = null;
let skyMat: Material | null = null;
let starMat: Material | null = null;

function skyTexture(): Texture2D {
  if (skyTex) return skyTex;
  skyTex = paint('sky', 64, (_u, v) => {
    const top: [number, number, number] = [132, 214, 255];
    const mid: [number, number, number] = [236, 196, 255];
    const bot: [number, number, number] = [255, 244, 228];
    const t = v < 0.55
      ? v / 0.55
      : (v - 0.55) / 0.45;
    const a = v < 0.55 ? top : mid;
    const b = v < 0.55 ? mid : bot;
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
      255,
    ];
  });
  return skyTex;
}

function starTexture(): Texture2D {
  if (starTex) return starTex;
  starTex = paint('star', 64, (u, v) => {
    const x = u * 2 - 1;
    const y = v * 2 - 1;
    const r = Math.hypot(x, y);
    const spike = Math.min(Math.abs(x), Math.abs(y));
    const cross = Math.exp(-spike * 18) * Math.exp(-r * r * 2.4);
    const core = Math.exp(-r * r * 22);
    const a = Math.min(255, (cross * 1.15 + core) * 255);
    return [255, 252, 255, a];
  });
  return starTex;
}

function skyMaterial(): Material {
  if (skyMat) return skyMat;
  skyMat = toyUnlit(skyTexture(), Color.WHITE);
  try {
    skyMat.overridePipelineStates({
      rasterizerState: { cullMode: gfx.CullMode.FRONT },
      depthStencilState: { depthTest: true, depthWrite: false },
    });
  } catch {
    /* ignore */
  }
  return skyMat;
}

function starMaterial(): Material {
  if (starMat) return starMat;
  const mat = new Material();
  try {
    mat.initialize({
      effectName: 'builtin-unlit',
      technique: 1,
      defines: { USE_TEXTURE: true, USE_COLOR: true },
    });
  } catch {
    starMat = toyUnlit(starTexture(), Color.WHITE);
    return starMat;
  }
  mat.setProperty('mainColor', new Color(255, 250, 255, 255));
  mat.setProperty('mainTexture', starTexture());
  try {
    mat.overridePipelineStates({
      depthStencilState: { depthTest: true, depthWrite: false },
      blendState: {
        targets: [{
          blend: true,
          blendSrc: BlendFactor.SRC_ALPHA,
          blendDst: BlendFactor.ONE,
          blendSrcAlpha: BlendFactor.ONE,
          blendDstAlpha: BlendFactor.ONE,
        }],
      },
    });
  } catch {
    /* ignore */
  }
  starMat = mat;
  return mat;
}

const JELLIES: Array<{ c: Color; p: Vec3; s: number; box: boolean }> = [
  { c: new Color(255, 86, 186, 255), p: new Vec3(-5.6, 0.55, 3.4), s: 0.62, box: true },
  { c: new Color(80, 230, 255, 255), p: new Vec3(5.8, 0.72, 2.8), s: 0.5, box: true },
  { c: new Color(156, 255, 78, 255), p: new Vec3(-4.8, 1.15, -3.6), s: 0.46, box: true },
  { c: new Color(255, 168, 56, 255), p: new Vec3(5.2, 0.48, -4.1), s: 0.58, box: true },
  { c: new Color(186, 96, 255, 255), p: new Vec3(0.8, 2.4, -5.2), s: 0.4, box: true },
  { c: new Color(255, 110, 210, 255), p: new Vec3(-6.2, 2.1, 0.4), s: 0.36, box: false },
  { c: new Color(90, 255, 210, 255), p: new Vec3(6.4, 1.8, -1.2), s: 0.34, box: false },
  { c: new Color(255, 230, 80, 255), p: new Vec3(-2.2, 3.1, -4.6), s: 0.3, box: false },
];

const HILLS: Array<{ p: Vec3; s: Vec3; c: Color }> = [
  { p: new Vec3(-16, -3.2, -22), s: new Vec3(22, 8.5, 16), c: new Color(126, 220, 92, 255) },
  { p: new Vec3(15, -3.6, -24), s: new Vec3(20, 7.4, 14), c: new Color(168, 236, 110, 255) },
  { p: new Vec3(1, -4.4, -30), s: new Vec3(30, 9.2, 18), c: new Color(110, 206, 86, 255) },
  { p: new Vec3(-22, -2.8, -8), s: new Vec3(14, 6.2, 12), c: new Color(148, 228, 98, 255) },
  { p: new Vec3(22, -3.0, -6), s: new Vec3(13, 5.8, 11), c: new Color(176, 240, 120, 255) },
];

export function decorateCandyWorld(arena: Node): void {
  const fx = new Node('CandyWorld');
  arena.addChild(fx);

  const sky = new Node('Sky');
  fx.addChild(sky);
  sky.setScale(78, 78, 78);
  const smr = sky.addComponent(MeshRenderer);
  smr.mesh = meshOf('sphere', { r: 1, segments: 28 });
  smr.material = skyMaterial();
  muteShadow(smr);

  for (let i = 0; i < HILLS.length; i++) {
    const h = HILLS[i];
    const n = new Node(`hill${i}`);
    fx.addChild(n);
    n.setPosition(h.p);
    n.setScale(h.s);
    const mr = n.addComponent(MeshRenderer);
    mr.mesh = meshOf('sphere', { r: 0.5, segments: 16 });
    mr.material = toyMat({
      name: `hill${i}`,
      color: h.c,
      ...LOOK_GRASS,
    });
    muteShadow(mr);
  }

  for (let i = 0; i < JELLIES.length; i++) {
    const j = JELLIES[i];
    const n = new Node(`jelly${i}`);
    fx.addChild(n);
    n.setPosition(j.p);
    n.setScale(j.s, j.s, j.s);
    n.setRotationFromEuler(12 + i * 17, 28 + i * 41, 8);
    const mr = n.addComponent(MeshRenderer);
    mr.mesh = j.box
      ? meshOf('box', { w: 1, h: 1, l: 1 })
      : meshOf('sphere', { r: 0.5, segments: 18 });
    mr.material = toyMat({
      name: `jelly${i}`,
      color: j.c,
      ...LOOK_JELLY,
    });
    muteShadow(mr);
    const bob = 0.12 + (i % 3) * 0.04;
    tween(n)
      .to(1.6 + i * 0.07, { position: new Vec3(j.p.x, j.p.y + bob, j.p.z) })
      .to(1.6 + i * 0.07, { position: j.p.clone() })
      .union()
      .repeatForever()
      .start();
  }

  const stars = new Node('Stars');
  fx.addChild(stars);
  const glow = starMaterial();
  for (let i = 0; i < 22; i++) {
    const n = new Node(`s${i}`);
    stars.addChild(n);
    const a = (i / 22) * Math.PI * 2;
    const r = 3.4 + (i % 5) * 0.85;
    n.setPosition(Math.cos(a) * r, 1.2 + (i % 7) * 0.55, Math.sin(a) * r - 0.4);
    const s = 0.18 + (i % 4) * 0.05;
    n.setScale(s, s, s);
    n.setRotationFromEuler(-62, 0, i * 16);
    const mr = n.addComponent(MeshRenderer);
    mr.mesh = meshOf('box', { w: 1, h: 1, l: 0.02 });
    mr.material = glow;
    muteShadow(mr);
    tween(n)
      .to(0.7 + (i % 5) * 0.08, { scale: new Vec3(s * 1.55, s * 1.55, s * 1.55) })
      .to(0.7 + (i % 5) * 0.08, { scale: new Vec3(s, s, s) })
      .union()
      .repeatForever()
      .start();
  }

  fx.once(Node.EventType.NODE_DESTROYED, () => {
    Tween.stopAllByTarget(fx);
    for (const child of fx.children) Tween.stopAllByTarget(child);
    for (const child of stars.children) Tween.stopAllByTarget(child);
  });
}
