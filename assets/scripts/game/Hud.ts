import { Color, Label, Node, UIOpacity, UITransform, Vec3, tween } from 'cc';
import { ItemKind, LEVELS } from './ItemDef';
import { bindSlotModel } from './OriginModels';
import { DESIGN_H, DESIGN_W, SLOT_COUNT, Theme } from './Theme';
import { button, dimOverlay, fill, label, stroke, uiNode } from './UiKit';
import { paintWoodBoard, paintWoodWell, setToolCount, woodTool } from './WoodUi';
import { portraitVisibleSize } from './PortraitFit';

export type HudHandlers = {
  onPlay: () => void;
  onRetry: () => void;
  onHome: () => void;
  onChaos: () => void;
  onMoveOut: () => void;
  onCollect: () => void;
};

type SlotChip = {
  root: Node;
};

export class Hud {
  readonly root: Node;
  private readonly _home: Node;
  private readonly _play: Node;
  private readonly _over: Node;
  private readonly _win: Node;
  private readonly _tips: Label;
  private readonly _levelLb: Label;
  private readonly _slots: SlotChip[] = [];
  private readonly _slotBar: Node;
  private readonly _outBar: Node;
  private readonly _outChips: SlotChip[] = [];
  private readonly _toolOut: Node;
  private readonly _toolCollect: Node;
  private readonly _toolChaos: Node;
  private readonly _outCount: Label;
  private readonly _flyLayer: Node;
  private readonly _handlers: HudHandlers;

  constructor(canvas: Node, handlers: HudHandlers) {
    this._handlers = handlers;
    this.root = uiNode('Hud', canvas, DESIGN_W, DESIGN_H);
    this._home = this._buildHome();
    this._play = this._buildPlay();
    this._over = this._buildOver(false);
    this._win = this._buildOver(true);
    const tipN = uiNode('Tips', this.root, 720, 70);
    tipN.setPosition(0, 220, 0);
    this._tips = label(tipN, 't', '', 36, Theme.ink, 720, 70);
    tipN.active = false;
    this.showHome();
    this.layout();
  }

  layout(): void {
    const vis = portraitVisibleSize();
    const ui = this.root.getComponent(UITransform);
    if (ui) ui.setContentSize(vis.width, vis.height);
    this._home.getComponent(UITransform)?.setContentSize(vis.width, vis.height);
    this._play.getComponent(UITransform)?.setContentSize(vis.width, vis.height);
    this._over.getComponent(UITransform)?.setContentSize(vis.width, vis.height);
    this._win.getComponent(UITransform)?.setContentSize(vis.width, vis.height);
    const top = vis.height * 0.5 - 90;
    this._levelLb.node.parent!.setPosition(0, top, 0);
    this._slotBar.setPosition(0, -vis.height * 0.5 + 268, 0);
    this._outBar.setPosition(0, -vis.height * 0.5 + 430, 0);
    const toolY = -vis.height * 0.5 + 96;
    this._toolOut.setPosition(-300, toolY, 0);
    this._toolCollect.setPosition(0, toolY, 0);
    this._toolChaos.setPosition(300, toolY, 0);
    this._flyLayer.getComponent(UITransform)?.setContentSize(vis.width, vis.height);
    this._flyLayer.setSiblingIndex(this._play.children.length - 1);
  }

  flyHost(): Node {
    return this._flyLayer;
  }

  slotUiPos(index: number, out = new Vec3()): Vec3 {
    const slot = this._slots[index]?.root;
    const ui = this._flyLayer.getComponent(UITransform);
    if (!slot || !ui) {
      return out.set((index - 3) * 128, -720, 0);
    }
    ui.convertToNodeSpaceAR(slot.worldPosition, out);
    return out;
  }

  showHome(): void {
    this._home.active = true;
    this._play.active = false;
    this._over.active = false;
    this._win.active = false;
  }

  showPlay(level: number): void {
    this._home.active = false;
    this._play.active = true;
    this._over.active = false;
    this._win.active = false;
    this._levelLb.string = LEVELS[level]?.title ?? `第${level + 1}箱`;
    this.setToolsVisible(level > 0);
    this.layout();
  }

  showWin(): void {
    this._win.active = true;
    this._over.active = false;
  }

  showLose(): void {
    this._over.active = true;
    this._win.active = false;
  }

  setRemain(_box: number, _selected: number, _total: number): void {
    void _box;
    void _selected;
    void _total;
  }

  setToolsVisible(on: boolean): void {
    this._toolOut.active = on;
    this._toolCollect.active = on;
    this._toolChaos.active = on;
  }

  setToolCounts(outLeft: number, collectLeft: number, chaosLeft = 2): void {
    setToolCount(this._toolOut, outLeft);
    setToolCount(this._toolCollect, collectLeft);
    setToolCount(this._toolChaos, chaosLeft);
  }

  slotNode(index: number): Node | null {
    return this._slots[index]?.root ?? null;
  }

  setSlots(ids: Array<ItemKind | null>): void {
    for (let i = 0; i < SLOT_COUNT; i++) {
      bindSlotModel(this._slots[i].root, ids[i] ?? null, 82);
    }
  }

  setOutSlots(ids: ItemKind[]): void {
    this._outBar.active = ids.length > 0;
    this._outCount.string = ids.length ? `暂存 ${ids.length}` : '';
    for (let i = 0; i < 3; i++) {
      bindSlotModel(this._outChips[i].root, ids[i] ?? null, 68);
    }
  }

  tip(text: string): void {
    const n = this._tips.node.parent!;
    n.active = true;
    this._tips.string = text;
    const op = n.getComponent(UIOpacity) ?? n.addComponent(UIOpacity);
    op.opacity = 255;
    tween(op).stop();
    tween(op).delay(1.15).to(0.28, { opacity: 0 }).call(() => {
      n.active = false;
    }).start();
  }

  private _buildHome(): Node {
    const n = uiNode('Home', this.root, DESIGN_W, DESIGN_H);
    const card = uiNode('Card', n, 860, 640);
    card.setPosition(0, 220, 0);
    fill(card, Theme.panel, 36);
    stroke(card, Theme.slotStroke, 8, 36);
    const t1 = label(card, 't1', '抓大鹅', 92, Theme.accent, 760, 120);
    t1.node.setPosition(0, 170, 0);
    const t2 = label(card, 't2', '捡了个啥', 48, Theme.ink, 760, 70);
    t2.node.setPosition(0, 78, 0);
    const t3 = label(card, 't3', '点选箱中物品，三个相同即可消除\n栏满七格且凑不齐就失败', 30, Theme.ink, 760, 120);
    t3.node.setPosition(0, -20, 0);
    t3.overflow = Label.Overflow.RESIZE_HEIGHT;
    const play = button(card, 'play', '开始抓', 420, 120, Theme.accent, Color.WHITE, () => this._handlers.onPlay());
    play.setPosition(0, -180, 0);
    return n;
  }

  private _buildPlay(): Node {
    const n = uiNode('Play', this.root, DESIGN_W, DESIGN_H);
    const lvWrap = uiNode('LvWrap', n, 360, 72);
    paintWoodBoard(lvWrap, 360, 72, 14);
    this._levelLb = label(lvWrap, 'lv', '第一箱', 36, Theme.ink, 320, 56);

    this._slotBar = uiNode('SlotBar', n, 1020, 176);
    paintWoodBoard(this._slotBar, 1020, 176, 22);
    const gap = 132;
    const start = -((SLOT_COUNT - 1) * gap) * 0.5;
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slot = uiNode(`s${i}`, this._slotBar, 116, 116);
      slot.setPosition(start + i * gap, 4, 0);
      paintWoodWell(slot, 116);
      this._slots.push({ root: slot });
    }

    this._outBar = uiNode('OutBar', n, 520, 128);
    paintWoodBoard(this._outBar, 520, 128, 16);
    this._outBar.active = false;
    this._outCount = label(this._outBar, 'cnt', '', 24, Theme.ink, 200, 32);
    this._outCount.node.setPosition(0, 44, 0);
    for (let i = 0; i < 3; i++) {
      const slot = uiNode(`o${i}`, this._outBar, 88, 88);
      slot.setPosition(-140 + i * 140, -10, 0);
      paintWoodWell(slot, 88);
      this._outChips.push({ root: slot });
    }

    this._toolOut = woodTool(n, 'out', 'out', '移出', () => this._handlers.onMoveOut());
    this._toolCollect = woodTool(n, 'col', 'collect', '凑齐', () => this._handlers.onCollect());
    this._toolChaos = woodTool(n, 'chaos', 'chaos', '打乱', () => this._handlers.onChaos());
    this._flyLayer = uiNode('FlyLayer', n, DESIGN_W, DESIGN_H);
    return n;
  }

  private _buildOver(win: boolean): Node {
    const n = dimOverlay(this.root, win ? 'Win' : 'Lose');
    n.active = false;
    const card = uiNode('Card', n, 780, 560);
    fill(card, Theme.panel, 32);
    stroke(card, Theme.slotStroke, 8, 32);
    const title = label(card, 't', win ? '箱子清空了！' : '格子满了…', 56, win ? Theme.accent : Theme.ink, 700, 90);
    title.node.setPosition(0, 150, 0);
    const sub = label(card, 's', win ? '箱子里的东西都被你捡走了' : '三个相同才能消掉，再试一次', 30, Theme.ink, 680, 80);
    sub.node.setPosition(0, 60, 0);
    const again = button(card, 'again', win ? '再来一箱' : '重新抓', 360, 110, Theme.accent, Color.WHITE, () => this._handlers.onRetry());
    again.setPosition(0, -70, 0);
    const home = button(card, 'home', '回首页', 360, 90, Theme.wood, Color.WHITE, () => this._handlers.onHome());
    home.setPosition(0, -200, 0);
    return n;
  }
}
