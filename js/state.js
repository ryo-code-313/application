// アプリの状態管理と localStorage への永続化を一箇所にまとめる。
const KEYS = { camp: 'm2camp', g80: 'm2g80', mode: 'm2mode', log: 'm2log' };

const loadBool = (key, def) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? def : v === '1';
  } catch {
    return def;
  }
};
const saveBool = (key, val) => {
  try { localStorage.setItem(key, val ? '1' : '0'); } catch { /* storage unavailable */ }
};

export const state = {
  subs: [null, null, null, null],
  up: null,
  down: null,
  N: 3,
  camp: true,
  g80: false,
};

export function loadSettings() {
  state.camp = loadBool(KEYS.camp, true);
  state.g80 = loadBool(KEYS.g80, false);
  try {
    const v = +localStorage.getItem(KEYS.mode);
    if (v === 4) state.N = 4;
  } catch { /* storage unavailable */ }
}

export function setCamp(v) { state.camp = v; saveBool(KEYS.camp, v); }
export function setG80(v) { state.g80 = v; saveBool(KEYS.g80, v); }
export function setMode(n) {
  state.N = n;
  try { localStorage.setItem(KEYS.mode, String(n)); } catch { /* storage unavailable */ }
}

export function resetSelection() {
  state.subs = [null, null, null, null];
  state.up = null;
  state.down = null;
}

export const currentSubs = () => state.subs.slice(0, state.N);
export const isComplete = () => currentSubs().every(Boolean) && state.up && state.down;
export const env = () => ({ N: state.N, camp: state.camp, g80: state.g80 });

// Tied to the deploy's ?v= tag so results from older calculation code are never reused.
const DIST_VERSION = new URL(import.meta.url).searchParams.get('v');
const DIST_PREFIX = 'm2dist:';

export function loadDist(key) {
  if (!DIST_VERSION) return null;
  try {
    const v = localStorage.getItem(`${DIST_PREFIX}${DIST_VERSION}:${key}`);
    return v ? JSON.parse(v) : null;
  } catch {
    return null;
  }
}
export function saveDist(key, dist) {
  if (!DIST_VERSION) return;
  try { localStorage.setItem(`${DIST_PREFIX}${DIST_VERSION}:${key}`, JSON.stringify(dist)); } catch { /* storage unavailable */ }
}
export function pruneOldDists() {
  try {
    const current = `${DIST_PREFIX}${DIST_VERSION}:`;
    Object.keys(localStorage)
      .filter((k) => k.startsWith(DIST_PREFIX) && !k.startsWith(current))
      .forEach((k) => localStorage.removeItem(k));
  } catch { /* storage unavailable */ }
}

export function loadLog() {
  try {
    const v = localStorage.getItem(KEYS.log);
    return v ? JSON.parse(v) : [];
  } catch {
    return [];
  }
}
export function saveLog(log) {
  try { localStorage.setItem(KEYS.log, JSON.stringify(log)); } catch { /* storage unavailable */ }
}
export function appendLog(entry) {
  const log = loadLog();
  log.push(entry);
  saveLog(log);
}
export function removeLogEntry(t) {
  saveLog(loadLog().filter((x) => String(x.t) !== String(t)));
}
