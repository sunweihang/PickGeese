import { Color } from 'cc';

export const DESIGN_W = 1080;
export const DESIGN_H = 1920;

export const SLOT_COUNT = 7;
export const MATCH_COUNT = 3;

export const Theme = {
  sky: new Color(168, 228, 255, 255),
  wood: new Color(255, 196, 118, 255),
  woodDark: new Color(232, 148, 78, 255),
  woodRim: new Color(255, 140, 196, 255),
  grass: new Color(126, 220, 92, 255),
  dirt: new Color(196, 168, 96, 255),
  cream: new Color(255, 252, 255, 255),
  ink: new Color(78, 42, 96, 255),
  accent: new Color(255, 92, 168, 255),
  gold: new Color(255, 206, 72, 255),
  slotEmpty: new Color(255, 236, 248, 230),
  slotStroke: new Color(255, 150, 210, 255),
  panel: new Color(255, 248, 255, 236),
  overlay: new Color(48, 24, 64, 150),
};

export const ITEM_PHYS = {
  friction: 0.72,
  restitution: 0.02,
  mass: 1.1,
};
