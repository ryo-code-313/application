// アプリの状態管理と localStorage への永続化。キーはミュウツー版と衝突しないよう ig 接頭辞にする。
const KEYS = { camp: 'igcamp', g80: 'igg80', mode: 'igmode', log: 'iglog', base: 'igbase' };

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

// 入力欄の文字列そのまま。数値への変換と検証は parseBase で行う。
const EMPTY_BASE = { time: '', ingP: '', cap: '', a1: '', a2: '', a3: '' };

export const state = {
  subs: [null, null, null, null],
  up: null,
  down: null,
  N: 3,
  camp: true,
  g80: false,
  base: { ...EMPTY_BASE },
};

export function loadSettings() {
  state.camp = load(KEYS.camp, true) === true;
  state.g80 = load(KEYS.g80, false) === true;
  state.N = load(KEYS.mode, 3) === 4 ? 4 : 3;
  const b = load(KEYS.base, null);
  if (b && typeof b === 'object') Object.keys(EMPTY_BASE).forEach((k) => { if (typeof b[k] === 'string') state.base[k] = b[k]; });
}

export function setCamp(v) { state.camp = v; save(KEYS.camp, v); }
export function setG80(v) { state.g80 = v; save(KEYS.g80, v); }
export function setMode(n) { state.N = n; save(KEYS.mode, n); }
export function setBaseField(k, v) { state.base[k] = v; save(KEYS.base, state.base); }

// "50:00" / "3000" のどちらでも秒数として読む。
function parseTime(s) {
  const t = s.trim();
  const m = t.match(/^(\d+):(\d{1,2})$/);
  const sec = m ? +m[1] * 60 + +m[2] : /^\d+$/.test(t) ? +t : NaN;
  return sec >= 600 && sec <= 20000 ? sec : null;
}
const parseInt1 = (s, min, max) => {
  const v = +s.trim();
  return s.trim() !== '' && Number.isInteger(v) && v >= min && v <= max ? v : null;
};

// 基礎値がそろっていれば { time, ingP, cap, amounts }、足りなければ null。
export function parseBase() {
  const b = state.base;
  const time = parseTime(b.time);
  const pct = +b.ingP.trim();
  const ingP = b.ingP.trim() !== '' && pct > 0 && pct <= 100 ? pct / 100 : null;
  const cap = parseInt1(b.cap, 1, 200);
  const amounts = [b.a1, b.a2, b.a3].map((a) => parseInt1(a, 1, 30));
  if (time === null || ingP === null || cap === null || amounts.includes(null)) return null;
  return { time, ingP, cap, amounts };
}

export function resetSelection() {
  state.subs = [null, null, null, null];
  state.up = null;
  state.down = null;
}

export const currentSubs = () => state.subs.slice(0, state.N);
export const isComplete = () => currentSubs().every(Boolean) && state.up && state.down;
export const env = () => {
  const base = parseBase();
  return base && { N: state.N, camp: state.camp, g80: state.g80, base };
};

export const loadLog = () => {
  const v = load(KEYS.log, []);
  return Array.isArray(v) ? v : [];
};
export function appendLog(entry) { save(KEYS.log, [...loadLog(), entry]); }
export function removeLogEntry(t) { save(KEYS.log, loadLog().filter((x) => String(x.t) !== String(t))); }
