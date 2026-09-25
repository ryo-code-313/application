// ゲーム定数とサブスキル・性格の定義。数値の意味は README.md を参照。
export const BASE = 2300;
export const P0 = 0.029;
export const CEIL = 62;
export const SLEEP = 8.5;
export const CAP0 = 24;
export const ING_P = 0.16;
export const ING = [1, 2, 4];
export const DAYS = 5;
export const UNLOCK = [10, 25, 50, 70];

export const SUBS = [
  { id: 'skM', name: 'スキルM', w: 6, skill: 0.36 },
  { id: 'skS', name: 'スキルS', w: 12.5, skill: 0.18 },
  { id: 'spM', name: 'おてスピM', w: 6, speed: 0.14 },
  { id: 'spS', name: 'おてスピS', w: 12.5, speed: 0.07 },
  { id: 'hb', name: 'おてボ', w: 2, speed: 0.05, gold: 1 },
  { id: 'invS', name: '所持数S', w: 12.5, inv: 6 },
  { id: 'invM', name: '所持数M', w: 6, inv: 12 },
  { id: 'invL', name: '所持数L', w: 6, inv: 18 },
  { id: 'x1', w: 2 },
  { id: 'x5', w: 6 },
  { id: 'x6', w: 12.5 },
  { id: 'x7', w: 6 },
  { id: 'x8', w: 2 },
  { id: 'x9', w: 2 },
  { id: 'x10', w: 2 },
  { id: 'x11', w: 2 },
  { id: 'x12', w: 2 },
];

export const PICK = ['skM', 'skS', 'spM', 'spS', 'hb', 'invS', 'invM', 'invL', 'none'];

export const byId = Object.fromEntries(SUBS.map((s) => [s.id, s]));

export const NAT = [
  ['さみしがり', 'sp', 'en'], ['いじっぱり', 'sp', 'ig'], ['やんちゃ', 'sp', 'sk'], ['ゆうかん', 'sp', 'ex'],
  ['ずぶとい', 'en', 'sp'], ['わんぱく', 'en', 'ig'], ['のうてんき', 'en', 'sk'], ['のんき', 'en', 'ex'],
  ['ひかえめ', 'ig', 'sp'], ['おっとり', 'ig', 'en'], ['うっかりや', 'ig', 'sk'], ['れいせい', 'ig', 'ex'],
  ['おだやか', 'sk', 'sp'], ['おとなしい', 'sk', 'en'], ['しんちょう', 'sk', 'ig'], ['なまいき', 'sk', 'ex'],
  ['おくびょう', 'ex', 'sp'], ['せっかち', 'ex', 'en'], ['ようき', 'ex', 'ig'], ['むじゃき', 'ex', 'sk'],
  ['がんばりや', null, null], ['すなお', null, null], ['てれや', null, null], ['きまぐれ', null, null], ['まじめ', null, null],
];

export const NATL = { skill: 'スキル', speed: 'おてスピ', other: 'なし他' };

export function cat(s) {
  if (s === 'sp' || s === 'speed') return 'speed';
  if (s === 'sk' || s === 'skill') return 'skill';
  return 'other';
}
