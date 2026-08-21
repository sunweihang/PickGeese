import {
  Color,
  EffectAsset,
  Material,
  MeshRenderer,
  Texture2D,
  Vec3,
  Vec4,
  assetManager,
  builtinResMgr,
  resources,
} from 'cc';

const FX = 'fx/brick-lit';
const cache = new Map<string, Material>();

/** Glossy candy/jelly defaults — painted skins keep color, lighting adds sheen. */
export const SUCK_ROUGH = 0.48;
export const SUCK_METAL = 0.02;
export const SUCK_EMIT = 0;
export const TEX_TINT = new Color(178, 178, 178, 255);

export const LOOK_TOY = { roughness: 0.48, metallic: 0.02, emit: 0 };
export const LOOK_WOOD = { roughness: 0.58, metallic: 0.02, emit: 0 };
export const LOOK_GRASS = { roughness: 0.72, metallic: 0.0, emit: 0 };
export const LOOK_JELLY = { roughness: 0.32, metallic: 0.0, emit: 0.08 };

let fx: EffectAsset | null = null;
let boot: Promise<void> | null = null;

export function preloadToyLit(): Promise<void> {
  if (fx) return Promise.resolve();
  if (boot) return boot;
  boot = new Promise((resolve) => {
    const done = (err: Error | null, asset: EffectAsset): void => {
      if (!err && asset) fx = asset;
      resolve();
    };
    const bundle = assetManager.getBundle('resources');
    const finish = (err: Error | null, asset: EffectAsset): void => {
      if (!err && asset) {
        done(null, asset);
        return;
      }
      assetManager.loadAny({ uuid: 'a8c3e210-4b71-4f02-9c11-7e2d8a4b0601' }, (e2, anyFx) => {
        done(e2, anyFx as EffectAsset);
      });
    };
    if (bundle) bundle.load(FX, EffectAsset, finish);
    else resources.load(FX, EffectAsset, finish);
  });
  return boot;
}

export type ToyLook = {
  name?: string;
  tex?: Texture2D | null;
  color?: Color;
  roughness?: number;
  metallic?: number;
  emit?: number;
  tile?: Vec4;
};

let texSerial = 0;
const texIds = new WeakMap<Texture2D, string>();

function texKey(tex: Texture2D | null): string {
  if (!tex) return 'none';
  const uuid = tex.uuid;
  if (uuid) return uuid;
  const url = (tex as { nativeUrl?: string }).nativeUrl;
  if (url) return url;
  let id = texIds.get(tex);
  if (!id) {
    texSerial += 1;
    id = `tex#${texSerial}`;
    texIds.set(tex, id);
  }
  return id;
}

function bindLook(mat: Material, look: Required<Pick<ToyLook, 'color' | 'roughness' | 'metallic' | 'emit'>>, tex: Texture2D | null, tile: Vec4): void {
  mat.setProperty('mainColor', look.color);
  mat.setProperty('emissive', look.color);
  mat.setProperty('roughness', look.roughness);
  mat.setProperty('metallic', look.metallic);
  mat.setProperty('emit', look.emit);
  try {
    mat.setProperty('emissiveScale', new Vec3(look.emit, look.emit, look.emit));
  } catch {
    /* brick-lit uses emit */
  }
  if (tex) {
    try {
      mat.setProperty('mainTexture', tex);
    } catch {
      /* ignore */
    }
    try {
      mat.setProperty('tilingOffset', tile);
    } catch {
      /* ignore */
    }
  }
}

function makeLit(look: ToyLook): Material | null {
  const color = look.color ?? (look.tex ? TEX_TINT : Color.WHITE);
  const tex = look.tex ?? null;
  const roughness = look.roughness ?? SUCK_ROUGH;
  const metallic = look.metallic ?? SUCK_METAL;
  const emit = look.emit ?? SUCK_EMIT;
  const tile = look.tile ?? new Vec4(1, 1, 0, 0);
  if (!fx) return null;
  const mat = new Material();
  try {
    mat.initialize({
      effectAsset: fx,
      techniqueIndex: 0,
      defines: tex ? [{ USE_ALBEDO_MAP: true }] : [{}],
    });
  } catch {
    return null;
  }
  if (!mat.passes?.length) return null;
  bindLook(mat, { color, roughness, metallic, emit }, tex, tile);
  return mat;
}

function makeUnlit(tex: Texture2D | null, color: Color): Material {
  const builtin = builtinResMgr.get<Material>('unlit-material');
  let mat: Material;
  if (builtin?.passes?.length) {
    mat = builtin.clone();
    try {
      mat.recompileShaders({ USE_TEXTURE: !!tex, USE_COLOR: true });
    } catch {
      /* ignore */
    }
  } else {
    mat = new Material();
    mat.initialize({
      effectName: 'builtin-unlit',
      technique: 0,
      defines: { USE_TEXTURE: !!tex, USE_COLOR: true },
    });
  }
  mat.setProperty('mainColor', tex ? Color.WHITE : color);
  if (tex) {
    try {
      mat.setProperty('mainTexture', tex);
    } catch {
      /* ignore */
    }
  }
  return mat;
}

export function toyMat(look: ToyLook): Material {
  const color = look.color ?? (look.tex ? TEX_TINT : Color.WHITE);
  const tex = look.tex ?? null;
  const roughness = look.roughness ?? SUCK_ROUGH;
  const metallic = look.metallic ?? SUCK_METAL;
  const emit = look.emit ?? SUCK_EMIT;
  const tile = look.tile ?? new Vec4(1, 1, 0, 0);
  const key = [
    look.name || '',
    texKey(tex),
    color.r, color.g, color.b, color.a,
    roughness, metallic, emit,
    tile.x, tile.y, tile.z, tile.w,
  ].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  const lit = makeLit({ tex, color, roughness, metallic, emit, tile });
  const mat = lit ?? makeUnlit(tex, color);
  cache.set(key, mat);
  return mat;
}

export function muteShadow(mr: MeshRenderer): void {
  mr.shadowCastingMode = MeshRenderer.ShadowCastingMode.OFF;
}

export function toyUnlit(tex: Texture2D | null, color: Color): Material {
  const key = `ui|${texKey(tex)}|${color.r}|${color.g}|${color.b}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const mat = makeUnlit(tex, color);
  cache.set(key, mat);
  return mat;
}
