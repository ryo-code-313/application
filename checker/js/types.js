// 食材タイプ・きのみタイプの定義をまとめる。ポケモンのキーは両タイプで重ならない。
import * as ingredient from './ingredient/constants.js';
import * as berry from './berry/constants.js';
import { mults as ingMults, createEngine as ingEngine } from './ingredient/calc.js';
import { mults as berryMults, createEngine as berryEngine } from './berry/calc.js';

export const TYPES = {
  ingredient: { label: '食材タイプ', ...ingredient, mults: ingMults, createEngine: ingEngine },
  berry: { label: 'きのみタイプ', ...berry, mults: berryMults, createEngine: berryEngine },
};

export const DEFAULT_MON = ingredient.DEFAULT_MON;

export const typeOf = (mon) => Object.keys(TYPES).find((t) => typeof mon === 'string' && Object.hasOwn(TYPES[t].MONS, mon)) || null;

export const createEngines = () => Object.fromEntries(Object.entries(TYPES).map(([t, d]) => [t, d.createEngine()]));
