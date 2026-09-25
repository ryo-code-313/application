// DOM 描画とイベント配線。計算は calc.js のエンジンに委譲する。
import { byId, NAT, UNLOCK } from '../../js/constants.js';
import { fmtPct, trunc } from '../../js/format.js';
import { MONS, SLOT_LV, PICK, NATL, NAT_CATS, natCat, arrName } from './constants.js';
import { mults, slotsOf } from './calc.js';
import {
  state, loadSettings, setCamp, setG80, setMode, setTarget, resetSelection,
  currentSubs, isComplete, env, loadLog, appendLog, removeLogEntry,
} from './state.js';

const $ = (id) => document.getElementById(id);
const nameOf = (id) => (byId[id] && byId[id].name ? byId[id].name : 'なし他');
const chipHtml = (v, label, pressed, dis, cls) =>
  `<button class="chip ${cls || ''}" data-v="${v}" aria-pressed="${pressed}" ${dis ? 'disabled' : ''}>${label}</button>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const mon = () => MONS[state.mon];
const ALL_FLAGS = [3, 4].flatMap((N) => [true, false].flatMap((camp) => [false, true].map((g80) => ({ N, camp, g80 }))));

let worker = null;
let inFlight = null;

export function initUI(engine) {
  loadSettings();
  // Keeps the version tag on the worker URL so it loads the same module set as this page.
  worker = new Worker(new URL(`./worker.js${new URL(import.meta.url).search}`, import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    engine.setDist(data.env, data.dist);
    inFlight = null;
    renderBar(engine);
    renderLog(engine);
    requestDist(engine);
  };

  const mm = mon();
  document.title = `${mm.name} 厳選チェッカー`;
  $('monName').textContent = mm.name;
  $('hdrBase').innerHTML = `基準 <b>${Math.floor(mm.time / 60)}:${String(mm.time % 60).padStart(2, '0')}</b>食材確率 ${+(mm.ingP * 100).toFixed(2)}%・所持数 ${mm.cap}`;

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
    state.up = natCat(n[1]);
    state.down = natCat(n[2]);
    refresh(engine);
  };

  $('save').onclick = () => {
    if (!isComplete()) return;
    const memo = prompt('メモ（空欄可）', '') || '';
    appendLog({ t: Date.now(), memo: memo.trim(), mon: state.mon, arr: [...state.arr], subs: currentSubs(), up: state.up, down: state.down });
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

  refresh(engine);
}

function renderMode() {
  document.querySelectorAll('.mode button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === state.N)));
}

function renderIngs(engine) {
  const mm = mon();
  $('target').innerHTML = Object.keys(mm.ings).map((k) => chipHtml(k, `${k} ${mm.short[k]}`, state.target === k)).join('');
  $('target').querySelectorAll('.chip').forEach((b) => {
    b.onclick = () => { setTarget(b.dataset.v); refresh(engine); };
  });

  $('arr').innerHTML = mm.slots.map((opts, i) => `<div class="slot"><span>${SLOT_LV[i]}</span><div class="chips" data-i="${i}">${
    opts.map(([ing, a], k) => chipHtml(k, `${mm.short[ing]}×${a}`, state.arr[i] === k, opts.length === 1, ing === state.target ? 'tgt' : '')).join('')
  }</div></div>`).join('');
  $('arr').querySelectorAll('.chips').forEach((g) => g.querySelectorAll('.chip').forEach((b) => {
    b.onclick = () => {
      const i = +g.dataset.i, k = +b.dataset.v;
      state.arr[i] = state.arr[i] === k ? null : k;
      refresh(engine);
    };
  }));
}

function renderSlots(engine) {
  $('slots').innerHTML = UNLOCK.slice(0, state.N).map((lv, i) => {
    const used = currentSubs().filter((v, j) => j !== i && v && v !== 'none');
    return `<div class="slot"><span>Lv.${lv}</span><div class="chips" data-i="${i}">${PICK.map((id) => {
      const s = byId[id];
      return chipHtml(id, id === 'none' ? 'なし他' : s.name, state.subs[i] === id, used.includes(id), s && s.rarity === 'gold' ? 'hb' : '');
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
    $(k).innerHTML = NAT_CATS.map((c) => chipHtml(c, NATL[c], state[k] === c, c !== 'other' && other === c)).join('');
    $(k).querySelectorAll('.chip').forEach((b) => {
      b.onclick = () => {
        state[k] = state[k] === b.dataset.v ? null : b.dataset.v;
        $('nat').value = '';
        refresh(engine);
      };
    });
  });
}

const ARR_STATS = ['hAll', 'hDay', 'hNight', 'rAmt', 'rAllDay', 'rFull'];

function renderStats(engine) {
  const e = env(), mm = mon();
  const m = mults(currentSubs(), state.up, state.down);
  const tname = mm.short[state.target];
  $('cond').textContent = `Lv.${state.N === 4 ? 70 : 60}・睡眠8.5時間・${e.g80 ? 'げんき常時81%以上' : `起床時げんき${m.wake}から10分ごとに1減少（回復スキルなし）`}・日中は常時タップで計算`;
  $('hLabel').textContent = `1日の${tname}`;

  const ref = engine.reference(e);
  $('rBase').innerHTML = `${ref.v.toFixed(1)}個<span>${arrName(mm, ref.arr)}・無補正</span>`;

  // 食材配列が決まるまでは、無補正基準の配列で時間・確率などを表示する。
  const arrOk = !state.arr.includes(null);
  const r = engine.daily(m, arrOk ? state.arr : ref.arr, e);
  const Tm = Math.floor(r.Te / 60), Ts = Math.floor(r.Te % 60);
  $('rTime').innerHTML = `${Tm}分${String(Ts).padStart(2, '0')}秒<span>${e.camp ? 'チケット込み・' : ''}げんき補正前</span>`;
  const cut = (1 - m.timeMul) * 100;
  $('rCut').innerHTML = `${cut >= 0 ? '−' : '+'}${trunc(Math.abs(cut))}%<span>性格・サブスキル合計</span>`;
  $('rHelps').innerHTML = `${(r.Ha + r.Hs).toFixed(1)}回<span>日中${r.Ha.toFixed(1)}回・睡眠中${r.Hs.toFixed(1)}回</span>`;
  $('rIng').innerHTML = `${(r.ingP * 100).toFixed(1)}%<span>基礎${+(mm.ingP * 100).toFixed(2)}% × ${m.ingMul.toFixed(3)}</span>`;
  $('rIngHelps').innerHTML = `${((r.Ha + r.Hs) * r.ingP).toFixed(1)}回<span>所持数あふれを除く</span>`;
  $('rCap').innerHTML = `${r.cap}個<span>${e.camp ? 'チケット込み・' : ''}きのみ${m.berry}個</span>`;

  if (!arrOk) {
    ARR_STATS.forEach((id) => { $(id).textContent = '—'; });
    $('rDRatio').textContent = '—';
    return;
  }
  const slots = slotsOf(mm, state.arr);
  const total = r.day + r.night;
  const tAmt = slots.reduce((s, [ing, a]) => s + (ing === state.target ? a : 0), 0) / slots.length;
  const allAmt = slots.reduce((s, [, a]) => s + a, 0) / slots.length;
  $('hAll').textContent = `${total.toFixed(1)}個`;
  $('hDay').textContent = r.day.toFixed(1);
  $('hNight').textContent = r.night.toFixed(1);
  $('rAmt').innerHTML = `${tAmt.toFixed(2)}個<span>全食材${allAmt.toFixed(2)}個</span>`;
  $('rAllDay').innerHTML = `${(r.dayAll + r.nightAll).toFixed(1)}個<span>日中${r.dayAll.toFixed(1)}個・睡眠中${r.nightAll.toFixed(1)}個</span>`;
  $('rFull').innerHTML = `${(r.full * 100).toFixed(1)}%<span>あふれた食材 平均${r.lost.toFixed(1)}個</span>`;
  $('rDRatio').textContent = isComplete() ? `${(total / ref.v).toFixed(2)}倍` : '—';
}

// One job at a time so a switch to a new condition waits behind at most one background job.
function requestDist(engine) {
  if (inFlight) return;
  const cur = env();
  const next = [cur, ...ALL_FLAGS.map((f) => ({ ...cur, ...f }))].find((e) => !engine.ready(e));
  if (!next) return;
  inFlight = next;
  worker.postMessage(next);
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
  const r = engine.score(currentSubs(), state.up, state.down, state.arr, e);
  $('bRatio').textContent = `${r.toFixed(2)}倍`;
  if (!engine.ready(e)) {
    $('bRank').textContent = '計算中';
    $('bOdds').textContent = '…';
    requestDist(engine);
    return;
  }
  const ge = engine.atLeast(r, e);
  $('bRank').textContent = r > 0 ? fmtPct(ge) : '—';
  $('bOdds').textContent = r > 0 ? `${Math.round(1 / ge).toLocaleString()}匹` : '—';
}

function renderLog(engine) {
  const e = env(), mm = mon();
  const rd = engine.ready(e);
  requestDist(engine);
  const L = loadLog()
    .filter((x) => x.mon === state.mon && x.subs.length === state.N)
    .map((x) => ({ ...x, r: engine.score(x.subs, x.up, x.down, x.arr, e) }))
    .sort((a, b) => b.r - a.r);

  $('log').innerHTML = L.length
    ? L.map((x) => `<li><div>${esc(x.memo) || '—'}<div class="m">${arrName(mm, x.arr)}　${x.subs.map(nameOf).join('／')}　▲${NATL[x.up]} ▼${NATL[x.down]}</div></div><div><b>${x.r.toFixed(2)}倍</b><div class="m">上位${rd ? (x.r > 0 ? fmtPct(engine.atLeast(x.r, e)) : '—') : '計算中'}</div></div><button class="del" data-t="${x.t}">削除</button></li>`).join('')
    : `<li class="empty">${state.N === 4 ? 'Lv.70まで' : 'Lv.50まで'}の記録はまだありません</li>`;

  $('log').querySelectorAll('.del').forEach((b) => {
    b.onclick = () => { removeLogEntry(b.dataset.t); renderLog(engine); };
  });
}

function refresh(engine) {
  renderMode();
  renderIngs(engine);
  renderSlots(engine);
  renderNat(engine);
  renderStats(engine);
  renderBar(engine);
  renderLog(engine);
}
