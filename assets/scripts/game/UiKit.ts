import {
  BlockInputEvents,
  Button,
  Color,
  Graphics,
  Label,
  LabelOutline,
  Layers,
  Node,
  UIOpacity,
  UITransform,
  Widget,
} from 'cc';

export function markUi(node: Node): void {
  node.layer = Layers.Enum.UI_2D;
}

export function uiNode(name: string, parent?: Node, w = 100, h = 100): Node {
  const n = new Node(name);
  markUi(n);
  const t = n.addComponent(UITransform);
  t.setContentSize(w, h);
  t.setAnchorPoint(0.5, 0.5);
  if (parent) parent.addChild(n);
  return n;
}

export function fill(node: Node, color: Color, radius = 0): Graphics {
  let g = node.getComponent(Graphics);
  if (!g) g = node.addComponent(Graphics);
  const t = node.getComponent(UITransform)!;
  const w = t.width;
  const h = t.height;
  g.clear();
  g.fillColor = color;
  if (radius > 0) g.roundRect(-w * 0.5, -h * 0.5, w, h, radius);
  else g.rect(-w * 0.5, -h * 0.5, w, h);
  g.fill();
  return g;
}

export function stroke(node: Node, color: Color, line = 6, radius = 16): Graphics {
  const g = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  const t = node.getComponent(UITransform)!;
  const w = t.width;
  const h = t.height;
  g.strokeColor = color;
  g.lineWidth = line;
  g.roundRect(-w * 0.5, -h * 0.5, w, h, radius);
  g.stroke();
  return g;
}

export function label(
  parent: Node,
  name: string,
  text: string,
  size: number,
  color: Color,
  w = 400,
  h = 80,
): Label {
  const n = uiNode(name, parent, w, h);
  const lb = n.addComponent(Label);
  lb.string = text;
  lb.fontSize = size;
  lb.lineHeight = size + 6;
  lb.color = color;
  lb.overflow = Label.Overflow.SHRINK;
  lb.horizontalAlign = Label.HorizontalAlign.CENTER;
  lb.verticalAlign = Label.VerticalAlign.CENTER;
  const ol = n.addComponent(LabelOutline);
  ol.color = new Color(255, 140, 200, 70);
  ol.width = 2;
  return lb;
}

export function button(
  parent: Node,
  name: string,
  text: string,
  w: number,
  h: number,
  bg: Color,
  fg: Color,
  onClick: () => void,
): Node {
  const n = uiNode(name, parent, w, h);
  fill(n, bg, 22);
  const lb = label(n, 'txt', text, Math.min(40, Math.floor(h * 0.42)), fg, w - 20, h - 8);
  lb.node.setPosition(0, 0, 0);
  const btn = n.addComponent(Button);
  btn.transition = Button.Transition.SCALE;
  btn.zoomScale = 0.94;
  n.on(Button.EventType.CLICK, onClick, n);
  return n;
}

export function fullWidget(node: Node): Widget {
  const w = node.getComponent(Widget) ?? node.addComponent(Widget);
  w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
  w.top = w.bottom = w.left = w.right = 0;
  w.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
  return w;
}

export function dimOverlay(parent: Node, name: string): Node {
  const n = uiNode(name, parent, 1080, 1920);
  fill(n, new Color(30, 16, 8, 170));
  n.addComponent(BlockInputEvents);
  n.addComponent(UIOpacity);
  fullWidget(n);
  return n;
}
