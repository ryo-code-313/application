// 食材タイプ版だけで使う定義。サブスキル・性格・げんきなどの共通データは ../../js/constants.js を使う。
import { cat } from '../../js/constants.js';

// 食材の個数に影響するサブスキル。スキル確率アップなどは「なし他」にまとめる。
export const PICK = ['ingM', 'ingS', 'spM', 'spS', 'hb', 'berry', 'invS', 'invM', 'invL', 'erb', 'none'];

// 解放済みの食材スロット（Lv.1 / Lv.30 / Lv.60）。Lv.60以上なので3つとも解放されている。
export const ING_SLOTS = ['Lv.1', 'Lv.30', 'Lv.60'];

export const NATL = { ing: '食材', speed: 'おてスピ', other: 'なし他' };
export const NAT_CATS = ['ing', 'speed', 'other'];

// スキル補正は食材の個数に影響しないので「なし他」と同じ扱いにする。
export const natCat = (s) => {
  const c = cat(s);
  return c === 'skill' ? 'other' : c;
};
