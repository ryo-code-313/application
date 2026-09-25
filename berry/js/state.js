// アプリの状態管理と localStorage への永続化。キーは他の版と衝突しないよう bf 接頭辞にする。
import { MONS, DEFAULT_MON } from './constants.js';

const KEYS = { camp: 'bfcamp', g80: 'bfg80', mode: 'bfmode', log: 'bflog' };

const load = (key, def) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : JSON.parse(v);
  } catch {
    return def;
  }
};
const save = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* storage unavailable */ }
};

export const state = {
  mon: DEFAULT_MON,
  subs: [null, null, null, null],
  up: null,
  down: null,
  N: 3,
  camp: true,
  g80: false,
};

export function loadSettings() {
  state.camp = load(KEYS.camp, true) === true;
  state.g80 = load(KEYS.g80, false) === true;
  state.N = load(KEYS.mode, 3) === 4 ? 4 : 3;
}

export function setCamp(v) { state.camp = v; save(KEYS.camp, v); }
export function setG80(v) { state.g80 = v; save(KEYS.g80, v); }
export function setMode(n) { state.N = n; save(KEYS.mode, n); }

export function resetSelection() {
  state.subs = [null, null, null, null];
  state.up = null;
  state.down = null;
}

export const currentSubs = () => state.subs.slice(0, state.N);
export const isComplete = () => currentSubs().every(Boolean) && state.up && state.down;
export const env = () => ({ N: state.N, camp: state.camp, g80: state.g80, mon: state.mon });

export const loadLog = () => {
  const v = load(KEYS.log, []);
  return Array.isArray(v) ? v.filter((x) => x && MONS[x.mon] && Array.isArray(x.subs)) : [];
};
const loadRawLog = () => {
  const v = load(KEYS.log, []);
  return Array.isArray(v) ? v : [];
};
export function appendLog(entry) { save(KEYS.log, [...loadRawLog(), entry]); }
export function removeLogEntry(t) { save(KEYS.log, loadRawLog().filter((x) => String(x && x.t) !== String(t))); }
