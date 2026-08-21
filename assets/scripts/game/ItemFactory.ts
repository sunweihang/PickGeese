import {
  BoxCollider,
  Color,
  ERigidBodyType,
  MeshRenderer,
  Node,
  PhysicsMaterial,
  Quat,
  RigidBody,
  SphereCollider,
  Vec3,
  Vec4,
  primitives,
  utils,
} from 'cc';
import { ITEM_DEFS, ItemDef, ItemKind } from './ItemDef';
import { originMeshSize, spawnOriginModel } from './OriginModels';
import { skinOf } from './SkinTex';
import { ITEM_PHYS } from './Theme';
import { muteShadow, toyMat } from './ToyLit';

const meshCache = new Map<string, ReturnType<typeof utils.MeshUtils.createMesh>>();
let physMat: PhysicsMaterial | null = null;

function applyMeshMat(
  mr: MeshRenderer,
  skin: string,
  tint?: Color,
  look?: { roughness?: number; metallic?: number; emit?: number; tile?: Vec4 },
): void {
  const tex = skinOf(skin, tint);
  const mat = toyMat({
    name: skin,
    tex,
    color: undefined,
    roughness: look?.roughness,
    metallic: look?.metallic,
    emit: look?.emit,
    tile: look?.tile,
  });
  if (!mat.passes?.length) {
    console.error('PickGeese: material has no passes', skin);
    return;
  }
  if (mr.mesh) mr.material = mat;
  muteShadow(mr);
}

function meshOf(kind: 'box' | 'sphere' | 'cylinder' | 'cone' | 'capsule', opt?: Record<string, number>) {
  const k = kind + JSON.stringify(opt ?? {});
  const hit = meshCache.get(k);
  if (hit) return hit;
  let geo: primitives.IGeometry;
  if (kind === 'box') geo = primitives.box({ width: opt?.w ?? 1, height: opt?.h ?? 1, length: opt?.l ?? 1 });
  else if (kind === 'sphere') geo = primitives.sphere(opt?.r ?? 0.5, { segments: opt?.segments ?? 22 });
  else if (kind === 'cylinder') geo = primitives.cylinder(opt?.rTop ?? 0.5, opt?.rBottom ?? 0.5, opt?.h ?? 1, { radialSegments: 16 });
  else if (kind === 'cone') geo = primitives.cone(opt?.r ?? 0.4, opt?.h ?? 0.7, { radialSegments: 14 });
  else geo = primitives.capsule(opt?.r ?? 0.25, opt?.r ?? 0.25, opt?.h ?? 0.5, { sides: 12 });
  const u = utils as { MeshUtils?: { createMesh: (g: primitives.IGeometry) => unknown }; createMesh?: (g: primitives.IGeometry) => unknown };
  const mesh = (u.MeshUtils ? u.MeshUtils.createMesh(geo) : u.createMesh!(geo)) as ReturnType<typeof utils.MeshUtils.createMesh>;
  meshCache.set(k, mesh);
  return mesh;
}

function part(
  parent: Node,
  name: string,
  meshKind: 'box' | 'sphere' | 'cylinder' | 'cone' | 'capsule',
  skin: string,
  pos: Vec3,
  scale: Vec3,
  rot?: Vec3,
  opt?: Record<string, number>,
  tint?: Color,
): Node {
  const n = new Node(name);
  parent.addChild(n);
  n.setPosition(pos);
  n.setScale(scale);
  if (rot) n.setRotationFromEuler(rot.x, rot.y, rot.z);
  const mr = n.addComponent(MeshRenderer);
  mr.mesh = meshOf(meshKind, opt);
  applyMeshMat(mr, skin, tint);
  return n;
}

function getPhysMat(): PhysicsMaterial {
  if (physMat) return physMat;
  physMat = new PhysicsMaterial();
  physMat.friction = ITEM_PHYS.friction;
  physMat.restitution = ITEM_PHYS.restitution;
  return physMat;
}

export type GameItem = {
  node: Node;
  def: ItemDef;
  body: RigidBody;
  inBox: boolean;
  inOut: boolean;
  landed: boolean;
  flyDest?: Vec3;
  flyer?: Node;
};

function decorate(root: Node, def: ItemDef): void {
  const id = def.id;
  switch (id) {
    case 'goose': {
      part(root, 'body', 'sphere', 'goose', new Vec3(0, 0.06, 0), new Vec3(1.22, 0.92, 1.08));
      part(root, 'breast', 'sphere', 'goose', new Vec3(0.22, -0.02, 0.06), new Vec3(0.72, 0.7, 0.7));
      part(root, 'neck', 'capsule', 'goose', new Vec3(0.42, 0.38, 0.06), new Vec3(0.28, 0.72, 0.28), new Vec3(0, 0, -42));
      part(root, 'head', 'sphere', 'goose', new Vec3(0.68, 0.62, 0.1), new Vec3(0.52, 0.48, 0.5));
      part(root, 'beak', 'cone', 'gooseBeak', new Vec3(0.96, 0.54, 0.12), new Vec3(0.2, 0.2, 0.36), new Vec3(90, 68, 0));
      part(root, 'eyeL', 'sphere', 'gooseEye', new Vec3(0.78, 0.7, 0.26), new Vec3(0.1, 0.1, 0.1));
      part(root, 'eyeR', 'sphere', 'gooseEye', new Vec3(0.78, 0.7, -0.04), new Vec3(0.08, 0.08, 0.08));
      part(root, 'wingL', 'sphere', 'goose', new Vec3(-0.06, 0.08, 0.42), new Vec3(0.62, 0.28, 0.24));
      part(root, 'wingR', 'sphere', 'goose', new Vec3(-0.06, 0.08, -0.36), new Vec3(0.62, 0.28, 0.24));
      part(root, 'tail', 'cone', 'goose', new Vec3(-0.58, 0.2, 0), new Vec3(0.32, 0.24, 0.32), new Vec3(-48, 0, 18));
      part(root, 'footL', 'box', 'gooseBeak', new Vec3(0.12, -0.42, 0.2), new Vec3(0.22, 0.08, 0.32));
      part(root, 'footR', 'box', 'gooseBeak', new Vec3(0.12, -0.42, -0.16), new Vec3(0.22, 0.08, 0.32));
      break;
    }
    case 'watermelon': {
      part(root, 'body', 'sphere', 'watermelon', Vec3.ZERO, new Vec3(1, 0.9, 1), undefined, { r: 0.5, segments: 24 });
      part(root, 'stem', 'cylinder', 'stem', new Vec3(0, 0.44, 0), new Vec3(0.1, 0.16, 0.1));
      part(root, 'leaf', 'box', 'leaf', new Vec3(0.1, 0.5, 0), new Vec3(0.22, 0.05, 0.12), new Vec3(0, 0, 18));
      break;
    }
    case 'apple': {
      part(root, 'body', 'sphere', 'apple', Vec3.ZERO, new Vec3(1, 0.92, 1), undefined, { r: 0.5, segments: 22 });
      part(root, 'dimple', 'sphere', 'apple', new Vec3(0, 0.38, 0), new Vec3(0.28, 0.12, 0.28));
      part(root, 'stem', 'cylinder', 'stem', new Vec3(0, 0.42, 0), new Vec3(0.07, 0.18, 0.07));
      part(root, 'leaf', 'box', 'leaf', new Vec3(0.14, 0.46, 0.02), new Vec3(0.3, 0.05, 0.16), new Vec3(10, 25, 28));
      break;
    }
    case 'banana': {
      part(root, 'a', 'capsule', 'banana', new Vec3(-0.14, -0.06, 0), new Vec3(0.52, 0.95, 0.52), new Vec3(0, 0, 32));
      part(root, 'b', 'capsule', 'banana', new Vec3(0.14, 0.1, 0.04), new Vec3(0.48, 0.88, 0.48), new Vec3(8, 0, -16));
      part(root, 'c', 'capsule', 'banana', new Vec3(0.02, 0.02, -0.12), new Vec3(0.46, 0.82, 0.46), new Vec3(-6, 12, 8));
      break;
    }
    case 'orange': {
      part(root, 'body', 'sphere', 'orange', Vec3.ZERO, new Vec3(1, 0.96, 1), undefined, { r: 0.5, segments: 22 });
      part(root, 'navel', 'sphere', 'orange', new Vec3(0, 0.42, 0), new Vec3(0.18, 0.1, 0.18));
      part(root, 'leaf', 'box', 'leaf', new Vec3(0.1, 0.46, 0), new Vec3(0.24, 0.05, 0.12), new Vec3(0, 0, 20));
      break;
    }
    case 'strawberry': {
      part(root, 'body', 'cone', 'strawberry', new Vec3(0, -0.06, 0), new Vec3(0.9, 1, 0.9), new Vec3(180, 0, 0));
      part(root, 'cap', 'sphere', 'leaf', new Vec3(0, 0.28, 0), new Vec3(0.72, 0.26, 0.72));
      part(root, 'leaf1', 'box', 'leaf', new Vec3(0.16, 0.34, 0), new Vec3(0.28, 0.05, 0.12), new Vec3(0, 0, 24));
      part(root, 'leaf2', 'box', 'leaf', new Vec3(-0.14, 0.34, 0.08), new Vec3(0.26, 0.05, 0.12), new Vec3(0, 40, -20));
      break;
    }
    case 'grape': {
      const spots = [
        [0, 0.16, 0, 0.58],
        [0.2, -0.04, 0.1, 0.5],
        [-0.18, -0.06, 0.06, 0.5],
        [0.04, -0.2, -0.14, 0.44],
        [0.16, -0.22, 0.16, 0.4],
        [-0.12, -0.24, -0.1, 0.4],
      ];
      for (let i = 0; i < spots.length; i++) {
        const s = spots[i];
        part(root, `g${i}`, 'sphere', 'grape', new Vec3(s[0], s[1], s[2]), new Vec3(s[3], s[3], s[3]));
      }
      part(root, 'stem', 'cylinder', 'stem', new Vec3(0, 0.4, 0), new Vec3(0.07, 0.16, 0.07));
      break;
    }
    case 'peach': {
      part(root, 'body', 'sphere', 'peach', Vec3.ZERO, new Vec3(1, 0.9, 0.96), undefined, { r: 0.5, segments: 22 });
      part(root, 'leaf', 'box', 'leaf', new Vec3(0.12, 0.4, 0), new Vec3(0.28, 0.05, 0.14), new Vec3(0, 16, 22));
      part(root, 'stem', 'cylinder', 'stem', new Vec3(0, 0.38, 0), new Vec3(0.06, 0.14, 0.06));
      break;
    }
    case 'coconut': {
      part(root, 'body', 'sphere', 'coconut', Vec3.ZERO, new Vec3(1, 0.94, 1));
      part(root, 'cut', 'sphere', 'coconutCut', new Vec3(0.28, 0.22, 0.2), new Vec3(0.5, 0.5, 0.5));
      break;
    }
    case 'dragon': {
      part(root, 'body', 'sphere', 'dragon', Vec3.ZERO, new Vec3(1, 1.08, 1));
      part(root, 'fin1', 'cone', 'leaf', new Vec3(0, 0.5, 0), new Vec3(0.3, 0.36, 0.3));
      part(root, 'fin2', 'cone', 'leaf', new Vec3(0.3, 0.28, 0.12), new Vec3(0.22, 0.28, 0.22), new Vec3(0, 0, 40));
      part(root, 'fin3', 'cone', 'leaf', new Vec3(-0.28, 0.26, -0.08), new Vec3(0.22, 0.28, 0.22), new Vec3(0, 0, -36));
      break;
    }
    case 'kiwi': {
      part(root, 'body', 'sphere', 'kiwi', Vec3.ZERO, new Vec3(1, 0.8, 1));
      break;
    }
    case 'pear': {
      part(root, 'bot', 'sphere', 'pear', new Vec3(0, -0.1, 0), new Vec3(1, 0.82, 1));
      part(root, 'top', 'sphere', 'pear', new Vec3(0, 0.24, 0), new Vec3(0.66, 0.6, 0.66));
      part(root, 'stem', 'cylinder', 'stem', new Vec3(0, 0.5, 0), new Vec3(0.07, 0.18, 0.07));
      part(root, 'leaf', 'box', 'leaf', new Vec3(0.1, 0.54, 0), new Vec3(0.22, 0.04, 0.1), new Vec3(0, 0, 18));
      break;
    }
    default:
      part(root, 'body', 'sphere', id, Vec3.ZERO, Vec3.ONE, undefined, undefined, def.color);
  }
  const s = def.size * 2;
  root.setScale(s, s, s);
}

type BodyImpl = {
  setMaxLinearVelocity?: (v: number) => void;
  setMaxAngularVelocity?: (v: number) => void;
  setMaxDepenetrationVelocity?: (v: number) => void;
};

/** Original itemPhys: linear 0.7 / angular 0.5, maxLin 5, maxAng 50, depen 1.5. */
export function tuneItemBody(body: RigidBody): void {
  body.linearDamping = 0.7;
  body.angularDamping = 0.5;
  body.allowSleep = true;
  body.sleepThreshold = 0.35;
  const impl = (body as unknown as { body?: { impl?: BodyImpl } }).body?.impl;
  impl?.setMaxLinearVelocity?.(5);
  impl?.setMaxAngularVelocity?.(50);
  impl?.setMaxDepenetrationVelocity?.(1.5);
}

export function freezeItem(item: GameItem): void {
  if (!item.body.isValid) return;
  item.body.setLinearVelocity(Vec3.ZERO);
  item.body.setAngularVelocity(Vec3.ZERO);
  item.body.type = ERigidBodyType.STATIC;
  item.body.useGravity = false;
}

function ensureBody(node: Node, def: ItemDef, skipCollider = false): RigidBody {
  let body = node.getComponent(RigidBody);
  if (body) {
    body.type = ERigidBodyType.DYNAMIC;
    body.useGravity = true;
    tuneItemBody(body);
    return body;
  }
  body = node.addComponent(RigidBody);
  body.type = ERigidBodyType.DYNAMIC;
  body.mass = def.mass;
  body.useGravity = true;
  tuneItemBody(body);
  const pm = getPhysMat();
  if (!skipCollider && !node.getComponent(SphereCollider) && !node.getComponent(BoxCollider)) {
    addFallbackCollider(node, def, pm);
  }
  return body;
}

function addFallbackCollider(node: Node, def: ItemDef, pm: PhysicsMaterial): void {
  if (def.collider === 'sphere') {
    const col = node.addComponent(SphereCollider);
    col.radius = def.size;
    col.material = pm;
  } else {
    const col = node.addComponent(BoxCollider);
    const s = def.size;
    col.size = new Vec3(s * 1.5, s * 0.7, s * 0.7);
    col.material = pm;
  }
}

function addMeshCollider(root: Node, kind: ItemKind): boolean {
  const vis = root.getChildByName('mesh');
  const size = originMeshSize(kind);
  if (!vis || !size) return false;
  const col = vis.addComponent(BoxCollider);
  col.size = new Vec3(Math.max(0.08, size.x * 0.88), Math.max(0.08, size.y * 0.88), Math.max(0.08, size.z * 0.88));
  col.material = getPhysMat();
  return true;
}

export function createItem(kind: ItemKind, parent: Node): GameItem {
  const def = ITEM_DEFS[kind];
  const origin = spawnOriginModel(kind, parent);
  if (origin) {
    origin.name = `item_${kind}`;
    const fitted = addMeshCollider(origin, kind);
    const body = ensureBody(origin, def, fitted);
    return { node: origin, def, body, inBox: true, inOut: false, landed: false };
  }

  const node = new Node(`item_${kind}`);
  parent.addChild(node);
  decorate(node, def);

  const body = node.addComponent(RigidBody);
  body.type = ERigidBodyType.DYNAMIC;
  body.mass = def.mass;
  body.useGravity = true;
  tuneItemBody(body);

  const pm = getPhysMat();
  if (def.collider === 'sphere') {
    const col = node.addComponent(SphereCollider);
    col.radius = def.size;
    col.material = pm;
  } else {
    const col = node.addComponent(BoxCollider);
    const s = def.size;
    col.size = new Vec3(s * 1.5, s * 0.7, s * 0.7);
    col.material = pm;
  }

  return { node, def, body, inBox: true, inOut: false, landed: false };
}

function wall(
  parent: Node,
  name: string,
  pos: Vec3,
  size: Vec3,
  skin: string,
  opts?: { mesh?: boolean; body?: boolean; tile?: Vec4 },
): Node {
  const n = new Node(name);
  parent.addChild(n);
  n.setPosition(pos);
  if (opts?.mesh !== false) {
    const mr = n.addComponent(MeshRenderer);
    mr.mesh = meshOf('box', { w: size.x, h: size.y, l: size.z });
    applyMeshMat(mr, skin, undefined, {
      tile: opts?.tile ?? new Vec4(Math.max(1, size.x * 0.45), Math.max(1, size.y * 0.45), 0, 0),
    });
  }
  if (opts?.body !== false) {
    const body = n.addComponent(RigidBody);
    body.type = ERigidBodyType.STATIC;
    const col = n.addComponent(BoxCollider);
    col.size = size;
    col.material = getPhysMat();
  }
  return n;
}

export let crateLimitHalf = 2.7;
export let crateLimitTop = 2.1;

export function createArena(parent: Node, boxScale = 1): Node {
  const arena = new Node('Arena');
  parent.addChild(arena);

  const ground = new Node('Ground');
  arena.addChild(ground);
  ground.setPosition(0, -0.16, 0);
  const gmr = ground.addComponent(MeshRenderer);
  gmr.mesh = meshOf('box', { w: 28, h: 0.3, l: 28 });
  applyMeshMat(gmr, 'grass', undefined, {
    tile: new Vec4(8, 8, 0, 0),
  });
  const gb = ground.addComponent(RigidBody);
  gb.type = ERigidBodyType.STATIC;
  const gc = ground.addComponent(BoxCollider);
  gc.size = new Vec3(28, 0.3, 28);

  const inner = 6.2 * boxScale;
  const wallH = 2.35 * boxScale;
  const thick = 0.26;
  const half = inner * 0.5 + thick * 0.5;
  const lipH = 0.34 * boxScale;
  const rail = 0.18 * boxScale;
  const hitH = 5.6 * boxScale;
  const hitT = 0.62;
  const crate = new Node('Crate');
  arena.addChild(crate);
  crateLimitHalf = inner * 0.5 - 0.38;
  crateLimitTop = wallH - 0.25;

  const floorTile = new Vec4(2.4, 2.4, 0, 0);
  const wallTile = new Vec4(2.1, 1.4, 0, 0);
  wall(crate, 'floor', new Vec3(0, 0, 0), new Vec3(inner + thick * 2, 0.26, inner + thick * 2), 'wood', {
    tile: floorTile,
  });
  wall(crate, 'left', new Vec3(-half, wallH * 0.5, 0), new Vec3(thick, wallH, inner + thick * 2), 'woodDark', {
    tile: wallTile,
  });
  wall(crate, 'right', new Vec3(half, wallH * 0.5, 0), new Vec3(thick, wallH, inner + thick * 2), 'woodDark', {
    tile: wallTile,
  });
  wall(crate, 'back', new Vec3(0, wallH * 0.5, -half), new Vec3(inner, wallH, thick), 'wood', {
    tile: wallTile,
  });
  wall(crate, 'frontHit', new Vec3(0, hitH * 0.45, half + 0.08), new Vec3(inner + thick, hitH, hitT), 'woodDark', {
    mesh: false,
  });
  wall(crate, 'leftHit', new Vec3(-half, hitH * 0.45, 0), new Vec3(hitT, hitH, inner + hitT), 'woodDark', {
    mesh: false,
  });
  wall(crate, 'rightHit', new Vec3(half, hitH * 0.45, 0), new Vec3(hitT, hitH, inner + hitT), 'woodDark', {
    mesh: false,
  });
  wall(crate, 'backHit', new Vec3(0, hitH * 0.45, -half), new Vec3(inner + hitT, hitH, hitT), 'woodDark', {
    mesh: false,
  });
  wall(crate, 'frontLip', new Vec3(0, lipH * 0.5, half), new Vec3(inner, lipH, thick), 'wood', {
    body: false,
    tile: new Vec4(2.2, 0.6, 0, 0),
  });
  const railY = wallH - rail * 0.5;
  wall(crate, 'railFront', new Vec3(0, railY, half), new Vec3(inner + thick * 2, rail, thick * 1.15), 'woodRail', {
    body: false,
    tile: new Vec4(2.6, 0.35, 0, 0),
  });
  wall(crate, 'railBack', new Vec3(0, railY, -half), new Vec3(inner + thick * 2, rail, thick * 1.15), 'woodRail', {
    body: false,
    tile: new Vec4(2.6, 0.35, 0, 0),
  });
  wall(crate, 'railLeft', new Vec3(-half, railY, 0), new Vec3(thick * 1.15, rail, inner), 'woodRail', {
    body: false,
    tile: new Vec4(2.4, 0.35, 0, 0),
  });
  wall(crate, 'railRight', new Vec3(half, railY, 0), new Vec3(thick * 1.15, rail, inner), 'woodRail', {
    body: false,
    tile: new Vec4(2.4, 0.35, 0, 0),
  });

  return arena;
}

export function setItemKinematic(item: GameItem, on: boolean): void {
  item.body.type = on ? ERigidBodyType.KINEMATIC : ERigidBodyType.DYNAMIC;
  item.body.useGravity = !on;
  if (on) {
    item.body.setLinearVelocity(Vec3.ZERO);
    item.body.setAngularVelocity(Vec3.ZERO);
  } else {
    tuneItemBody(item.body);
    item.body.wakeUp();
  }
}

export function randomQuat(): Quat {
  const q = new Quat();
  Quat.fromEuler(q, Math.random() * 360, Math.random() * 360, Math.random() * 360);
  return q;
}

