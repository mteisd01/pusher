// Machine geometry (world units: 1 unit ≈ coin diameter)
export const L = {
  coinR: 0.5,
  coinHH: 0.075,
  coinBorder: 0.025,
  bigCoinR: 0.95,
  bigCoinHH: 0.12,
  halfW: 11,           // half field width (configurable: table size setting)
  frontZ: 6,           // field front edge
  backZ: -16,          // floor back end
  pusherH: 1.0,        // pusher height (top surface y)
  pusherLen: 10,
  pusherFrontMin: -4.6,
  pusherFrontMax: -0.6,
  backWallZ: -9.4,     // front face of back wall over pusher
  wallH: 9,
  sideWallEnd: -0.5,   // side walls stop here (gaps after are "lost" gutters)
  dropY: 4.4,
  dropZ: -7.5,
  gateY: 3.1,
  lostY: -2.5,
  trayY: -1.15,        // top of the payout tray (won medals are removed here)
  gravity: -48,
};

export const TABLE_SIZES = { wide: 11, normal: 9, compact: 7 };
// narrower tables get shorter side gutters so that the base payout stays comparable
const GUTTER = { wide: -0.5, normal: 0.3, compact: 0.9 };
export function configureLayout(size) {
  if (!TABLE_SIZES[size]) size = 'wide';
  L.halfW = TABLE_SIZES[size];
  L.sideWallEnd = GUTTER[size];
}

// Object kinds
export const KIND = {
  SILVER: 0, GOLD: 1, RAINBOW: 2, BIG: 3, BALL: 4, GEM: 5, CHEST: 6, TOKEN: 7, GIANT: 8,
};
export const KIND_COUNT = 9;
// Center pocket (a hole in the field with a lid that opens periodically)
export const POCKET = { x: 0, z: 2.6, hw: 0.95, hd: 0.75 };
export const GIANT = { r: 1.55, hh: 0.2 };
// Token subtypes (extra field)
export const TOKEN = { WALL: 0, SHOWER: 1, TURBO: 2, DOUBLE: 3, FEVER: 4, STOCK: 5, PLINKO: 6, DICE: 7, MAGNET: 8, BOMB: 9 };
export const TOKEN_COUNT = 10;
