import {
  Camera,
  Collider,
  ERigidBodyType,
  EventTouch,
  Input,
  Layers,
  MeshRenderer,
  Node,
  PhysicsSystem,
  Quat,
  Scene,
  Tween,
  UITransform,
  Vec3,
  geometry,
  input,
  tween,
} from 'cc';
import { applyPortraitCameraRect, portraitVisibleSize } from './PortraitFit';
import { Hud } from './Hud';
import { ITEM_DEFS, ItemKind, LEVELS } from './ItemDef';
import {
  GameItem,
  crateLimitHalf,
  createArena,
  createItem,
  freezeItem,
  pileQuat,
  setItemKinematic,
} from './ItemFactory';
import { preloadOriginModels } from './OriginModels';
import { MATCH_COUNT, SLOT_COUNT } from './Theme';
import { preloadToyLit } from './ToyLit';

const FLY_LAYER = Layers.Enum.UI_3D;

const _ray = new geometry.Ray();

export class GameController {
  static create(scene: Scene): GameController {
    const g = new GameController(scene);
    g._init();
    return g;
  }

  private readonly _scene: Scene;
  private readonly _world: Node;
  private readonly _objGroup: Node;
  private _arena: Node | null = null;
  private _hud: Hud | null = null;
  private _mainCam: Camera | null = null;
  private _uiCam: Camera | null = null;
  private _flyCam: Camera | null = null;
  private _items: GameItem[] = [];
  private _boxItems: GameItem[] = [];
  private _selected: GameItem[] = [];
  private _outItems: GameItem[] = [];
  private _hover: GameItem | null = null;
  private _canOperate = false;
  private _level = 0;
  private _total = 0;
  private _outLeft = 3;
  private _collectLeft = 2;
  private _chaosLeft = 2;
  private _shakeReady = true;
  private _containNode: Node | null = null;
  private _phase: 'home' | 'play' | 'over' = 'home';

  private constructor(scene: Scene) {
    this._scene = scene;
    this._world = new Node('World');
    scene.addChild(this._world);
    this._objGroup = new Node('ObjGroup');
    this._world.addChild(this._objGroup);
  }

  dispose(): void {
    input.off(Input.EventType.TOUCH_START, this._onTouchHover, this);
    input.off(Input.EventType.TOUCH_MOVE, this._onTouchHover, this);
    input.off(Input.EventType.TOUCH_END, this._onTouchEnd, this);
    input.off(Input.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
    this._unbindGyro();
    this._clearWorld();
    this._hud?.root.destroy();
    this._hud = null;
    if (this._flyCam?.node.isValid) this._flyCam.node.destroy();
    this._flyCam = null;
    this._world.destroy();
  }

  layoutChrome(): void {
    this._hud?.layout();
    if (this._flyCam?.isValid) {
      if (this._mainCam) this._flyCam.fov = this._mainCam.fov;
      applyPortraitCameraRect(this._flyCam);
    }
  }

  private _init(): void {
    this._mainCam = this._scene.getChildByName('Main Camera')?.getComponent(Camera) ?? null;
    this._uiCam = this._scene.getChildByName('Canvas')?.getChildByName('Camera')?.getComponent(Camera) ?? null;
    this._ensureFlyCam();
    if (PhysicsSystem.instance) {
      PhysicsSystem.instance.gravity = new Vec3(0, -10, 0);
      PhysicsSystem.instance.allowSleep = true;
      PhysicsSystem.instance.sleepThreshold = 0.4;
    } else {
      console.error('PickGeese: 3D physics is off. Enable physics-ammo in Project Settings.');
    }
    const canvas = this._scene.getChildByName('Canvas');
    if (canvas) {
      this._hud = new Hud(canvas, {
        onPlay: () => this._startFrom(0),
        onRetry: () => this._startFrom(this._level >= 2 && this._phase === 'over' && this._boxItems.length === 0 ? 1 : this._level),
        onHome: () => this._goHome(),
        onChaos: () => this._onChaos(),
        onMoveOut: () => this._onMoveOut(),
        onCollect: () => this._onCollect(),
      });
    }
    input.on(Input.EventType.TOUCH_START, this._onTouchHover, this);
    input.on(Input.EventType.TOUCH_MOVE, this._onTouchHover, this);
    input.on(Input.EventType.TOUCH_END, this._onTouchEnd, this);
    input.on(Input.EventType.TOUCH_CANCEL, this._onTouchCancel, this);
    this._bindGyro();
    this._goHome();
  }

  private _goHome(): void {
    this._phase = 'home';
    this._canOperate = false;
    this._clearWorld();
    this._hud?.showHome();
    void this._showHomeWorld();
  }

  private async _showHomeWorld(): Promise<void> {
    await preloadToyLit();
    const kinds: ItemKind[] = ['octopus', 'duck', 'icecream', 'crab', 'popsicle'];
    await preloadOriginModels(kinds);
    if (this._phase !== 'home') return;
    this._arena = createArena(this._world, 0.88);
    if (this._phase !== 'home') return;
    const spots = [
      new Vec3(0, 0.95, 0.1),
      new Vec3(-1.2, 0.82, 0.85),
      new Vec3(1.15, 0.84, 0.7),
      new Vec3(-0.85, 0.8, -0.75),
      new Vec3(0.95, 0.82, -0.7),
    ];
    for (let i = 0; i < kinds.length; i++) {
      const item = createItem(kinds[i], this._objGroup);
      item.node.setPosition(spots[i] ?? Vec3.ZERO);
      const q = new Quat();
      Quat.fromEuler(q, 0, 20 + i * 48, 0);
      item.node.setRotation(q);
      freezeItem(item);
      this._items.push(item);
    }
  }

  private _startFrom(level: number): void {
    void this._startFromAsync(level);
  }

  private async _startFromAsync(level: number): Promise<void> {
    this._level = Math.max(0, Math.min(level, LEVELS.length - 1));
    this._phase = 'play';
    this._canOperate = false;
    this._outLeft = 3;
    this._collectLeft = 2;
    this._chaosLeft = 2;
    this._selected.length = 0;
    this._outItems.length = 0;
    this._hover = null;
    this._clearWorld();
    const spec = LEVELS[this._level];
    this._hud?.showPlay(this._level);
    await preloadToyLit();
    await preloadOriginModels(spec.kinds);
    if (this._phase !== 'play') return;
    this._arena = createArena(this._world, spec.boxScale);
    this._spawnLevel();
    this._watchContain();
    this._hud?.setToolCounts(this._outLeft, this._collectLeft, this._chaosLeft);
    this._hud?.setSlots([]);
    this._hud?.setOutSlots([]);
    this._refreshCounts();
    const wait = this._level === 0 ? 0.25 : 1.85;
    this._delay(wait, () => {
      if (this._phase !== 'play') return;
      this._applyPileRoles(this._targetLive());
      this._canOperate = true;
      if (this._level === 0) this._hud?.tip('点箱里的物品，三个相同会消除');
    });
  }

  private _spawnLevel(): void {
    const spec = LEVELS[this._level];
    const kinds: ItemKind[] = [];
    const copies = Math.max(3, spec.copies - (spec.copies % 3));
    for (const k of spec.kinds) {
      for (let i = 0; i < copies; i++) kinds.push(k);
    }
    shuffle(kinds);
    this._total = kinds.length;
    if (this._level === 0) {
      const spots = [
        new Vec3(-1.35, 0.82, 0.05),
        new Vec3(0, 0.82, 0.05),
        new Vec3(1.35, 0.82, 0.05),
        new Vec3(-1.35, 0.82, 1.1),
        new Vec3(0, 0.82, 1.1),
        new Vec3(1.35, 0.82, 1.1),
        new Vec3(-1.35, 0.82, -0.95),
        new Vec3(0, 0.82, -0.95),
        new Vec3(1.35, 0.82, -0.95),
      ];
      for (let i = 0; i < kinds.length; i++) {
        const item = createItem(kinds[i], this._objGroup);
        item.node.setPosition(spots[i] ?? new Vec3((i % 3) - 1, 0.7, 0));
        const q = new Quat();
        Quat.fromEuler(q, 0, (i * 40) % 360, 0);
        item.node.setRotation(q);
        item.body.type = ERigidBodyType.STATIC;
        item.body.useGravity = false;
        this._items.push(item);
        this._boxItems.push(item);
      }
      return;
    }
    const n = kinds.length;
    const half = Math.max(0.8, crateLimitHalf - 0.16);
    for (let i = 0; i < n; i++) {
      const item = createItem(kinds[i], this._objGroup);
      const x = (Math.random() * 2 - 1) * half;
      const z = (Math.random() * 2 - 1) * half;
      const y = 0.82 + 2.35 * (i / n) + Math.random() * 0.28;
      item.node.setPosition(x, y, z);
      item.node.setRotation(pileQuat());
      setItemKinematic(item, false);
      this._items.push(item);
      this._boxItems.push(item);
    }
  }

  private _clearWorld(): void {
    this._offHover();
    for (const it of this._items) {
      if (it.node.isValid) it.node.destroy();
    }
    this._items.length = 0;
    this._boxItems.length = 0;
    this._selected.length = 0;
    this._outItems.length = 0;
    if (this._containNode?.isValid) {
      Tween.stopAllByTarget(this._containNode);
      this._containNode.destroy();
    }
    this._containNode = null;
    if (this._arena?.isValid) this._arena.destroy();
    this._arena = null;
    this._objGroup.removeAllChildren();
  }

  private _watchContain(): void {
    if (this._containNode?.isValid) {
      Tween.stopAllByTarget(this._containNode);
      this._containNode.destroy();
    }
    const n = new Node('contain');
    this._world.addChild(n);
    this._containNode = n;
    tween(n)
      .repeatForever(tween().delay(0.2).call(() => this._containBox()))
      .start();
  }

  /** Original gameStart: ~90 live on box 1, then pop 30 so ~60 stay DYNAMIC on the big box. */
  private _targetLive(): number {
    if (this._level <= 0) return 0;
    return this._level >= 2 ? 60 : 90;
  }

  private _liveDynamicCount(): number {
    let n = 0;
    for (const it of this._boxItems) {
      if (it.node.isValid && !it.buried && it.body.isValid && it.body.type === ERigidBodyType.DYNAMIC) n++;
    }
    return n;
  }

  private _pileItems(): GameItem[] {
    const pile: GameItem[] = [];
    for (const it of this._boxItems) {
      if (it.node.isValid && !it.buried) pile.push(it);
    }
    return pile;
  }

  private _applyPileRoles(live: number): void {
    if (this._level === 0) {
      this._restVisiblePile();
      return;
    }
    const pile = this._pileItems();
    pile.sort((a, b) => b.node.position.y - a.node.position.y);
    for (let i = 0; i < pile.length; i++) {
      if (i < live) setItemKinematic(pile[i], false);
      else freezeItem(pile[i]);
    }
  }

  private _restVisiblePile(): void {
    for (const it of this._boxItems) {
      if (!it.node.isValid || it.buried) continue;
      freezeItem(it);
    }
  }

  /** Original removeItemFromBox: remaining DYNAMIC keep falling; promote highest STATIC as the pile shrinks. */
  private _promoteAfterPick(): void {
    if (this._level === 0) return;
    const total = this._boxItems.length;
    const live = this._liveDynamicCount();
    let need = 0;
    if (total >= 150 && total < 300) {
      if (live < 50) need = 6;
    } else if (total >= 70 && total < 150) {
      if (live < 40) need = 40 - live;
    } else if (total < 70) {
      if (live < 30) need = 30 - live;
    }
    const bed: GameItem[] = [];
    for (const it of this._boxItems) {
      if (!it.node.isValid || it.buried || !it.body.isValid) continue;
      if (it.body.type === ERigidBodyType.DYNAMIC) it.body.wakeUp();
      else bed.push(it);
    }
    if (need <= 0) return;
    bed.sort((a, b) => a.node.position.y - b.node.position.y);
    for (let i = 0; i < need && bed.length > 0; i++) {
      const it = bed.pop();
      if (!it) break;
      setItemKinematic(it, false);
    }
  }

  private _containBox(): void {
    if (this._phase !== 'play') return;
    const half = crateLimitHalf;
    for (const it of this._boxItems) {
      if (!it.node.isValid || !it.body.isValid) continue;
      const p = it.node.position;
      if (p.x >= -half && p.x <= half && p.z >= -half && p.z <= half && p.y > 0.22) continue;
      it.node.setPosition(
        Math.max(-half, Math.min(half, p.x)),
        Math.max(0.55, p.y),
        Math.max(-half, Math.min(half, p.z)),
      );
      it.body.setLinearVelocity(Vec3.ZERO);
      it.body.setAngularVelocity(Vec3.ZERO);
    }
  }

  private _onTouchHover = (e: EventTouch): void => {
    if (!this._canOperate || this._phase !== 'play' || !this._inPlayField(e)) return;
    const item = this._hitItem(e);
    if (item === this._hover) return;
    this._offHover();
    if (item && (item.inBox || item.inOut)) {
      this._hover = item;
      item.node.setScale(this._baseScale(item).multiplyScalar(1.12));
    }
  };

  private _inPlayField(e: EventTouch): boolean {
    return e.getUILocation().y > 200;
  }

  private _onTouchEnd = (_e: EventTouch): void => {
    if (!this._canOperate || this._phase !== 'play') return;
    const item = this._hover;
    this._offHover();
    if (!item || (!item.inBox && !item.inOut)) return;
    this._pick(item);
  };

  private _onTouchCancel = (): void => {
    this._offHover();
  };

  private _offHover(): void {
    if (this._hover?.node.isValid) this._hover.node.setScale(this._baseScale(this._hover));
    this._hover = null;
  }

  private _baseScale(item: GameItem): Vec3 {
    if (item.inOut) return new Vec3(0.7, 0.7, 0.7);
    if (!item.inBox) return new Vec3(0.42, 0.42, 0.42);
    return new Vec3(1, 1, 1);
  }

  private _hitItem(e: EventTouch): GameItem | null {
    if (!this._mainCam) return null;
    const loc = e.getLocation();
    this._mainCam.screenPointToRay(loc.x, loc.y, _ray);
    const out: GameItem[] = [];
    const box: GameItem[] = [];
    for (let i = 0; i < this._items.length; i++) {
      const it = this._items[i];
      if (!it.node.isValid) continue;
      if (it.buried) continue;
      if (it.inOut) out.push(it);
      else if (it.inBox) box.push(it);
    }
    box.sort((a, b) => b.node.position.y - a.node.position.y);
    for (let i = 0; i < out.length; i++) {
      if (this._rayHitsMesh(out[i])) return out[i];
    }
    for (let i = 0; i < box.length; i++) {
      if (this._rayHitsMesh(box[i])) return box[i];
    }
    return null;
  }

  private _rayHitsMesh(item: GameItem): boolean {
    const vis = item.node.getChildByName('mesh') ?? item.node;
    const mr = vis.getComponent(MeshRenderer) ?? item.node.getComponentInChildren(MeshRenderer);
    const model = mr?.model;
    if (!model) return false;
    return !!geometry.intersect.rayModel(_ray, model);
  }

  private _pick(item: GameItem, ignoreFull = false): void {
    if (!ignoreFull && this._selected.length >= SLOT_COUNT) {
      this._hud?.tip('只剩一个格子了');
      return;
    }
    if (!item.inBox && !item.inOut) return;
    if (this._selected.includes(item)) return;

    const fromBox = item.inBox;
    this._removeFromBox(item);
    if (fromBox) this._promoteAfterPick();
    item.inBox = false;
    item.inOut = false;
    item.landed = false;
    setItemKinematic(item, true);
    this._disableCollider(item, true);

    let insert = this._selected.length;
    for (let i = this._selected.length - 1; i >= 0; i--) {
      if (this._selected[i].def.id === item.def.id) {
        insert = i + 1;
        break;
      }
    }
    this._selected.splice(insert, 0, item);
    this._refreshSlots();
    this._refreshCounts();
    if (this._selected.length === 6 && !this._hasTriple(this._selected)) {
      this._hud?.tip('只剩一个格子了');
    }

    setLayer(item.node, FLY_LAYER);
    item.flyDest = this._slotWorld(insert);
    this._flyTo(item, () => {
      item.landed = true;
      this._refreshSlots();
      this._clearThree(item);
    });
    this._slideSelected();
  }

  private _clearThree(landed: GameItem): void {
    const i = this._selected.indexOf(landed);
    if (i >= 2) {
      const a = this._selected[i - 2];
      const b = this._selected[i - 1];
      if (a.def.id === landed.def.id && b.def.id === landed.def.id) {
        this._playClear(i - 2);
        return;
      }
    }
    if (this._selected.length >= SLOT_COUNT && this._firstTripleStart() < 0) {
      this._lose();
    }
  }

  private _playClear(start: number): void {
    const gone = this._selected.splice(start, MATCH_COUNT);
    const mid = this._slotWorld(start + 1);
    this._refreshSlots();
    this._refreshCounts();
    const left = gone[0];
    const center = gone[1];
    const right = gone[2];
    const drop = (it: GameItem) => {
      if (it.node.isValid) it.node.destroy();
    };
    if (left.node.isValid) {
      Tween.stopAllByTarget(left.node);
      tween(left.node).to(0.16, { worldPosition: mid }).call(() => drop(left)).start();
    }
    if (right.node.isValid) {
      Tween.stopAllByTarget(right.node);
      tween(right.node).to(0.16, { worldPosition: mid }).call(() => drop(right)).start();
    }
    if (center.node.isValid) {
      Tween.stopAllByTarget(center.node);
      tween(center.node)
        .by(0.16, { scale: new Vec3(0.2, 0.2, 0.2) }, { easing: 'sineOut' })
        .to(0.08, { scale: new Vec3(0.08, 0.08, 0.08) })
        .call(() => {
          drop(center);
          this._slideSelected();
          this._delay(0.05, () => this._checkWin());
        })
        .start();
    } else {
      this._slideSelected();
      this._delay(0.05, () => this._checkWin());
    }
    for (const it of gone) {
      const idx = this._items.indexOf(it);
      if (idx >= 0) this._items.splice(idx, 1);
    }
  }

  private _firstTripleStart(): number {
    let run = 1;
    for (let i = 1; i < this._selected.length; i++) {
      if (this._selected[i].def.id === this._selected[i - 1].def.id) {
        run++;
        if (run >= MATCH_COUNT) return i - MATCH_COUNT + 1;
      } else run = 1;
    }
    return -1;
  }

  private _hasTriple(arr: GameItem[]): boolean {
    let run = 1;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i].def.id === arr[i - 1].def.id) {
        if (++run >= MATCH_COUNT) return true;
      } else run = 1;
    }
    return false;
  }

  private _slideSelected(): void {
    for (let i = 0; i < this._selected.length; i++) {
      const it = this._selected[i];
      const dest = this._slotWorld(i);
      it.flyDest = dest;
      if (!it.landed || !it.node.isValid) continue;
      Tween.stopAllByTarget(it.node);
      tween(it.node).to(0.4, { worldPosition: dest }, { easing: 'quartInOut' }).start();
    }
  }

  private _flyTo(item: GameItem, done: () => void): void {
    const node = item.node;
    const cam = this._mainCam;
    const dest0 = item.flyDest ?? node.worldPosition.clone();
    if (!cam) {
      node.setWorldPosition(dest0);
      done();
      return;
    }

    const from = node.worldPosition.clone();
    const fromScreen = cam.worldToScreen(from, new Vec3());
    const fromDist = Math.max(1, Vec3.distance(cam.node.worldPosition, from));
    const fromRot = node.worldRotation.clone();
    const toRot = new Quat();
    Quat.fromEuler(toRot, -70, 10, 0);
    const q = new Quat();

    const icon = this._slotIconScale(item, dest0);
    Tween.stopAllByTarget(node);
    tween(node)
      .to(0.2, { scale: new Vec3(2, 2, 2) })
      .delay(0.1)
      .to(0.2, { scale: new Vec3(icon, icon, icon) })
      .start();
    tween(node)
      .delay(0.1)
      .to(0.35, {}, {
        onUpdate: (_o, r) => {
          if (!node.isValid) return;
          Quat.slerp(q, fromRot, toRot, r);
          node.setWorldRotation(q);
        },
      })
      .start();

    const drive = { t: 0 };
    const toScreen = new Vec3();
    tween(drive)
      .delay(0.08)
      .to(0.5, { t: 1 }, {
        easing: 'quartInOut',
        onUpdate: () => {
          if (!node.isValid || !cam.node.isValid) return;
          const dest = item.flyDest ?? dest0;
          cam.worldToScreen(dest, toScreen);
          const toDist = Math.max(1.6, Vec3.distance(cam.node.worldPosition, dest));
          const u = drive.t;
          cam.screenPointToRay(
            fromScreen.x + (toScreen.x - fromScreen.x) * u,
            fromScreen.y + (toScreen.y - fromScreen.y) * u,
            _ray,
          );
          const dist = fromDist + (toDist - fromDist) * u;
          node.setWorldPosition(
            _ray.o.x + _ray.d.x * dist,
            _ray.o.y + _ray.d.y * dist,
            _ray.o.z + _ray.d.z * dist,
          );
        },
      })
      .call(() => {
        if (node.isValid) node.setScale(icon, icon, icon);
        done();
      })
      .start();
  }

  private _slotIconScale(item: GameItem, dest: Vec3): number {
    const cam = this._mainCam;
    if (!cam) return 0.2;
    const dist = Math.max(2.8, Vec3.distance(cam.node.worldPosition, dest));
    const visH = this._hud?.root.getComponent(UITransform)?.height ?? portraitVisibleSize().height;
    const half = Math.tan((cam.fov * Math.PI) / 360);
    const worldFit = (86 / Math.max(visH, 1)) * (2 * dist * half);
    const mesh = Math.max(0.2, item.def.size * 2.15);
    return Math.max(0.07, Math.min(0.32, worldFit / mesh));
  }

  private _slotWorld(index: number): Vec3 {
    const dist = 6.1;
    const fallback = new Vec3((index - 3) * 0.72, 4.2, 6.4);
    const slot = this._hud?.slotNode(index);
    if (!slot || !this._mainCam || !this._uiCam) return fallback;
    const uiW = new Vec3();
    slot.getWorldPosition(uiW);
    const screen = this._uiCam.worldToScreen(uiW, new Vec3());
    this._mainCam.screenPointToRay(screen.x, screen.y, _ray);
    return new Vec3(
      _ray.o.x + _ray.d.x * dist,
      _ray.o.y + _ray.d.y * dist,
      _ray.o.z + _ray.d.z * dist,
    );
  }

  private _ensureFlyCam(): void {
    if (this._flyCam?.isValid || !this._mainCam) return;
    const n = new Node('FlyCam');
    this._mainCam.node.addChild(n);
    const cam = n.addComponent(Camera);
    cam.projection = this._mainCam.projection;
    cam.fov = this._mainCam.fov;
    cam.near = this._mainCam.near;
    cam.far = this._mainCam.far;
    cam.priority = 20;
    cam.clearFlags = Camera.ClearFlag.DEPTH_ONLY;
    cam.visibility = FLY_LAYER;
    applyPortraitCameraRect(cam);
    this._flyCam = cam;
    this._mainCam.visibility = this._mainCam.visibility & ~FLY_LAYER;
  }

  private _removeFromBox(item: GameItem): void {
    const a = this._boxItems.indexOf(item);
    if (a >= 0) this._boxItems.splice(a, 1);
    const b = this._outItems.indexOf(item);
    if (b >= 0) this._outItems.splice(b, 1);
  }

  private _disableCollider(item: GameItem, off: boolean): void {
    const cols = item.node.getComponentsInChildren(Collider);
    for (const c of cols) c.enabled = !off;
  }

  private _onChaos(): void {
    if (!this._canOperate) return;
    if (this._chaosLeft <= 0) {
      this._hud?.tip('打乱次数用完了');
      return;
    }
    if (this._boxItems.length === 0) {
      this._hud?.tip('没有可打乱的物品');
      return;
    }
    this._chaosLeft--;
    this._hud?.setToolCounts(this._outLeft, this._collectLeft, this._chaosLeft);
    this._canOperate = false;
    const half = Math.max(0.8, crateLimitHalf - 0.16);
    shuffle(this._boxItems);
    const n = Math.max(1, this._boxItems.length);
    for (let i = 0; i < this._boxItems.length; i++) {
      const it = this._boxItems[i];
      if (!it.node.isValid) continue;
      setItemKinematic(it, false);
      it.node.setPosition(
        (Math.random() * 2 - 1) * half,
        0.82 + 2.0 * (i / n) + Math.random() * 0.22,
        (Math.random() * 2 - 1) * half,
      );
      it.node.setRotation(pileQuat());
      it.body.wakeUp();
    }
    this._hud?.tip('打乱！');
    this._delay(1.6, () => {
      if (this._phase !== 'play') return;
      this._applyPileRoles(this._targetLive());
      this._canOperate = true;
    });
  }

  private _bindGyro(): void {
    const motion = (Input.EventType as { DEVICEMOTION?: number }).DEVICEMOTION;
    const api = input as { setAccelerometerEnabled?: (on: boolean) => void };
    if (motion === undefined || !api.setAccelerometerEnabled) return;
    api.setAccelerometerEnabled(true);
    input.on(motion, this._onMotion, this);
  }

  private _unbindGyro(): void {
    const motion = (Input.EventType as { DEVICEMOTION?: number }).DEVICEMOTION;
    const api = input as { setAccelerometerEnabled?: (on: boolean) => void };
    if (motion === undefined) return;
    input.off(motion, this._onMotion, this);
    api.setAccelerometerEnabled?.(false);
  }

  private _onMotion = (e: { acc?: { x: number; y: number; z: number } }): void => {
    const a = e.acc;
    if (!a) return;
    if (Math.abs(a.x) > 1.6 || Math.abs(a.y) > 1.6 || Math.abs(a.z) > 1.6) {
      this._onShake();
    }
  };

  private _onShake(): void {
    if (!this._canOperate || !this._shakeReady || this._level < 1) return;
    this._shakeReady = false;
    const live: GameItem[] = [];
    for (const it of this._boxItems) {
      if (!it.node.isValid || it.buried || !it.body.isValid) continue;
      if (it.body.type !== ERigidBodyType.DYNAMIC) continue;
      live.push(it);
    }
    const n = Math.max(1, live.length);
    for (const it of live) {
      it.body.wakeUp();
      const f = new Vec3((Math.random() - 0.5) * 8, 4 + Math.random() * 4, (Math.random() - 0.5) * 8);
      f.multiplyScalar(2.2 + Math.min(n, 80) * 0.02);
      it.body.applyForce(f);
    }
    this._delay(1.2, () => {
      this._shakeReady = true;
    });
  }

  private _onMoveOut(): void {
    if (!this._canOperate) return;
    if (this._outLeft <= 0) {
      this._hud?.tip('移出次数用完了');
      return;
    }
    if (this._selected.length === 0) {
      this._hud?.tip('没有可移出的物品');
      return;
    }
    const n = Math.min(3, this._selected.length);
    const moved = this._selected.splice(0, n);
    this._outLeft--;
    this._hud?.setToolCounts(this._outLeft, this._collectLeft, this._chaosLeft);
    for (let i = 0; i < moved.length; i++) {
      const it = moved[i];
      it.inOut = true;
      it.inBox = false;
      it.landed = true;
      this._outItems.push(it);
      setLayer(it.node, Layers.Enum.DEFAULT);
      it.node.active = true;
      this._disableCollider(it, false);
      Tween.stopAllByTarget(it.node);
      const dest = new Vec3(-4.2 + (i % 3) * 0.85, 0.7 + Math.floor(i / 3) * 0.55, 3.4);
      tween(it.node).to(0.28, { worldPosition: dest, scale: new Vec3(0.7, 0.7, 0.7) }).start();
    }
    this._refreshSlots();
    this._hud?.setOutSlots(this._outItems.map((it) => it.def.id));
    this._refreshCounts();
    this._slideSelected();
  }

  private _onCollect(): void {
    if (!this._canOperate) return;
    if (this._collectLeft <= 0) {
      this._hud?.tip('凑齐次数用完了');
      return;
    }
    if (this._selected.length === 0) {
      this._hud?.tip('没有可凑齐的物品');
      return;
    }
    const pick = this._selected[Math.floor(Math.random() * this._selected.length)];
    const id = pick.def.id;
    let have = 0;
    for (const it of this._selected) if (it.def.id === id) have++;
    const need = MATCH_COUNT - (have % MATCH_COUNT || MATCH_COUNT);
    if (need <= 0) return;
    const extra: GameItem[] = [];
    for (const it of this._boxItems) {
      if (it.def.id === id) {
        extra.push(it);
        if (extra.length >= need) break;
      }
    }
    if (extra.length < need) {
      this._hud?.tip(`箱里没有足够的${ITEM_DEFS[id].name}`);
      return;
    }
    this._collectLeft--;
    this._hud?.setToolCounts(this._outLeft, this._collectLeft, this._chaosLeft);
    for (const it of extra) this._pick(it, true);
  }

  private _checkWin(): void {
    if (this._boxItems.length === 0 && this._selected.length === 0 && this._outItems.length === 0) {
      if (this._level < LEVELS.length - 1) {
        const next = this._level + 1;
        this._hud?.tip(next === 1 ? '教程完成，进入第一箱' : '下一箱更大了');
        this._delay(0.7, () => this._startFrom(next));
      } else {
        this._phase = 'over';
        this._canOperate = false;
        this._hud?.showWin();
      }
    }
  }

  private _lose(): void {
    this._phase = 'over';
    this._canOperate = false;
    this._hud?.showLose();
  }

  private _refreshSlots(): void {
    this._hud?.setSlots(this._selected.map(() => null));
    this._hud?.setOutSlots(this._outItems.map((it) => it.def.id));
  }

  private _refreshCounts(): void {
    this._hud?.setRemain(this._boxItems.length, this._selected.length, this._total);
  }

  private _delay(sec: number, fn: () => void): void {
    const n = new Node('delay');
    this._world.addChild(n);
    tween(n).delay(sec).call(() => {
      fn();
      if (n.isValid) n.destroy();
    }).start();
  }
}

function setLayer(node: Node, layer: number): void {
  node.layer = layer;
  for (const c of node.children) setLayer(c, layer);
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
}

