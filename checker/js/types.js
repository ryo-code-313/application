// 食材タイプ・きのみタイプの定義をまとめる。ポケモンのキーは両タイプで重ならない。
import * as ingredient from './ingredient/constants.js';
import * as berry from './berry/constants.js';
import { mults as ingMults, createEngine as ingEngine } from './ingredient/calc.js';
import { mults as berryMults, createEngine as berryEngine } from './berry/calc.js';

// 並び順はタブの順。
export const TYPES = {
  berry: { label: 'きのみタイプ', short: 'きのみ', ...berry, mults: berryMults, createEngine: berryEngine },
  ingredient: { label: '食材タイプ', short: '食材', ...ingredient, mults: ingMults, createEngine: ingEngine },
};

export const DEFAULT_TYPE = 'berry';

export const typeOf = (mon) => Object.keys(TYPES).find((t) => typeof mon === 'string' && Object.hasOwn(TYPES[t].MONS, mon)) || null;

export const createEngines = () => Object.fromEntries(Object.entries(TYPES).map(([t, d]) => [t, d.createEngine()]));
