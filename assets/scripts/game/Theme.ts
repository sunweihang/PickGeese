import { Color } from 'cc';

export const DESIGN_W = 1080;
export const DESIGN_H = 1920;

export const SLOT_COUNT = 7;
export const MATCH_COUNT = 3;

export const Theme = {
  sky: new Color(254, 236, 196, 255),
  wood: new Color(214, 148, 78, 255),
  woodDark: new Color(148, 86, 42, 255),
  woodRim: new Color(92, 52, 24, 255),
  grass: new Color(118, 186, 86, 255),
  dirt: new Color(168, 124, 68, 255),
  cream: new Color(255, 244, 220, 255),
  ink: new Color(62, 38, 22, 255),
  accent: new Color(232, 92, 48, 255),
  gold: new Color(240, 176, 48, 255),
  slotEmpty: new Color(255, 232, 196, 220),
  slotStroke: new Color(168, 104, 48, 255),
  panel: new Color(255, 236, 204, 245),
  overlay: new Color(40, 22, 12, 170),
};

export const ITEM_PHYS = {
  friction: 0.72,
  restitution: 0.02,
  mass: 1.1,
};
