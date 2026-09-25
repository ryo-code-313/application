// DOM 描画とイベント配線。計算は calc.js のエンジンに委譲する。
import { PICK, byId, NAT, NATL, UNLOCK, cat } from './constants.js';
import { mults, eff } from './calc.js';
import { fmtPct, mmss, trunc } from './format.js';
import {
  state, loadSettings, setCamp, setG80, setMode, resetSelection,
  currentSubs, isComplete, env, loadLog, appendLog, removeLogEntry,
} from './state.js';

const $ = (id) => document.getElementById(id);
const nameOf = (id) => (byId[id] && byId[id].name ? byId[id].name : 'なし他');
const chipHtml = (v, label, pressed, dis, cls) =>
  `<button class="chip ${cls || ''}" data-v="${v}" aria-pressed="${pressed}" ${dis ? 'disabled' : ''}>${label}</button>`;

export function initUI(engine) {
  loadSettings();

  $('camp').checked = state.camp;
  $('g80').checked = state.g80;
  $('camp').addEventListener('change', () => { setCamp($('camp').checked); refresh(engine); });
  $('g80').addEventListener('change', () => { setG80($('g80').checked); refresh(engine); });

  document.querySelectorAll('.mode button').forEach((b) => {
    b.onclick = () => { setMode(+b.dataset.n); refresh(engine); };
  });

  $('nat').innerHTML = '<option value="">選ぶと上昇・下降が入ります</option>' + NAT.map((n) => `<option>${n[0]}</option>`).join('');
  $('nat').onchange = (e) => {
    const n = NAT.find((x) => x[0] === e.target.value);
    if (!n) return;
    state.up = cat(n[1]);
    state.down = cat(n[2]);
    refresh(engine);
  };

  $('save').onclick = () => {
    if (!isComplete()) return;
    const memo = prompt('メモ（空欄可）', '') || '';
    appendLog({ t: Date.now(), memo: memo.trim(), subs: currentSubs(), up: state.up, down: state.down });
    renderLog(engine);
    $('save').textContent = '記録済';
    setTimeout(() => { $('save').textContent = '記録'; }, 1200);
  };

  $('reset').onclick = () => {
    resetSelection();
    $('nat').value = '';
    refresh(engine);
    window.scrollTo({ top: 0 });
  };

  renderLog(engine);
  refresh(engine);
}

function renderMode() {
  document.querySelectorAll('.mode button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === state.N)));
}

function renderSlots(engine) {
  $('slots').innerHTML = UNLOCK.slice(0, state.N).map((lv, i) => {
    const used = currentSubs().filter((v, j) => j !== i && v && v !== 'none');
    return `<div class="slot"><span>Lv.${lv}</span><div class="chips" data-i="${i}">${PICK.map((id) => {
      const s = byId[id];
      return chipHtml(id, id === 'none' ? 'なし他' : s.name, state.subs[i] === id, used.includes(id), s && s.gold ? 'hb' : '');
    }).join('')}</div></div>`;
  }).join('');
  $('slots').querySelectorAll('.chips').forEach((g) => g.querySelectorAll('.chip').forEach((b) => {
    b.onclick = () => {
      const i = +g.dataset.i, v = b.dataset.v;
      state.subs[i] = state.subs[i] === v ? null : v;
      refresh(engine);
    };
  }));
}

function renderNat(engine) {
  ['up', 'down'].forEach((k) => {
    const other = k === 'up' ? state.down : state.up;
    $(k).innerHTML = ['skill', 'speed', 'other'].map((c) => chipHtml(c, NATL[c], state[k] === c, c !== 'other' && other === c)).join('');
    $(k).querySelectorAll('.chip').forEach((b) => {
      b.onclick = () => {
        state[k] = state[k] === b.dataset.v ? null : b.dataset.v;
        $('nat').value = '';
        refresh(engine);
      };
    });
  });
}

function renderStats(engine) {
  const m = mults(currentSubs(), state.up, state.down);
  const camp = state.camp, g80 = state.g80, e = env();
  $('cond').textContent = `Lv.${state.N === 4 ? 70 : 60}・睡眠8.5時間・${g80 ? 'げんき常時81%以上' : '起床時げんき100（回復なし）'}・日中は常時タップで計算`;

  const r = engine.daily(m.timeMul, m.skillMul, camp, m.cap, g80, state.N);
  const base = engine.baseMetric(e);
  const total = r.day + r.night;
  const ok = isComplete();
  const p = eff(r.p);
  const avg = 1 / p;

  $('hAll').textContent = `${total.toFixed(2)}回`;
  $('hDay').textContent = r.day.toFixed(2);
  $('hNight').textContent = r.night.toFixed(2);

  const Tm = Math.floor(r.Te / 60), Ts = Math.floor(r.Te % 60);
  $('rTime').innerHTML = `${Tm}分${String(Ts).padStart(2, '0')}秒<span>${camp ? 'チケット込み・' : ''}げんき補正前</span>`;
  const cut = (1 - m.timeMul) * 100;
  $('rCut').innerHTML = `${cut >= 0 ? '−' : '+'}${trunc(Math.abs(cut))}%<span>性格・サブスキル合計</span>`;
  $('rHelps').innerHTML = `${r.Ha + r.Hs}回<span>日中${r.Ha}回・睡眠中${r.Hs}回</span>`;
  $('rCap').innerHTML = `${r.cap}個<span>${camp ? 'チケット込み（×1.2切り上げ）' : '基礎24＋サブスキル'}</span>`;
  $('rRoll').innerHTML = `${r.rolls.toFixed(1)}回<span>睡眠中${r.Hs}回のうち・満タン確率${(r.full * 100).toFixed(1)}%</span>`;
  $('rRate').innerHTML = `${(r.p * 100).toFixed(2)}%<span>基礎2.9% × ${m.skillMul.toFixed(3)}</span>`;
  $('rEff').innerHTML = `${(p * 100).toFixed(2)}%<span>62回目で確定を含む平均</span>`;
  $('rAvg').textContent = `${avg.toFixed(1)}回`;
  $('rAvgT').innerHTML = `${mmss(avg * r.Te * 0.45)}<span>げんき81%以上のとき</span>`;
  $('rBase').textContent = `${base.toFixed(2)}回`;
  $('rDRatio').textContent = ok ? `${(total / base).toFixed(2)}倍` : '—';
  $('rRatio').textContent = ok ? `${m.ratio.toFixed(2)}倍` : '—';
}

let warmPending = false;
function warm(engine) {
  const e = env();
  if (engine.ready(e) || warmPending) return;
  warmPending = true;
  setTimeout(() => {
    try { engine.dist(e); } finally { warmPending = false; }
    renderBar(engine);
    renderLog(engine);
  }, 40);
}

function renderBar(engine) {
  const ok = isComplete();
  ['bRatio', 'bRank', 'bOdds'].forEach((id) => $(id).classList.toggle('dim', !ok));
  $('save').disabled = !ok;
  if (!ok) {
    ['bRatio', 'bRank', 'bOdds'].forEach((id) => { $(id).textContent = '—'; });
    return;
  }
  const e = env();
  const r = engine.score(currentSubs(), state.up, state.down, e);
  if (!engine.ready(e)) {
    $('bRatio').textContent = `${r.toFixed(2)}倍`;
    $('bRank').textContent = '計算中';
    $('bOdds').textContent = '…';
    warm(engine);
    return;
  }
  const ge = engine.atLeast(r, e);
  $('bRatio').textContent = `${r.toFixed(2)}倍`;
  $('bRank').textContent = fmtPct(ge);
  $('bOdds').textContent = `${Math.round(1 / ge).toLocaleString()}匹`;
}

function renderLog(engine) {
  const e = env();
  const rd = engine.ready(e);
  if (!rd) warm(engine);
  const L = loadLog()
    .filter((x) => x.subs.length === state.N)
    .map((x) => {
      const up = cat(x.up), down = cat(x.down);
      return { ...x, up, down, r: engine.score(x.subs, up, down, e) };
    })
    .sort((a, b) => b.r - a.r);

  $('log').innerHTML = L.length
    ? L.map((x) => `<li><div>${x.memo || '—'}<div class="m">${x.subs.map(nameOf).join('／')}　▲${NATL[x.up]} ▼${NATL[x.down]}</div></div><div><b>${x.r.toFixed(2)}倍</b><div class="m">上位${rd ? fmtPct(engine.atLeast(x.r, e)) : '計算中'}</div></div><button class="del" data-t="${x.t}">削除</button></li>`).join('')
    : `<li class="empty">${state.N === 4 ? 'Lv.70まで' : 'Lv.50まで'}の記録はまだありません</li>`;

  $('log').querySelectorAll('.del').forEach((b) => {
    b.onclick = () => { removeLogEntry(b.dataset.t); renderLog(engine); };
  });
}

function refresh(engine) {
  renderMode();
  renderSlots(engine);
  renderNat(engine);
  renderStats(engine);
  renderBar(engine);
}
