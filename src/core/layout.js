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
  sideWallEnd: 1.6,    // side walls stop here (gaps after are "lost" gutters)
  dropY: 4.4,
  dropZ: -7.5,
  gateY: 3.1,
  lostY: -2.5,
  gravity: -48,
};

export const TABLE_SIZES = { wide: 11, normal: 9, compact: 7 };
export function configureLayout(size) {
  L.halfW = TABLE_SIZES[size] || TABLE_SIZES.wide;
}

// Object kinds
export const KIND = {
  SILVER: 0, GOLD: 1, RAINBOW: 2, BIG: 3, BALL: 4, GEM: 5, CHEST: 6, TOKEN: 7,
};
export const KIND_COUNT = 8;
// Token subtypes (extra field)
export const TOKEN = { WALL: 0, SHOWER: 1, TURBO: 2, DOUBLE: 3, FEVER: 4, STOCK: 5 };
export const TOKEN_COUNT = 6;
