// きのみタイプ版だけで使う定義。サブスキル・性格・げんきなどの共通データは ../../js/constants.js を使う。
import { cat } from '../../js/constants.js';

// ポケモンごとの基礎値。berries はきのみおてつだい1回で拾うきのみの個数（きのみタイプは2個）。
// slots は食材スロット（Lv.1 / Lv.30 / Lv.60）ごとの候補 [食材, 個数]。候補は個体ごとに1つ決まり（食材配列）、
// 食材おてつだいでは3スロットから均等に1つ選ばれる。食材は睡眠中の所持数を埋めるのに使う。
export const MONS = {
  walrein: {
    name: 'トドゼルガ',
    berry: 'チーゴのみ',
    time: 3000,
    ingP: 0.223,
    cap: 18,
    berries: 2,
    ings: { A: 'ピュアなオイル', B: 'マメミート', C: 'あったかジンジャー' },
    slots: [[['A', 1]], [['A', 2], ['B', 3]], [['A', 4], ['B', 4], ['C', 4]]],
  },
};
export const DEFAULT_MON = 'walrein';

// きのみの個数に影響するサブスキル。スキル確率アップなどは「なし他」にまとめる。
export const PICK = ['berry', 'spM', 'spS', 'hb', 'invS', 'invM', 'invL', 'erb', 'ingM', 'ingS', 'none'];

export const NATL = { speed: 'おてスピ', ing: '食材', other: 'なし他' };
export const NAT_CATS = ['speed', 'ing', 'other'];

// スキル補正はきのみの個数に影響しないので「なし他」と同じ扱いにする。
export const natCat = (s) => {
  const c = cat(s);
  return c === 'skill' ? 'other' : c;
};

// すべての食材配列について、各スロットで拾う個数と出現確率（各スロットの候補は等確率）。
// きのみの計算では食材の種類は関係ないので、個数の並びが同じ配列はまとめる。
export function amountPatterns(mon) {
  const all = mon.slots.reduce(
    (acc, opts) => acc.flatMap(({ amts, p }) => opts.map(([, a]) => ({ amts: [...amts, a], p: p / opts.length }))),
    [{ amts: [], p: 1 }],
  );
  const out = new Map();
  for (const { amts, p } of all) {
    const k = amts.join(',');
    const o = out.get(k);
    if (o) o.p += p; else out.set(k, { amts, p });
  }
  return [...out.values()];
}
