import { Color } from 'cc';

export type ItemKind =
  | 'duck'
  | 'volleyball'
  | 'icecream'
  | 'turtle'
  | 'crab'
  | 'shell'
  | 'starfish'
  | 'seahorse'
  | 'conch'
  | 'polaroid'
  | 'popsicle'
  | 'octopus';

export type ItemCollider = 'sphere' | 'box';

export type ItemDef = {
  id: ItemKind;
  name: string;
  color: Color;
  accent: Color;
  collider: ItemCollider;
  size: number;
  mass: number;
  /** Geometry json under resources/models */
  model: string;
};

export const ITEM_DEFS: Record<ItemKind, ItemDef> = {
  duck: {
    id: 'duck',
    name: '小黄鸭',
    color: new Color(246, 196, 48, 255),
    accent: new Color(236, 140, 36, 255),
    collider: 'sphere',
    size: 0.48,
    mass: 1.1,
    model: '511_YellowDuck',
  },
  volleyball: {
    id: 'volleyball',
    name: '排球',
    color: new Color(240, 232, 196, 255),
    accent: new Color(48, 120, 200, 255),
    collider: 'sphere',
    size: 0.5,
    mass: 1.15,
    model: '502_Volleyball',
  },
  icecream: {
    id: 'icecream',
    name: '冰淇淋',
    color: new Color(255, 168, 176, 255),
    accent: new Color(139, 90, 43, 255),
    collider: 'sphere',
    size: 0.42,
    mass: 0.85,
    model: '504_IceCream',
  },
  turtle: {
    id: 'turtle',
    name: '小海龟',
    color: new Color(72, 150, 88, 255),
    accent: new Color(48, 96, 56, 255),
    collider: 'sphere',
    size: 0.5,
    mass: 1.25,
    model: '516_Turtle',
  },
  crab: {
    id: 'crab',
    name: '小螃蟹',
    color: new Color(220, 72, 56, 255),
    accent: new Color(160, 40, 32, 255),
    collider: 'sphere',
    size: 0.46,
    mass: 1.05,
    model: '513_Crab',
  },
  shell: {
    id: 'shell',
    name: '贝壳',
    color: new Color(236, 196, 168, 255),
    accent: new Color(196, 140, 108, 255),
    collider: 'sphere',
    size: 0.4,
    mass: 0.9,
    model: '520_Shell',
  },
  starfish: {
    id: 'starfish',
    name: '海星',
    color: new Color(232, 120, 72, 255),
    accent: new Color(196, 80, 40, 255),
    collider: 'sphere',
    size: 0.42,
    mass: 0.85,
    model: '514_Starfish',
  },
  seahorse: {
    id: 'seahorse',
    name: '海马',
    color: new Color(232, 168, 72, 255),
    accent: new Color(180, 112, 40, 255),
    collider: 'box',
    size: 0.4,
    mass: 0.8,
    model: '525_Seahorse',
  },
  conch: {
    id: 'conch',
    name: '海螺',
    color: new Color(196, 132, 96, 255),
    accent: new Color(232, 188, 164, 255),
    collider: 'sphere',
    size: 0.44,
    mass: 1.0,
    model: '512_Conch',
  },
  polaroid: {
    id: 'polaroid',
    name: '拍立得',
    color: new Color(236, 236, 232, 255),
    accent: new Color(48, 48, 48, 255),
    collider: 'box',
    size: 0.4,
    mass: 0.95,
    model: '506_Polaroid',
  },
  popsicle: {
    id: 'popsicle',
    name: '冰棒',
    color: new Color(80, 196, 220, 255),
    accent: new Color(232, 196, 140, 255),
    collider: 'box',
    size: 0.38,
    mass: 0.75,
    model: '522_Popsicles',
  },
  octopus: {
    id: 'octopus',
    name: '小章鱼',
    color: new Color(196, 72, 140, 255),
    accent: new Color(140, 40, 96, 255),
    collider: 'sphere',
    size: 0.44,
    mass: 1.0,
    model: '515_Octopuses',
  },
};

export const ALL_KINDS = Object.keys(ITEM_DEFS) as ItemKind[];

export type LevelSpec = {
  title: string;
  kinds: ItemKind[];
  copies: number;
  dropHeight: number;
  boxScale: number;
  /** XZ spawn diameter. Smaller than the crate so items pile instead of carpeting the floor. */
  spread?: number;
};

export const LEVELS: LevelSpec[] = [
  {
    title: '教程',
    kinds: ['duck', 'volleyball', 'icecream'],
    copies: 3,
    dropHeight: 0.2,
    boxScale: 0.85,
  },
  {
    title: '第一箱',
    kinds: ALL_KINDS,
    copies: 12,
    dropHeight: 5.8,
    boxScale: 1,
    spread: 3.4,
  },
  {
    title: '第二箱',
    kinds: ALL_KINDS,
    copies: 18,
    dropHeight: 7.6,
    boxScale: 1.08,
    spread: 3.6,
  },
];
