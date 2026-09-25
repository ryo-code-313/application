// アプリの状態管理と localStorage への永続化。キーはミュウツー版と衝突しないよう ig 接頭辞にする。
import { MONS, DEFAULT_MON } from './constants.js';

const KEYS = { camp: 'igcamp', g80: 'igg80', mode: 'igmode', log: 'iglog', target: 'igtarget', mon: 'igmon' };

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

// arr は食材スロットごとの候補の番号。Lv.1 のスロットは候補が1つなので最初から決まっている。
const emptyArr = (mon) => MONS[mon].slots.map((opts) => (opts.length === 1 ? 0 : null));

export const state = {
  mon: DEFAULT_MON,
  target: 'A',
  arr: emptyArr(DEFAULT_MON),
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
  // URL の ?mon= を優先し、なければ前回選んだポケモンにする。
  let q = null;
  try { q = new URLSearchParams(location.search).get('mon'); } catch { /* no location */ }
  const has = (k) => typeof k === 'string' && Object.hasOwn(MONS, k);
  const m = has(q) ? q : load(KEYS.mon, DEFAULT_MON);
  selectMon(has(m) ? m : DEFAULT_MON);
}

// ポケモンを切り替えると食材配列は選び直し、狙い食材はそのポケモンで前回選んだものにする。
function selectMon(m) {
  state.mon = m;
  state.arr = emptyArr(m);
  const t = load(KEYS.target, {});
  const ings = MONS[m].ings;
  state.target = t && typeof t === 'object' && Object.hasOwn(ings, t[m]) ? t[m] : 'A';
}

export function setCamp(v) { state.camp = v; save(KEYS.camp, v); }
export function setG80(v) { state.g80 = v; save(KEYS.g80, v); }
export function setMode(n) { state.N = n; save(KEYS.mode, n); }
export function setMon(m) { selectMon(m); save(KEYS.mon, m); }
export function setTarget(ing) {
  state.target = ing;
  const t = load(KEYS.target, {});
  save(KEYS.target, { ...(t && typeof t === 'object' ? t : {}), [state.mon]: ing });
}

export function resetSelection() {
  state.arr = emptyArr(state.mon);
  state.subs = [null, null, null, null];
  state.up = null;
  state.down = null;
}

export const currentSubs = () => state.subs.slice(0, state.N);
export const isComplete = () => currentSubs().every(Boolean) && state.up && state.down && !state.arr.includes(null);
export const env = () => ({ N: state.N, camp: state.camp, g80: state.g80, mon: state.mon, target: state.target });

// 食材配列のない記録（基礎値入力版の記録）は表示しない。
export const loadLog = () => {
  const v = load(KEYS.log, []);
  return Array.isArray(v) ? v.filter((x) => x && MONS[x.mon] && Array.isArray(x.arr)) : [];
};
const loadRawLog = () => {
  const v = load(KEYS.log, []);
  return Array.isArray(v) ? v : [];
};
export function appendLog(entry) { save(KEYS.log, [...loadRawLog(), entry]); }
export function removeLogEntry(t) { save(KEYS.log, loadRawLog().filter((x) => String(x && x.t) !== String(t))); }
