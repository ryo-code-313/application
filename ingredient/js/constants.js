// 食材タイプ版だけで使う定義。サブスキル・性格・げんきなどの共通データは ../../js/constants.js を使う。
import { cat } from '../../js/constants.js';

// ポケモンごとの基礎値。slots は食材スロット（Lv.1 / Lv.30 / Lv.60）ごとの候補 [食材, 個数]。
// 候補は個体ごとに1つ決まり（食材配列）、食材おてつだいでは3スロットから均等に1つ選ばれる。
export const MONS = {
  flygon: {
    name: 'フライゴン',
    time: 2700,
    ingP: 0.172,
    cap: 17,
    ings: { A: 'つやつやアボカド', B: 'げきからハーブ', C: 'ワカクサ大豆' },
    short: { A: 'アボカド', B: 'ハーブ', C: '大豆' },
    slots: [[['A', 2]], [['A', 5], ['B', 6]], [['A', 7], ['B', 9], ['C', 12]]],
  },
};
export const DEFAULT_MON = 'flygon';

export const SLOT_LV = ['Lv.1', 'Lv.30', 'Lv.60'];

// 食材の個数に影響するサブスキル。スキル確率アップなどは「なし他」にまとめる。
export const PICK = ['ingM', 'ingS', 'spM', 'spS', 'hb', 'berry', 'invS', 'invM', 'invL', 'erb', 'none'];

export const NATL = { ing: '食材', speed: 'おてスピ', other: 'なし他' };
export const NAT_CATS = ['ing', 'speed', 'other'];

// スキル補正は食材の個数に影響しないので「なし他」と同じ扱いにする。
export const natCat = (s) => {
  const c = cat(s);
  return c === 'skill' ? 'other' : c;
};

// 食材配列 arr はスロットごとの候補の番号（例: [0, 0, 0] = AAA）。
export const arrName = (mon, arr) => arr.map((k, i) => mon.slots[i][k][0]).join('');

// すべての食材配列と、その出現確率（各スロットの候補は等確率）。
export function allArrs(mon) {
  return mon.slots.reduce(
    (acc, opts) => acc.flatMap(({ arr, p }) => opts.map((_, k) => ({ arr: [...arr, k], p: p / opts.length }))),
    [{ arr: [], p: 1 }],
  );
}
