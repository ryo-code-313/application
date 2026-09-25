// DOM 描画とイベント配線。計算は calc.js のエンジンに委譲する。
import { byId, NAT, UNLOCK } from '../../js/constants.js';
import { fmtPct, trunc } from '../../js/format.js';
import { PICK, ING_SLOTS, NATL, NAT_CATS, natCat } from './constants.js';
import { mults, avgAmount, baseKey } from './calc.js';
import {
  state, loadSettings, setCamp, setG80, setMode, setBaseField, parseBase, resetSelection,
  currentSubs, isComplete, env, loadLog, appendLog, removeLogEntry,
} from './state.js';

const $ = (id) => document.getElementById(id);
const nameOf = (id) => (byId[id] && byId[id].name ? byId[id].name : 'なし他');
const chipHtml = (v, label, pressed, dis, cls) =>
  `<button class="chip ${cls || ''}" data-v="${v}" aria-pressed="${pressed}" ${dis ? 'disabled' : ''}>${label}</button>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
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

  $('camp').checked = state.camp;
  $('g80').checked = state.g80;
  $('camp').addEventListener('change', () => { setCamp($('camp').checked); refresh(engine); });
  $('g80').addEventListener('change', () => { setG80($('g80').checked); refresh(engine); });

  document.querySelectorAll('.mode button').forEach((b) => {
    b.onclick = () => { setMode(+b.dataset.n); refresh(engine); };
  });

  document.querySelectorAll('[data-base]').forEach((input) => {
    input.value = state.base[input.dataset.base];
    input.addEventListener('input', () => { setBaseField(input.dataset.base, input.value); refresh(engine); });
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
    const base = parseBase();
    if (!isComplete() || !base) return;
    const memo = prompt('メモ（空欄可）', '') || '';
    appendLog({ t: Date.now(), memo: memo.trim(), subs: currentSubs(), up: state.up, down: state.down, bk: baseKey(base) });
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

function renderHeader() {
  const b = parseBase();
  $('hdrBase').innerHTML = b
    ? `基準 <b>${Math.floor(b.time / 60)}:${String(b.time % 60).padStart(2, '0')}</b>食材確率 ${+(b.ingP * 100).toFixed(2)}%・所持数 ${b.cap}`
    : '基礎値を<b>入力</b>してください';
  $('baseErr').hidden = !!b || Object.values(state.base).every((v) => v.trim() === '');
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

const STAT_IDS = ['hAll', 'hDay', 'hNight', 'rTime', 'rCut', 'rHelps', 'rIng', 'rAmt', 'rIngHelps', 'rCap', 'rFull', 'rBase', 'rDRatio'];

function renderStats(engine) {
  const e = env();
  if (!e) {
    $('cond').textContent = '基礎値を入力すると計算します';
    STAT_IDS.forEach((id) => { $(id).textContent = '—'; });
    return;
  }
  const m = mults(currentSubs(), state.up, state.down);
  const { camp, g80 } = e;
  $('cond').textContent = `Lv.${state.N === 4 ? 70 : 60}・睡眠8.5時間・${g80 ? 'げんき常時81%以上' : `起床時げんき${m.wake}から10分ごとに1減少（回復スキルなし）`}・日中は常時タップで計算`;

  const r = engine.daily(m, e);
  const base = engine.baseMetric(e);
  const total = r.day + r.night;
  const ok = isComplete();
  const A = avgAmount(e.base.amounts);

  $('hAll').textContent = `${total.toFixed(1)}個`;
  $('hDay').textContent = r.day.toFixed(1);
  $('hNight').textContent = r.night.toFixed(1);

  const Tm = Math.floor(r.Te / 60), Ts = Math.floor(r.Te % 60);
  $('rTime').innerHTML = `${Tm}分${String(Ts).padStart(2, '0')}秒<span>${camp ? 'チケット込み・' : ''}げんき補正前</span>`;
  const cut = (1 - m.timeMul) * 100;
  $('rCut').innerHTML = `${cut >= 0 ? '−' : '+'}${trunc(Math.abs(cut))}%<span>性格・サブスキル合計</span>`;
  $('rHelps').innerHTML = `${(r.Ha + r.Hs).toFixed(1)}回<span>日中${r.Ha.toFixed(1)}回・睡眠中${r.Hs.toFixed(1)}回</span>`;
  $('rIng').innerHTML = `${(r.ingP * 100).toFixed(1)}%<span>基礎${+(e.base.ingP * 100).toFixed(2)}% × ${m.ingMul.toFixed(3)}</span>`;
  $('rAmt').innerHTML = `${A.toFixed(2)}個<span>${e.base.amounts.map((a, i) => `${ING_SLOTS[i]} ${a}個`).join('・')}を均等に</span>`;
  $('rIngHelps').innerHTML = `${((r.Ha + r.Hs) * r.ingP).toFixed(1)}回<span>所持数あふれを除く</span>`;
  $('rCap').innerHTML = `${r.cap}個<span>${camp ? 'チケット込み（×1.2切り上げ）・' : ''}きのみ${m.berry}個ずつ</span>`;
  $('rFull').innerHTML = `${(r.full * 100).toFixed(1)}%<span>あふれた食材 平均${r.lost.toFixed(1)}個</span>`;
  $('rBase').textContent = `${base.toFixed(1)}個`;
  $('rDRatio').textContent = ok ? `${(total / base).toFixed(2)}倍` : '—';
}

// One job at a time so a switch to a new condition waits behind at most one background job.
function requestDist(engine) {
  if (inFlight) return;
  const cur = env();
  if (!cur) return;
  const next = [cur, ...ALL_FLAGS.map((f) => ({ ...f, base: cur.base }))].find((e) => !engine.ready(e));
  if (!next) return;
  inFlight = next;
  worker.postMessage(next);
}

function renderBar(engine) {
  const e = env();
  const ok = isComplete() && !!e;
  ['bRatio', 'bRank', 'bOdds'].forEach((id) => $(id).classList.toggle('dim', !ok));
  $('save').disabled = !ok;
  if (!ok) {
    ['bRatio', 'bRank', 'bOdds'].forEach((id) => { $(id).textContent = '—'; });
    return;
  }
  const r = engine.score(currentSubs(), state.up, state.down, e);
  $('bRatio').textContent = `${r.toFixed(2)}倍`;
  if (!engine.ready(e)) {
    $('bRank').textContent = '計算中';
    $('bOdds').textContent = '…';
    requestDist(engine);
    return;
  }
  const ge = engine.atLeast(r, e);
  $('bRank').textContent = fmtPct(ge);
  $('bOdds').textContent = `${Math.round(1 / ge).toLocaleString()}匹`;
}

function renderLog(engine) {
  const e = env();
  const label = state.N === 4 ? 'Lv.70まで' : 'Lv.50まで';
  if (!e) {
    $('log').innerHTML = '<li class="empty">基礎値を入力すると、同じ基礎値の記録を表示します</li>';
    return;
  }
  const rd = engine.ready(e);
  requestDist(engine);
  const bk = baseKey(e.base);
  const L = loadLog()
    .filter((x) => x.bk === bk && x.subs.length === state.N)
    .map((x) => ({ ...x, r: engine.score(x.subs, x.up, x.down, e) }))
    .sort((a, b) => b.r - a.r);

  $('log').innerHTML = L.length
    ? L.map((x) => `<li><div>${esc(x.memo) || '—'}<div class="m">${x.subs.map(nameOf).join('／')}　▲${NATL[x.up]} ▼${NATL[x.down]}</div></div><div><b>${x.r.toFixed(2)}倍</b><div class="m">上位${rd ? fmtPct(engine.atLeast(x.r, e)) : '計算中'}</div></div><button class="del" data-t="${x.t}">削除</button></li>`).join('')
    : `<li class="empty">この基礎値・${label}の記録はまだありません</li>`;

  $('log').querySelectorAll('.del').forEach((b) => {
    b.onclick = () => { removeLogEntry(b.dataset.t); renderLog(engine); };
  });
}

function refresh(engine) {
  renderMode();
  renderHeader();
  renderSlots(engine);
  renderNat(engine);
  renderStats(engine);
  renderBar(engine);
  renderLog(engine);
}
