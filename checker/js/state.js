// アプリの状態管理と localStorage への永続化。
// 記録と狙い食材は統合前の食材タイプ版（ig 接頭辞）・きのみタイプ版（bf 接頭辞）と同じキーを使い、以前の記録をそのまま読む。
// 共通の設定は ck 接頭辞で持ち、まだなければ統合前の設定を引き継ぐ。
import { TYPES, DEFAULT_TYPE, typeOf } from './types.js';

const KEYS = { camp: 'ckcamp', g80: 'ckg80', mode: 'ckmode', mon: 'ckmon', mons: 'ckmons', target: 'igtarget' };
const LOG_KEYS = { ingredient: 'iglog', berry: 'bflog' };
const OLD = { camp: ['igcamp', 'bfcamp'], g80: ['igg80', 'bfg80'], mode: ['igmode', 'bfmode'], mon: ['igmon', 'bfmon'] };

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
const loadSetting = (k, def) => [KEYS[k], ...OLD[k]].reduce((v, key) => (v === undefined ? load(key, undefined) : v), undefined) ?? def;

// arr は食材スロットごとの候補の番号。Lv.1 のスロットは候補が1つなので最初から決まっている。
const emptyArr = (mon) => TYPES.ingredient.MONS[mon].slots.map((opts) => (opts.length === 1 ? 0 : null));

export const state = {
  mon: TYPES[DEFAULT_TYPE].DEFAULT_MON,
  type: DEFAULT_TYPE,
  target: null,
  arr: [],
  subs: [null, null, null, null],
  up: null,
  down: null,
  N: 3,
  camp: true,
  g80: false,
};

export const monData = () => TYPES[state.type].MONS[state.mon];

// ポケモンを切り替えると食材配列は選び直し、狙い食材はそのポケモンで前回選んだものにする。
// サブスキルと性格は引き継ぐ。
function selectMon(m) {
  state.mon = m;
  state.type = typeOf(m);
  if (state.type !== 'ingredient') {
    state.arr = [];
    state.target = null;
    return;
  }
  state.arr = emptyArr(m);
  const t = load(KEYS.target, {});
  const ings = TYPES.ingredient.MONS[m].ings;
  state.target = t && typeof t === 'object' && Object.hasOwn(ings, t[m]) ? t[m] : 'A';
}

export function loadSettings() {
  state.camp = loadSetting('camp', true) === true;
  state.g80 = loadSetting('g80', false) === true;
  state.N = loadSetting('mode', 3) === 4 ? 4 : 3;
  // URL の ?mon= を優先し、なければ前回選んだポケモンにする。
  let q = null;
  try { q = new URLSearchParams(location.search).get('mon'); } catch { /* no location */ }
  const m = typeOf(q) ? q : loadSetting('mon', TYPES[DEFAULT_TYPE].DEFAULT_MON);
  selectMon(typeOf(m) ? m : TYPES[DEFAULT_TYPE].DEFAULT_MON);
  rememberMon();
}

function rememberMon() {
  const saved = load(KEYS.mons, {});
  save(KEYS.mons, { ...(saved && typeof saved === 'object' ? saved : {}), [state.type]: state.mon });
}

// タイプごとに最後に選んだポケモン。統合前の版で選んでいたポケモンも引き継ぐ。
function lastMonOf(type) {
  const saved = load(KEYS.mons, {});
  const old = { ingredient: 'igmon', berry: 'bfmon' }[type];
  const m = (saved && typeof saved === 'object' && saved[type]) || load(old, null);
  return typeOf(m) === type ? m : TYPES[type].DEFAULT_MON;
}

export function setCamp(v) { state.camp = v; save(KEYS.camp, v); }
export function setG80(v) { state.g80 = v; save(KEYS.g80, v); }
export function setMode(n) { state.N = n; save(KEYS.mode, n); }

export function setMon(m) {
  selectMon(m);
  save(KEYS.mon, m);
  rememberMon();
}
export function setType(type) { if (type !== state.type) setMon(lastMonOf(type)); }
export function setTarget(ing) {
  state.target = ing;
  const t = load(KEYS.target, {});
  save(KEYS.target, { ...(t && typeof t === 'object' ? t : {}), [state.mon]: ing });
}

export function resetSelection() {
  if (state.type === 'ingredient') state.arr = emptyArr(state.mon);
  state.subs = [null, null, null, null];
  state.up = null;
  state.down = null;
}

export const currentSubs = () => state.subs.slice(0, state.N);
export const isComplete = () => currentSubs().every(Boolean) && state.up && state.down && !state.arr.includes(null);
export const env = () => {
  const e = { N: state.N, camp: state.camp, g80: state.g80, mon: state.mon };
  return state.type === 'ingredient' ? { ...e, target: state.target } : e;
};

// 記録はタイプごとに統合前と同じキーに保存する。食材タイプの記録は食材配列のあるものだけ使う。
const loadRawLog = (type) => {
  const v = load(LOG_KEYS[type], []);
  return Array.isArray(v) ? v : [];
};
export const loadLog = () => loadRawLog(state.type).filter((x) => x && x.mon === state.mon && Array.isArray(x.subs)
  && (state.type !== 'ingredient' || Array.isArray(x.arr)));
export function appendLog(entry) { save(LOG_KEYS[state.type], [...loadRawLog(state.type), entry]); }
export function removeLogEntry(t) {
  save(LOG_KEYS[state.type], loadRawLog(state.type).filter((x) => String(x && x.t) !== String(t)));
}
