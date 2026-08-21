import { Button, Color, Graphics, Label, Node, UIOpacity, UITransform } from 'cc';
import { Theme } from './Theme';
import { label, markUi, uiNode } from './UiKit';

export type WoodToolKind = 'out' | 'collect' | 'chaos';

const GRAIN = new Color(255, 180, 220, 40);
const HIGH = new Color(255, 255, 255, 90);
const WELL = new Color(255, 168, 214, 255);
const WELL_IN = new Color(255, 240, 248, 255);
const CANDY_RIM = new Color(255, 128, 196, 255);
const CANDY_MID = new Color(255, 214, 236, 255);
const CANDY_FACE = new Color(255, 248, 252, 255);

export function paintWoodBoard(node: Node, w: number, h: number, radius = 18): void {
  node.getComponent(UITransform)?.setContentSize(w, h);
  const g = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  g.clear();
  const hw = w * 0.5;
  const hh = h * 0.5;
  g.fillColor = new Color(255, 120, 196, 70);
  g.roundRect(-hw + 8, -hh - 10, w, h, radius);
  g.fill();
  g.fillColor = CANDY_RIM;
  g.roundRect(-hw, -hh, w, h, radius);
  g.fill();
  g.fillColor = CANDY_MID;
  g.roundRect(-hw + 4, -hh + 4, w - 8, h - 10, radius - 3);
  g.fill();
  g.fillColor = CANDY_FACE;
  g.roundRect(-hw + 8, -hh + 10, w - 16, h - 20, radius - 5);
  g.fill();
  g.strokeColor = GRAIN;
  g.lineWidth = 3;
  for (let i = -2; i <= 2; i++) {
    const y = i * h * 0.14;
    g.moveTo(-hw + 28, y);
    g.lineTo(hw - 28, y);
    g.stroke();
  }
  g.fillColor = HIGH;
  g.roundRect(-hw + 14, hh - 32, w - 28, 14, 7);
  g.fill();
}

export function paintWoodWell(node: Node, size: number): void {
  node.getComponent(UITransform)?.setContentSize(size, size);
  const g = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  g.clear();
  const h = size * 0.5;
  g.fillColor = Theme.woodRim;
  g.roundRect(-h, -h, size, size, 16);
  g.fill();
  g.fillColor = WELL;
  g.roundRect(-h + 5, -h + 5, size - 10, size - 10, 12);
  g.fill();
  g.fillColor = WELL_IN;
  g.roundRect(-h + 10, -h + 10, size - 20, size - 20, 10);
  g.fill();
}

export function paintWoodToken(node: Node, kind: WoodToolKind): void {
  const size = 128;
  node.getComponent(UITransform)?.setContentSize(size, size);
  const g = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  g.clear();
  const r = 62;
  const skin = kind === 'out'
    ? new Color(80, 220, 255, 255)
    : kind === 'collect'
      ? new Color(255, 110, 196, 255)
      : new Color(255, 206, 72, 255);
  const skinDeep = kind === 'out'
    ? new Color(40, 170, 220, 255)
    : kind === 'collect'
      ? new Color(230, 70, 160, 255)
      : new Color(236, 168, 36, 255);
  g.fillColor = new Color(255, 120, 196, 60);
  g.circle(3, -5, r);
  g.fill();
  g.fillColor = Color.WHITE;
  g.circle(0, 0, r);
  g.fill();
  g.fillColor = skinDeep;
  g.circle(0, 0, 54);
  g.fill();
  g.fillColor = skin;
  g.circle(0, 2, 46);
  g.fill();
  g.fillColor = HIGH;
  g.circle(-10, 16, 10);
  g.fill();
  paintToolIcon(g, kind);
}

function paintToolIcon(g: Graphics, kind: WoodToolKind): void {
  const ink = Theme.ink;
  g.strokeColor = ink;
  g.fillColor = ink;
  g.lineWidth = 6;
  g.lineJoin = Graphics.LineJoin.ROUND;
  g.lineCap = Graphics.LineCap.ROUND;
  if (kind === 'out') {
    g.roundRect(-18, -16, 26, 22, 4);
    g.stroke();
    g.moveTo(-2, -4);
    g.lineTo(22, 14);
    g.stroke();
    g.moveTo(10, 16);
    g.lineTo(22, 14);
    g.lineTo(18, 4);
    g.stroke();
  } else if (kind === 'collect') {
    g.circle(-12, -6, 9);
    g.fill();
    g.circle(12, -6, 9);
    g.fill();
    g.circle(0, 12, 9);
    g.fill();
  } else {
    g.arc(0, 0, 16, 0.4, 3.2, false);
    g.stroke();
    g.arc(0, 0, 16, 3.5, 6.0, false);
    g.stroke();
    g.moveTo(14, 8);
    g.lineTo(18, 2);
    g.lineTo(8, 2);
    g.stroke();
    g.moveTo(-14, -8);
    g.lineTo(-18, -2);
    g.lineTo(-8, -2);
    g.stroke();
  }
}

export function woodTool(
  parent: Node,
  name: string,
  kind: WoodToolKind,
  title: string,
  onClick: () => void,
): Node {
  const root = uiNode(name, parent, 156, 190);
  const disc = uiNode('disc', root, 128, 128);
  disc.setPosition(0, 24, 0);
  paintWoodToken(disc, kind);
  const btn = disc.addComponent(Button);
  btn.transition = Button.Transition.SCALE;
  btn.zoomScale = 0.92;
  disc.on(Button.EventType.CLICK, onClick, disc);
  const badge = uiNode('badge', disc, 40, 40);
  badge.setPosition(42, 42, 0);
  const bg = badge.addComponent(Graphics);
  bg.fillColor = new Color(255, 92, 168, 255);
  bg.circle(0, 0, 18);
  bg.fill();
  const cnt = label(badge, 'cnt', '', 22, Theme.cream, 36, 32);
  cnt.node.setPosition(0, 0, 0);
  const titleLb = label(root, 'title', title, 30, Theme.ink, 156, 40);
  titleLb.node.setPosition(0, -74, 0);
  root.addComponent(UIOpacity);
  return root;
}

export function setToolCount(root: Node, n: number): void {
  const cnt = root.getChildByName('disc')?.getChildByName('badge')?.getChildByName('cnt')?.getComponent(Label);
  if (cnt) cnt.string = `${Math.max(0, n)}`;
  const op = root.getComponent(UIOpacity);
  if (op) op.opacity = n > 0 ? 255 : 120;
}

export function markUiDeep(node: Node): void {
  markUi(node);
  for (const c of node.children) markUiDeep(c);
}
