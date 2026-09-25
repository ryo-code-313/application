// 期待値計算エンジン。DOM に一切触れない純粋な計算ロジックとして分離してある。
// 呼び出し側は env = { N, camp, g80 } を明示的に渡す。
import { BASE, P0, CEIL, SLEEP, CAP0, ING_P, ING, DAYS, SUBS, byId, NAT, cat } from './constants.js';

export const eff = (p) => (p >= 1 ? 1 : p / (1 - (1 - p) ** CEIL));

export function mk(sk, sp, inv, up, down) {
  const skillMul = (up === 'skill' ? 1.2 : 1) * (down === 'skill' ? 0.8 : 1) * (1 + sk);
  const timeMul = (up === 'speed' ? 0.9 : 1) * (down === 'speed' ? 1.075 : 1) * (1 - Math.min(0.35, sp));
  return { skillMul, timeMul, cap: CAP0 + inv, ratio: eff(P0 * skillMul) / eff(P0) / timeMul };
}

export function mults(subs, up, down) {
  let sk = 0, sp = 0, inv = 0;
  subs.forEach((id) => {
    const s = byId[id];
    if (s) { sk += s.skill || 0; sp += s.speed || 0; inv += s.inv || 0; }
  });
  return mk(sk, sp, inv, up, down);
}

function nightRolls(cap, Hs) {
  // P[j]: 睡眠中にスキル抽選が行われるおてつだいがj回になる確率（所持数が満タンになると抽選終了）
  const P = new Float64Array(Hs + 1);
  if (Hs === 0) { P[0] = 1; return { P, full: 0 }; }
  let d = new Float64Array(cap), n = new Float64Array(cap);
  d[0] = 1;
  let prev = 1;
  for (let j = 1; j <= Hs; j++) {
    n.fill(0);
    for (let c = 0; c < cap; c++) {
      const x = d[c];
      if (!x) continue;
      if (c + 1 < cap) n[c + 1] += x * (1 - ING_P);
      for (const q of ING) if (c + q < cap) n[c + q] += x * ING_P / ING.length;
    }
    [d, n] = [n, d];
    let s = 0;
    for (let c = 0; c < cap; c++) s += d[c];
    P[j] = j < Hs ? prev - s : prev;
    prev = s;
  }
  return { P, full: 1 - prev };
}

const band = (e) => (e >= 81 ? 0.45 : e >= 61 ? 0.52 : e >= 41 ? 0.62 : e >= 21 ? 0.71 : 1);

export function daily(timeMul, skillMul, camp, cap, g80, N) {
  const LV = N === 4 ? 70 : 60;
  const T = Math.floor(BASE * (1 - (LV - 1) * 0.002) * timeMul);
  const Te = camp ? T / 1.2 : T;
  const p = Math.min(1, P0 * skillMul);
  const aw = Math.round((24 - SLEEP) * 60);
  const bd = (e) => (g80 ? 0.45 : band(e));
  let h = 0;
  for (let t = 0; t < aw; t++) h += 60 / (Te * bd(Math.max(0, 100 - Math.floor(t / 10))));
  const Hs = Math.floor(SLEEP * 3600 / (Te * bd(Math.max(0, 100 - Math.floor(aw / 10)))));
  const Ha = Math.round(h);
  const capE = camp ? Math.ceil(cap * 1.2) : cap;
  const { P: RP, full } = nightRolls(capE, Hs);
  let rolls = 0;
  for (let j = 0; j <= Hs; j++) rolls += j * RP[j];

  let c = new Float64Array(CEIL), nb = new Float64Array(CEIL);
  c[0] = 1;
  const mkArr = () => [0, 1, 2].map(() => new Float64Array(CEIL));
  let G = mkArr(), GN = mkArr();
  const F = mkArr();
  let day = 0, night = 0;

  for (let d = 0; d < DAYS; d++) {
    day = 0;
    for (let i = 0; i < Ha; i++) {
      nb.fill(0);
      for (let k = 0; k < CEIL; k++) {
        const x = c[k];
        if (!x) continue;
        const w = k === CEIL - 1 ? 1 : p;
        day += x * w;
        nb[0] += x * w;
        if (k < CEIL - 1) nb[k + 1] += x * (1 - w);
      }
      [c, nb] = [nb, c];
    }
    G[0].set(c); G[1].fill(0); G[2].fill(0);
    for (let s = 0; s < 3; s++) for (let k = 0; k < CEIL; k++) F[s][k] = RP[0] * G[s][k];
    for (let i = 0; i < Hs; i++) {
      GN.forEach((a) => a.fill(0));
      for (let s = 0; s < 3; s++) for (let k = 0; k < CEIL; k++) {
        const x = G[s][k];
        if (!x) continue;
        if (s === 2) { GN[2][k] += x; continue; }
        const w = k === CEIL - 1 ? 1 : p;
        GN[s + 1][0] += x * w;
        if (k < CEIL - 1) GN[s][k + 1] += x * (1 - w);
      }
      [G, GN] = [GN, G];
      const wgt = RP[i + 1];
      if (wgt) for (let s = 0; s < 3; s++) for (let k = 0; k < CEIL; k++) F[s][k] += wgt * G[s][k];
    }
    night = 0;
    c.fill(0);
    for (let s = 0; s < 3; s++) for (let k = 0; k < CEIL; k++) { night += s * F[s][k]; c[k] += F[s][k]; }
  }
  return { T, Te, p, h, Ha, Hs, day, night, cap: capE, rolls, full };
}

// N・キャンプチケット・げんき条件ごとに結果をキャッシュする計算エンジンを生成する。
export function createEngine() {
  const metricCache = new Map();
  const distCache = new Map();

  const envKey = (env) => `${env.N}|${env.camp}|${env.g80}`;

  function metric(m, env) {
    const key = `${envKey(env)}|${m.skillMul.toFixed(6)}|${m.timeMul.toFixed(6)}|${m.cap}`;
    if (!metricCache.has(key)) {
      const r = daily(m.timeMul, m.skillMul, env.camp, m.cap, env.g80, env.N);
      metricCache.set(key, r.day + r.night);
    }
    return metricCache.get(key);
  }

  const baseMetric = (env) => metric({ skillMul: 1, timeMul: 1, cap: CAP0 }, env);
  const score = (subs, up, down, env) => metric(mults(subs, up, down), env) / baseMetric(env);

  function buildDist(env) {
    const n = env.N;
    const W = SUBS.reduce((a, s) => a + s.w, 0);
    const natCount = {};
    NAT.forEach(([, u, d]) => {
      const k = `${cat(u)}|${cat(d)}`;
      natCount[k] = (natCount[k] || 0) + 1 / 25;
    });
    const natEntries = Object.entries(natCount).map(([k, v]) => [...k.split('|'), v]);

    const sums = new Map();
    const rec = (depth, mask, used, p, sk, sp, inv) => {
      if (depth === n) {
        const k = `${sk.toFixed(4)}|${Math.min(0.35, sp).toFixed(4)}|${inv}`;
        const e = sums.get(k);
        if (e) e.p += p; else sums.set(k, { sk, sp, inv, p });
        return;
      }
      const rest = W - used;
      for (let i = 0; i < SUBS.length; i++) {
        if (mask & (1 << i)) continue;
        const s = SUBS[i];
        rec(depth + 1, mask | (1 << i), used + s.w, p * s.w / rest, sk + (s.skill || 0), sp + (s.speed || 0), inv + (s.inv || 0));
      }
    };
    rec(0, 0, 0, 1, 0, 0, 0);

    const b = baseMetric(env);
    const acc = new Map();
    for (const { sk, sp, inv, p } of sums.values()) {
      for (const [u, d, v] of natEntries) {
        const r = metric(mk(sk, sp, inv, u, d), env) / b;
        const k = r.toFixed(9);
        acc.set(k, (acc.get(k) || 0) + p * v);
      }
    }
    return [...acc].map(([r, p]) => ({ r: +r, p }));
  }

  function dist(env) {
    const k = envKey(env);
    if (!distCache.has(k)) distCache.set(k, buildDist(env));
    return distCache.get(k);
  }

  const ready = (env) => distCache.has(envKey(env));

  const atLeast = (r, env) => dist(env).reduce((a, x) => a + (x.r >= r * (1 - 1e-7) ? x.p : 0), 0);

  return { metric, baseMetric, score, mults, dist, ready, atLeast, daily };
}
