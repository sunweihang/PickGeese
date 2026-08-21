import {
  Color,
  ImageAsset,
  JsonAsset,
  Material,
  Mesh,
  MeshRenderer,
  Node,
  Texture2D,
  UIMeshRenderer,
  UITransform,
  Vec3,
  primitives,
  resources,
  utils,
} from 'cc';
import { ITEM_DEFS, ItemKind } from './ItemDef';
import { LOOK_TOY, TEX_TINT, muteShadow, toyMat, toyUnlit } from './ToyLit';

type GeoJson = {
  positions: number[];
  normals?: number[];
  uvs?: number[];
  indices: number[];
  min: number[];
  max: number[];
};

type Packed = {
  mesh: Mesh;
  tex: Texture2D | null;
  extent: number;
  size: Vec3;
};

const pack = new Map<string, Packed>();
const matCache = new Map<string, Material>();

function createMesh(geo: GeoJson): Mesh {
  const cx = (geo.min[0] + geo.max[0]) * 0.5;
  const cy = (geo.min[1] + geo.max[1]) * 0.5;
  const cz = (geo.min[2] + geo.max[2]) * 0.5;
  const pos = geo.positions.slice();
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] -= cx;
    pos[i + 1] -= cy;
    pos[i + 2] -= cz;
  }
  const g: primitives.IGeometry = {
    positions: pos,
    indices: geo.indices,
    minPos: new Vec3(geo.min[0] - cx, geo.min[1] - cy, geo.min[2] - cz),
    maxPos: new Vec3(geo.max[0] - cx, geo.max[1] - cy, geo.max[2] - cz),
  };
  if (geo.normals?.length) g.normals = geo.normals;
  if (geo.uvs?.length) g.uvs = geo.uvs;
  const u = utils as {
    MeshUtils?: { createMesh: (geo: primitives.IGeometry) => Mesh };
    createMesh?: (geo: primitives.IGeometry) => Mesh;
  };
  return (u.MeshUtils ? u.MeshUtils.createMesh(g) : u.createMesh!(g));
}

function texFrom(img: ImageAsset): Texture2D {
  const tex = new Texture2D();
  tex.image = img;
  tex.setWrapMode(Texture2D.WrapMode.REPEAT, Texture2D.WrapMode.REPEAT);
  tex.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
  tex.setMipFilter(Texture2D.Filter.LINEAR);
  return tex;
}

function skinMat(tex: Texture2D | null, tint: Color, name: string, ui = false): Material {
  const key = `${ui ? 'ui' : 'lit'}_${name}_${tex ? 't' : `${tint.r}_${tint.g}_${tint.b}`}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  const mat = ui
    ? toyUnlit(tex, tint)
    : toyMat({
      name,
      tex,
      color: tex ? TEX_TINT : tint,
      ...LOOK_TOY,
    });
  matCache.set(key, mat);
  return mat;
}

function loadJson(path: string): Promise<JsonAsset | null> {
  return new Promise((resolve) => {
    resources.load(path, JsonAsset, (err, asset) => resolve(err || !asset ? null : asset));
  });
}

function loadTex(path: string): Promise<Texture2D | null> {
  return new Promise((resolve) => {
    resources.load(path, Texture2D, (err, tex) => {
      if (!err && tex) {
        tex.setWrapMode(Texture2D.WrapMode.REPEAT, Texture2D.WrapMode.REPEAT);
        tex.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
        tex.setMipFilter(Texture2D.Filter.LINEAR);
        resolve(tex);
        return;
      }
      resources.load(path, ImageAsset, (e2, img) => {
        resolve(!e2 && img ? texFrom(img) : null);
      });
    });
  });
}

async function loadOne(model: string, tint: Color): Promise<Packed | null> {
  const cached = pack.get(model);
  if (cached) return cached;
  const geoAsset = await loadJson(`models/${model}`);
  const geo = geoAsset?.json as GeoJson | undefined;
  if (!geo?.positions?.length || !geo.indices?.length) {
    console.warn('PickGeese: missing model', model);
    return null;
  }
  const tex = await loadTex(`skins/${model}`);
  const extent = Math.max(
    geo.max[0] - geo.min[0],
    geo.max[1] - geo.min[1],
    geo.max[2] - geo.min[2],
    0.2,
  );
  const packed: Packed = {
    mesh: createMesh(geo),
    tex,
    extent,
    size: new Vec3(
      geo.max[0] - geo.min[0],
      geo.max[1] - geo.min[1],
      geo.max[2] - geo.min[2],
    ),
  };
  pack.set(model, packed);
  void tint;
  return packed;
}

export function preloadOriginModels(kinds: ItemKind[]): Promise<void> {
  // Do not spread Set: TS ES5 emit is [].concat(set), which does not iterate entries.
  const seen = new Set<string>();
  const jobs: Promise<Packed | null>[] = [];
  for (const k of kinds) {
    const def = ITEM_DEFS[k];
    if (!def || seen.has(def.model)) continue;
    seen.add(def.model);
    jobs.push(loadOne(def.model, def.color));
  }
  return Promise.all(jobs).then(() => undefined);
}

export function originMeshSize(kind: ItemKind): Vec3 | null {
  const def = ITEM_DEFS[kind];
  return pack.get(def.model)?.size.clone() ?? null;
}

export function originVisScale(kind: ItemKind): number {
  const def = ITEM_DEFS[kind];
  const data = pack.get(def.model);
  if (!data) return 1;
  return (def.size * 2.15) / data.extent;
}

/** World AABB after the mesh child's -90° X rotation and vis scale. */
export function originWorldSize(kind: ItemKind): Vec3 {
  const def = ITEM_DEFS[kind];
  const data = pack.get(def.model);
  if (!data) return new Vec3(0.8, 0.8, 0.8);
  const s = originVisScale(kind);
  return new Vec3(data.size.x * s, data.size.z * s, data.size.y * s);
}

export function originWorldRadius(kind: ItemKind): number {
  const w = originWorldSize(kind);
  return 0.5 * Math.sqrt(w.x * w.x + w.y * w.y + w.z * w.z);
}

export function spawnOriginModel(kind: ItemKind, parent: Node): Node | null {
  const def = ITEM_DEFS[kind];
  const data = pack.get(def.model);
  if (!data) return null;
  const root = new Node(`item_${kind}`);
  parent.addChild(root);
  const vis = new Node('mesh');
  root.addChild(vis);
  vis.setRotationFromEuler(-90, 0, 0);
  const s = (def.size * 2.15) / data.extent;
  vis.setScale(s, s, s);
  const mr = vis.addComponent(MeshRenderer);
  mr.mesh = data.mesh;
  mr.material = skinMat(data.tex, def.color, def.model);
  muteShadow(mr);
  return root;
}

export function spawnUiItem(parent: Node, kind: ItemKind, sizePx = 82): Node | null {
  const def = ITEM_DEFS[kind];
  const data = pack.get(def.model);
  if (!data) return null;
  const root = new Node(`fly_${kind}`);
  root.layer = parent.layer;
  parent.addChild(root);
  const ut = root.addComponent(UITransform);
  ut.setContentSize(sizePx, sizePx);
  const vis = new Node('mesh');
  vis.layer = parent.layer;
  root.addChild(vis);
  const mr = vis.addComponent(MeshRenderer);
  vis.addComponent(UIMeshRenderer);
  mr.mesh = data.mesh;
  mr.material = skinMat(data.tex, def.color, def.model, true);
  muteShadow(mr);
  const s = sizePx / Math.max(data.extent, 0.2);
  vis.setScale(s, s, s);
  vis.setRotationFromEuler(-72, 28, 6);
  vis.setPosition(0, -8, 20);
  return root;
}

export function bindSlotModel(host: Node, kind: ItemKind | null, sizePx = 78): void {
  let vis = host.getChildByName('SlotModel');
  if (!kind) {
    if (vis) vis.active = false;
    return;
  }
  const def = ITEM_DEFS[kind];
  const data = pack.get(def.model);
  if (!data) {
    if (vis) vis.active = false;
    return;
  }
  if (!vis) {
    vis = new Node('SlotModel');
    host.addChild(vis);
    vis.layer = host.layer;
    vis.addComponent(MeshRenderer);
    vis.addComponent(UIMeshRenderer);
  }
  vis.active = true;
  vis.layer = host.layer;
  const mr = vis.getComponent(MeshRenderer)!;
  if (!vis.getComponent(UIMeshRenderer)) vis.addComponent(UIMeshRenderer);
  mr.mesh = data.mesh;
  mr.material = skinMat(data.tex, def.color, def.model, true);
  muteShadow(mr);
  const s = sizePx / Math.max(data.extent, 0.2);
  vis.setScale(s, s, s);
  vis.setRotationFromEuler(-72, 28, 6);
  vis.setPosition(0, -8, 20);
}
