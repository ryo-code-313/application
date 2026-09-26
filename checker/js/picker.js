// サブスキル・性格を選ぶダイアログの並びと表示名。計算に使う効果は ../../js/constants.js の SUBS・NAT にある。
import { byId, NAT } from '../../js/constants.js';

// ゲーム内の名前（ダイアログと枠のボタン）と、記録で使う短い名前。
export const SUB_FULL = {
  berry: 'きのみの数S', hb: 'おてつだいボーナス', xExp: '睡眠EXPボーナス', xRes: 'リサーチEXPボーナス',
  erb: 'げんき回復ボーナス', xShard: 'ゆめのかけらボーナス',
  xSlvM: 'スキルレベルアップM', xSlvS: 'スキルレベルアップS',
  skM: 'スキル確率アップM', skS: 'スキル確率アップS',
  spM: 'おてつだいスピードM', spS: 'おてつだいスピードS',
  ingM: '食材確率アップM', ingS: '食材確率アップS',
  invL: '最大所持数アップL', invM: '最大所持数アップM', invS: '最大所持数アップS',
};
const SUB_SHORT = { xExp: '睡眠EXP', xRes: 'リサーチEXP', xShard: 'ゆめのかけら', xSlvM: 'スキルLvM', xSlvS: 'スキルLvS' };
export const subShort = (id) => (byId[id] && (byId[id].name || SUB_SHORT[id])) || 'なし他';

// ダイアログの並び。金色サブスキルは2列、それ以外は系統ごとに1行でサイズを並べる。
export const GOLD = ['berry', 'hb', 'xExp', 'xRes', 'erb', 'xShard'];
export const FAMILIES = [
  ['スキルレベルアップ', [['xSlvM', 'M'], ['xSlvS', 'S']]],
  ['スキル確率アップ', [['skM', 'M'], ['skS', 'S']]],
  ['おてつだいスピード', [['spM', 'M'], ['spS', 'S']]],
  ['食材確率アップ', [['ingM', 'M'], ['ingS', 'S']]],
  ['最大所持数アップ', [['invL', 'L'], ['invM', 'M'], ['invS', 'S']]],
];

// 性格の表。行が上昇、列が下降の補正で、対角線は無補正の性格。[補正, 名前, 表の見出し]
export const NAT_AXES = [['sp', 'おてスピ', 'おてスピ'], ['ig', '食材確率', '食材'], ['sk', 'スキル確率', 'スキル'], ['en', 'げんき回復', 'げんき'], ['ex', 'EXP', 'EXP']];
const NEUTRAL = { sp: 'がんばりや', ig: 'すなお', sk: 'てれや', en: 'きまぐれ', ex: 'まじめ' };
export const natAt = (up, down) => (up === down ? NEUTRAL[up] : NAT.find((n) => n[1] === up && n[2] === down)[0]);
export const natByName = (name) => NAT.find((n) => n[0] === name) || null;
export const axisLabel = (code) => NAT_AXES.find(([c]) => c === code)[1];
