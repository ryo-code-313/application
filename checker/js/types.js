// きのみタイプ・食材タイプ・スキルタイプの定義をまとめる。ポケモンのキーは3タイプで重ならない。
import * as ingredient from './ingredient/constants.js';
import * as berry from './berry/constants.js';
import * as skill from './skill/constants.js';
import { mults as ingMults, createEngine as ingEngine } from './ingredient/calc.js';
import { mults as berryMults, createEngine as berryEngine } from './berry/calc.js';
import { mults as skillMults, createEngine as skillEngine } from './skill/calc.js';

// 並び順はタブの順。
export const TYPES = {
  berry: { label: 'きのみタイプ', short: 'きのみ', ...berry, mults: berryMults, createEngine: berryEngine },
  ingredient: { label: '食材タイプ', short: '食材', ...ingredient, mults: ingMults, createEngine: ingEngine },
  skill: { label: 'スキルタイプ', short: 'スキル', ...skill, mults: skillMults, createEngine: skillEngine },
};

export const DEFAULT_TYPE = 'berry';

export const typeOf = (mon) => Object.keys(TYPES).find((t) => typeof mon === 'string' && Object.hasOwn(TYPES[t].MONS, mon)) || null;

export const createEngines = () => Object.fromEntries(Object.entries(TYPES).map(([t, d]) => [t, d.createEngine()]));
