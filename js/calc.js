// 期待値計算エンジン。DOM に一切触れない純粋な計算ロジックとして分離してある。
// 呼び出し側は env = { N, camp, g80 } を明示的に渡す。
import {
  BASE, P0, CEIL, SLEEP, CAP0, ING_P, ING, ENERGY_TICK, WAKE_ENERGY, WAKE_ENERGY_ERB, ENERGY_BANDS,
  QUEUE_AFTER_FULL, WARMUP_DAYS, CHAIN_WARMUP, DAYS, RARITY_P, SUBS, byId, NAT, cat,
} from './constants.js';

const DAY_SEC = 86400;
const AWAKE_SEC = Math.round((24 - SLEEP) * 3600);

export const eff = (p) => (p >= 1 ? 1 : p / (1 - (1 - p) ** CEIL));

const natMul = (up, down, key, hi, lo) => (up === key ? hi : 1) * (down === key ? lo : 1);

// e: サブスキル効果の合計 { sk, sp, inv, ing, berry, erb }
export function mk(e, up, down) {
  const skillMul = natMul(up, down, 'skill', 1.2, 0.8) * (1 + e.sk);
  const timeMul = natMul(up, down, 'speed', 0.9, 1.075) * (1 - Math.min(0.35, e.sp));
  const ingMul = natMul(up, down, 'ing', 1.2, 0.8) * (1 + e.ing);
  return {
    skillMul, timeMul, ingMul,
    cap: CAP0 + e.inv,
    berry: 1 + e.berry,
    wake: e.erb ? WAKE_ENERGY_ERB : WAKE_ENERGY,
    ratio: eff(P0 * skillMul) / eff(P0) / timeMul,
  };
}

const NO_SUBS = { sk: 0, sp: 0, inv: 0, ing: 0, berry: 0, erb: false };

function addSub(e, s) {
  return {
    sk: e.sk + (s.skill || 0),
    sp: e.sp + (s.speed || 0),
    inv: e.inv + (s.inv || 0),
    ing: e.ing + (s.ing || 0),
    berry: e.berry + (s.berry || 0),
    erb: e.erb || !!s.erb,
  };
}

export function mults(subs, up, down) {
  return mk(subs.reduce((e, id) => (byId[id] ? addSub(e, byId[id]) : e), NO_SUBS), up, down);
}

export const band = (e) => ENERGY_BANDS.find(([min]) => e >= min)[1];

// おてつだいのタイムラインを起床時刻を0として秒単位で追う。
// 次のおてつだいの所要時間は、ひとつ前のおてつだいが終わった時点のげんきで決まる。
// 起床時のげんき回復は進行中のおてつだいにも即座に反映される。
// 日をまたいで端数を持ち越すため、捨て日のあとの DAYS 日分の回数を返す。
export function schedule(Te, g80, wake) {
  const energy = (t) => (g80 ? WAKE_ENERGY : Math.max(0, wake - Math.floor(t / ENERGY_TICK)));
  const Ha = [], Hs = [];
  let rest = 1;
  for (let d = 0; d < WARMUP_DAYS + DAYS; d++) {
    let t = 0, ha = 0, hs = 0;
    for (;;) {
      const dur = Te * band(energy(t));
      const fin = t + rest * dur;
      if (fin > DAY_SEC) { rest -= (DAY_SEC - t) / dur; break; }
      if (fin <= AWAKE_SEC) ha++; else hs++;
      t = fin;
      rest = 1;
    }
    if (d >= WARMUP_DAYS) { Ha.push(ha); Hs.push(hs); }
  }
  return { Ha, Hs };
}

// 睡眠中のおてつだいHs回のうち、スキル抽選が行われる回数の分布。
// 所持数が満タンになったおてつだいの後も、キューに残る QUEUE_AFTER_FULL 回は抽選される。
export function nightRolls(cap, Hs, ingP, berry) {
  const P = new Float64Array(Hs + 1);
  let d = new Float64Array(cap), n = new Float64Array(cap);
  d[0] = 1;
  let open = 1;
  for (let j = 1; j <= Hs; j++) {
    n.fill(0);
    for (let c = 0; c < cap; c++) {
      const x = d[c];
      if (!x) continue;
      if (c + berry < cap) n[c + berry] += x * (1 - ingP);
      for (const q of ING) if (c + q < cap) n[c + q] += x * ingP / ING.length;
    }
    [d, n] = [n, d];
    let s = 0;
    for (let c = 0; c < cap; c++) s += d[c];
    P[Math.min(Hs, j + QUEUE_AFTER_FULL)] += open - s;
    open = s;
  }
  P[Hs] += open;
  return { P, full: 1 - open };
}

// 性能値から、1日のおてつだい回数（日ごと）と各種確率を求める。
export function prepare(m, env) {
  const LV = env.N === 4 ? 70 : 60;
  const T = Math.floor(BASE * (1 - (LV - 1) * 0.002) * m.timeMul);
  const Te = env.camp ? T / 1.2 : T;
  const p = Math.min(1, P0 * m.skillMul);
  const ingP = Math.min(1, ING_P * m.ingMul);
  const cap = env.camp ? Math.ceil(m.cap * 1.2) : m.cap;
  return { T, Te, p, ingP, cap, ...schedule(Te, env.g80, m.wake) };
}

// 天井カウンタの分布を日ごとに追い、捨て日のあとの DAYS 日分の平均発動回数を返す。
// rollsOf(hs) は睡眠中 hs 回のおてつだいに対する nightRolls の結果。
//
// 連続不発回数 j の分布は、おてつだい1回ごとに「全体が1つ右にずれて (1-p) 倍、発動した分が j=0 へ」
// となるだけなので、リングバッファの先頭位置 h と共通倍率 sc を動かして1回あたり O(1) で進める。
// 睡眠中はストック数ごとに b0（ストック0）・b1（ストック1）を持ち、ストック2になった分は
// 抽選が止まって j=0 に固定されるのでスカラー z で持つ。
export function runDays(p, Ha, Hs, rollsOf) {
  const L = CEIL - 1, q = 1 - p;
  const b0 = new Float64Array(CEIL), b1 = new Float64Array(CEIL), fc = new Float64Array(CEIL);
  let h = 0, sc = 1;
  const at = (j) => (h + j) % CEIL;
  // おてつだい1回分、分布を1つずらして (1-p) 倍する。先頭 j=0 の値は呼び出し側で入れる。
  const step = () => {
    const slot = at(L);
    h = slot;
    sc *= q;
    if (sc < 1e-150) {
      for (let k = 0; k < CEIL; k++) { b0[k] *= sc; b1[k] *= sc; }
      sc = 1;
    }
  };
  b0[0] = 1;
  let sumDay = 0, sumNight = 0, sumRolls = 0, sumFull = 0;

  for (let d = -CHAIN_WARMUP; d < DAYS; d++) {
    const k = (d + DAYS) % DAYS;
    const ha = Ha[k], hs = Hs[k];
    const { P: RP, full } = rollsOf(hs);

    // 日中: 常にタップするのでストックは発生しない。分布の総量は常に1。
    let day = 0;
    for (let i = 0; i < ha; i++) {
      const last = b0[at(L)] * sc;
      const trig = p * (1 - last) + last;
      day += trig;
      step();
      b0[h] = trig / sc;
    }

    // 睡眠中: 抽選回数が i 回で止まる確率 RP[i] で、その時点の状態を足し合わせる。
    let A0 = 1, A1 = 0, z = 0, fz = 0, night = 0;
    fc.fill(0);
    const collect = (w) => {
      for (let j = 0; j < CEIL; j++) { const x = at(j); fc[j] += w * (b0[x] + b1[x]) * sc; }
      fz += w * z;
      night += w * (A1 + 2 * z);
    };
    if (RP[0]) collect(RP[0]);
    for (let i = 0; i < hs; i++) {
      const x = at(L);
      const last0 = b0[x] * sc, last1 = b1[x] * sc;
      const t0 = p * (A0 - last0) + last0;
      const t1 = p * (A1 - last1) + last1;
      step();
      b0[h] = 0;
      b1[h] = t0 / sc;
      z += t1;
      A0 -= t0;
      A1 += t0 - t1;
      if (RP[i + 1]) collect(RP[i + 1]);
    }

    // 起床時にストックは回収され、不発回数の分布だけが翌日に引き継がれる。
    h = 0; sc = 1;
    b0.set(fc);
    b0[0] += fz;
    b1.fill(0);

    if (d >= 0) {
      sumDay += day;
      sumNight += night;
      for (let j = 0; j <= hs; j++) sumRolls += j * RP[j];
      sumFull += full;
    }
  }
  return { day: sumDay / DAYS, night: sumNight / DAYS, rolls: sumRolls / DAYS, full: sumFull / DAYS };
}

const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

export function daily(m, env) {
  const r = prepare(m, env);
  const rolls = new Map();
  const rollsOf = (hs) => {
    if (!rolls.has(hs)) rolls.set(hs, nightRolls(r.cap, hs, r.ingP, m.berry));
    return rolls.get(hs);
  };
  return { ...r, ...runDays(r.p, r.Ha, r.Hs, rollsOf), Ha: avg(r.Ha), Hs: avg(r.Hs) };
}

export const envKey = (env) => `${env.N}|${env.camp}|${env.g80}`;

export const ALL_ENVS = [3, 4].flatMap((N) => [true, false].flatMap((camp) => [false, true].map((g80) => ({ N, camp, g80 }))));

// サブスキルN枠の効果合計の分布。1枠ごとに色を RARITY_P で抽選し、
// その色の中で未所持のものから均等に選ぶ（重複なし）。
export function subsetDist(n) {
  const byRarity = {};
  SUBS.forEach((s, i) => { (byRarity[s.rarity] = byRarity[s.rarity] || []).push(i); });
  const colors = Object.keys(RARITY_P);
  const out = new Map();
  const rec = (depth, mask, p, e) => {
    if (depth === n) {
      const k = `${e.sk.toFixed(4)}|${Math.min(0.35, e.sp).toFixed(4)}|${e.inv}|${e.ing.toFixed(4)}|${e.berry}|${e.erb}`;
      const o = out.get(k);
      if (o) o.p += p; else out.set(k, { e, p });
      return;
    }
    const avail = colors.map((c) => byRarity[c].filter((i) => !(mask & (1 << i))));
    const pc = colors.reduce((a, c, ci) => a + (avail[ci].length ? RARITY_P[c] : 0), 0);
    colors.forEach((c, ci) => {
      const list = avail[ci];
      if (!list.length) return;
      const q = p * (RARITY_P[c] / pc) / list.length;
      for (const i of list) rec(depth + 1, mask | (1 << i), q, addSub(e, SUBS[i]));
    });
  };
  rec(0, 0, 1, NO_SUBS);
  return [...out.values()];
}

// N・キャンプチケット・げんき条件ごとに結果をキャッシュする計算エンジンを生成する。
export function createEngine() {
  const metricCache = new Map();
  const distCache = new Map();

  // 睡眠中の抽選回数分布が同じ（例: 所持数が満タンにならない）個体は結果も同じなので、
  // 分布の中身をキーにして計算を共有する。
  const rollsCache = new Map();
  const rollsIds = new Map();
  function rollsFor(cap, hs, ingP, berry) {
    const key = `${cap}|${hs}|${ingP.toFixed(6)}|${berry}`;
    if (!rollsCache.has(key)) {
      const r = nightRolls(cap, hs, ingP, berry);
      const sig = Array.from(r.P, (x) => x.toFixed(12)).join(',');
      if (!rollsIds.has(sig)) rollsIds.set(sig, rollsIds.size);
      rollsCache.set(key, { ...r, id: rollsIds.get(sig) });
    }
    return rollsCache.get(key);
  }

  function metric(m, env) {
    const r = prepare(m, env);
    const rollsOf = (hs) => rollsFor(r.cap, hs, r.ingP, m.berry);
    const key = `${envKey(env)}|${r.p.toFixed(8)}|${r.Ha.join(',')}|${r.Hs.map((hs) => rollsOf(hs).id).join(',')}`;
    if (!metricCache.has(key)) {
      const d = runDays(r.p, r.Ha, r.Hs, rollsOf);
      metricCache.set(key, d.day + d.night);
    }
    return metricCache.get(key);
  }

  const baseMetric = (env) => metric(mk(NO_SUBS, null, null), env);
  const score = (subs, up, down, env) => metric(mults(subs, up, down), env) / baseMetric(env);

  function buildDist(env) {
    const natCount = {};
    NAT.forEach(([, u, d]) => {
      const k = `${cat(u)}|${cat(d)}`;
      natCount[k] = (natCount[k] || 0) + 1 / NAT.length;
    });
    const natEntries = Object.entries(natCount).map(([k, v]) => [...k.split('|'), v]);

    const b = baseMetric(env);
    const acc = new Map();
    for (const { e, p } of subsetDist(env.N)) {
      for (const [u, d, v] of natEntries) {
        const r = metric(mk(e, u, d), env) / b;
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
  const setDist = (env, d) => { distCache.set(envKey(env), d); };

  const atLeast = (r, env) => dist(env).reduce((a, x) => a + (x.r >= r * (1 - 1e-7) ? x.p : 0), 0);

  return { metric, baseMetric, score, mults, dist, ready, setDist, atLeast, daily };
}
