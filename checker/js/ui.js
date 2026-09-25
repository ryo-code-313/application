// DOM 描画とイベント配線。計算はタイプごとの calc.js のエンジンに委譲する。
import { byId, NAT, UNLOCK } from '../../js/constants.js';
import { fmtPct, trunc } from '../../js/format.js';
import { TYPES } from './types.js';
import { arrName, SLOT_LV } from './ingredient/constants.js';
import { slotsOf } from './ingredient/calc.js';
import {
  state, monData, loadSettings, setCamp, setG80, setMode, setMon, setType, setTarget, resetSelection,
  currentSubs, isComplete, env, loadLog, appendLog, removeLogEntry,
} from './state.js';

const $ = (id) => document.getElementById(id);
const nameOf = (id) => (byId[id] && byId[id].name ? byId[id].name : 'なし他');
const chipHtml = (v, label, pressed, dis, cls) =>
  `<button class="chip ${cls || ''}" data-v="${v}" aria-pressed="${pressed}" ${dis ? 'disabled' : ''}>${label}</button>`;
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ALL_FLAGS = [3, 4].flatMap((N) => [true, false].flatMap((camp) => [false, true].map((g80) => ({ N, camp, g80 }))));
const def = () => TYPES[state.type];

// 性能の行。'grp' は見出し行。
const ROWS = {
  ingredient: [
    ['grp', 'おてつだい'], ['rTime', 'おてつだい時間'], ['rCut', '時間の短縮'], ['rHelps', '1日のおてつだい回数'],
    ['grp', '食材'], ['rIng', '食材確率'], ['rAmt', '1回あたりの狙い食材'], ['rIngHelps', '1日の食材おてつだい回数'],
    ['rAllDay', '1日の全食材の個数'], ['rCap', '最大所持数'], ['rFull', '睡眠中に満タンになる確率'],
    ['grp', '無補正個体との比較'], ['rBase', '無補正個体の1日個数'], ['rDRatio', '1日の個数の比（順位の基準）'], ['rPos', '全パターン中の順位'],
  ],
  berry: [
    ['grp', 'おてつだい'], ['rTime', 'おてつだい時間'], ['rCut', '時間の短縮'], ['rHelps', '1日のおてつだい回数'],
    ['grp', 'きのみ'], ['rEnergy', 'きのみ1個のエナジー'], ['rAmt', '1回あたりのきのみ'], ['rCount', '1日のきのみの個数'],
    ['grp', '所持数'], ['rIng', '食材確率（満タンまで）'], ['rCap', '最大所持数'], ['rFull', '就寝時までに満タンになる確率'],
    ['rIngs', '1日に持ち帰る食材'],
    ['grp', '無補正個体との比較'], ['rBase', '無補正個体の1日エナジー'], ['rDRatio', '1日のエナジーの比（順位の基準）'], ['rPos', '全パターン中の順位'],
  ],
};

// 記録・順位で使う、タイプごとのスコア（無補正比）。
const scoreOf = (engine, x, e) => (state.type === 'ingredient'
  ? engine.score(x.subs, x.up, x.down, x.arr, e)
  : engine.score(x.subs, x.up, x.down, e));

// 全パターン中の順位。分布は無補正比の値ごとに1行なので、自分より高い値の数 + 1 が順位になる。
// 無補正比が同じ個体は同じ順位。分布ができてから呼ぶ。
function rankOf(engine, r, e) {
  const d = engine.dist(e);
  return { pos: 1 + d.filter((x) => x.r > r * (1 + 1e-7)).length, total: d.length };
}
const fmtPos = ({ pos, total }) => `${pos.toLocaleString()}位 / ${total.toLocaleString()}`;

let worker = null;
let inFlight = null;

export function initUI(engines) {
  loadSettings();
  // Keeps the version tag on the worker URL so it loads the same module set as this page.
  worker = new Worker(new URL(`./worker.js${new URL(import.meta.url).search}`, import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }) => {
    engines[data.type].setDist(data.env, data.dist);
    inFlight = null;
    renderBar(engines);
    renderLog(engines);
    requestDist(engines);
  };

  // 選んだポケモンを URL にも残して、ブックマークや共有で開けるようにする。
  const syncUrl = () => {
    try { history.replaceState(null, '', `?mon=${encodeURIComponent(state.mon)}`); } catch { /* history unavailable */ }
  };
  $('tabs').innerHTML = Object.entries(TYPES).map(([t, d]) =>
    `<button role="tab" id="tab-${t}" data-type="${t}">${d.label}<small>${Object.keys(d.MONS).length}匹</small></button>`).join('');
  $('tabs').querySelectorAll('[role="tab"]').forEach((b) => {
    b.onclick = () => { setType(b.dataset.type); syncUrl(); refresh(engines); window.scrollTo({ top: 0 }); };
  });
  // 左右キーでタブを移る。
  $('tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const tabs = [...$('tabs').querySelectorAll('[role="tab"]')];
    const i = tabs.findIndex((b) => b.dataset.type === state.type);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    next.click();
    next.focus();
  });
  $('mon').onchange = (e) => { setMon(e.target.value); syncUrl(); refresh(engines); };

  $('camp').checked = state.camp;
  $('g80').checked = state.g80;
  $('camp').addEventListener('change', () => { setCamp($('camp').checked); refresh(engines); });
  $('g80').addEventListener('change', () => { setG80($('g80').checked); refresh(engines); });

  document.querySelectorAll('.mode button').forEach((b) => {
    b.onclick = () => { setMode(+b.dataset.n); refresh(engines); };
  });

  $('nat').innerHTML = '<option value="">選ぶと上昇・下降が入ります</option>' + NAT.map((n) => `<option>${n[0]}</option>`).join('');
  $('nat').onchange = (e) => {
    const n = NAT.find((x) => x[0] === e.target.value);
    if (!n) return;
    state.up = def().natCat(n[1]);
    state.down = def().natCat(n[2]);
    refresh(engines);
  };

  $('save').onclick = () => {
    if (!isComplete()) return;
    const memo = prompt('メモ（空欄可）', '') || '';
    const entry = { t: Date.now(), memo: memo.trim(), mon: state.mon, subs: currentSubs(), up: state.up, down: state.down };
    appendLog(state.type === 'ingredient' ? { ...entry, arr: [...state.arr] } : entry);
    renderLog(engines);
    $('save').textContent = '記録済';
    setTimeout(() => { $('save').textContent = '記録'; }, 1200);
  };

  $('reset').onclick = () => {
    resetSelection();
    $('nat').value = '';
    refresh(engines);
    window.scrollTo({ top: 0 });
  };

  refresh(engines);
}

let shownType = null;

function renderHeader() {
  const mm = monData(), d = def();
  document.documentElement.dataset.type = state.type;
  document.title = `${mm.name} ${d.label} 厳選チェッカー`;
  $('tabs').querySelectorAll('[role="tab"]').forEach((b) => {
    const on = b.dataset.type === state.type;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
  });
  // ポケモンの一覧は今のタイプのものだけにする。
  if (shownType !== state.type) {
    shownType = state.type;
    $('mon').innerHTML = Object.entries(d.MONS).map(([k, m]) => `<option value="${k}">${esc(m.name)}</option>`).join('');
  }
  $('mon').value = state.mon;

  // 「キュウコン(アローラのすがた)」のような姿の名前は2行目に小さく出す。
  const [, base, form] = mm.name.match(/^([^(]+)(?:\((.+)\))?$/);
  $('monName').innerHTML = esc(base) + (form ? `<span class="form">${esc(form)}</span>` : '');
  $('typeName').textContent = `${d.label} 厳選チェッカー`;
  const fact = (label, value) => `<div><small>${label}</small><b>${value}</b></div>`;
  $('facts').innerHTML = fact('おてつだい', `${Math.floor(mm.time / 60)}:${String(mm.time % 60).padStart(2, '0')}`)
    + fact('食材確率', `${+(mm.ingP * 100).toFixed(1)}%`) + fact('最大所持数', mm.cap)
    + (state.type === 'berry' ? fact('きのみ', `×${mm.berries}`) : '');
  const ings = [...new Set(mm.slots.flat().map(([i]) => mm.ings[i]))].join('／');
  $('monInfo').textContent = state.type === 'berry' ? `${mm.berry}・食材 ${ings}` : `食材 ${ings}`;
  $('arrSec').hidden = state.type !== 'ingredient';
  $('reset').textContent = state.type === 'ingredient' ? '食材配列・サブスキル・性格を消す' : 'サブスキル・性格を消す';
  $('rows').innerHTML = ROWS[state.type].map(([id, label]) => (id === 'grp'
    ? `<dt class="grp">${label}</dt><dd class="grp" style="display:none"></dd>`
    : `<dt>${label}</dt><dd id="${id}">—</dd>`)).join('');
}

function renderMode() {
  document.querySelectorAll('.mode button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.n === state.N)));
}

function renderIngs(engines) {
  if (state.type !== 'ingredient') return;
  const mm = monData();
  $('target').innerHTML = Object.keys(mm.ings).map((k) => chipHtml(k, `${k} ${mm.short[k]}`, state.target === k)).join('');
  $('target').querySelectorAll('.chip').forEach((b) => {
    b.onclick = () => { setTarget(b.dataset.v); refresh(engines); };
  });

  $('arr').innerHTML = mm.slots.map((opts, i) => `<div class="slot"><span>${SLOT_LV[i]}</span><div class="chips" data-i="${i}">${
    opts.map(([ing, a], k) => chipHtml(k, `${mm.short[ing]}×${a}`, state.arr[i] === k, opts.length === 1, ing === state.target ? 'tgt' : '')).join('')
  }</div></div>`).join('');
  $('arr').querySelectorAll('.chips').forEach((g) => g.querySelectorAll('.chip').forEach((b) => {
    b.onclick = () => {
      const i = +g.dataset.i, k = +b.dataset.v;
      state.arr[i] = state.arr[i] === k ? null : k;
      refresh(engines);
    };
  }));
}

function renderSlots(engines) {
  const { PICK } = def();
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
      refresh(engines);
    };
  }));
}

function renderNat(engines) {
  const { NAT_CATS, NATL } = def();
  ['up', 'down'].forEach((k) => {
    const other = k === 'up' ? state.down : state.up;
    $(k).innerHTML = NAT_CATS.map((c) => chipHtml(c, NATL[c], state[k] === c, c !== 'other' && other === c)).join('');
    $(k).querySelectorAll('.chip').forEach((b) => {
      b.onclick = () => {
        state[k] = state[k] === b.dataset.v ? null : b.dataset.v;
        $('nat').value = '';
        refresh(engines);
      };
    });
  });
}

const condText = (m, e) => `Lv.${state.N === 4 ? 70 : 60}・睡眠8.5時間・${e.g80 ? 'げんき常時81%以上' : `起床時げんき${m.wake}から10分ごとに1減少（回復スキルなし）`}`;
const timeRows = (r, m, e) => {
  const Tm = Math.floor(r.Te / 60), Ts = Math.floor(r.Te % 60);
  $('rTime').innerHTML = `${Tm}分${String(Ts).padStart(2, '0')}秒<span>${e.camp ? 'チケット込み・' : ''}げんき補正前</span>`;
  const cut = (1 - m.timeMul) * 100;
  $('rCut').innerHTML = `${cut >= 0 ? '−' : '+'}${trunc(Math.abs(cut))}%<span>性格・サブスキル合計</span>`;
  $('rHelps').innerHTML = `${(r.Ha + r.Hs).toFixed(1)}回<span>日中${r.Ha.toFixed(1)}回・睡眠中${r.Hs.toFixed(1)}回</span>`;
};

const ARR_STATS = ['hAll', 'hDay', 'hNight', 'rAmt', 'rAllDay', 'rFull'];

// 未選択のサブスキル・性格は「なし他」・無補正として計算する。
function renderIngStats(engine) {
  const e = env(), mm = monData();
  const m = def().mults(currentSubs(), state.up, state.down);
  $('cond').textContent = `${condText(m, e)}・日中は常時タップで計算`;
  $('hLabel').textContent = `1日の${mm.short[state.target]}`;

  const ref = engine.reference(e);
  $('rBase').innerHTML = `${ref.v.toFixed(1)}個<span>${arrName(mm, ref.arr)}・無補正</span>`;

  // 食材配列が決まるまでは、無補正基準の配列で時間・確率などを表示する。
  const arrOk = !state.arr.includes(null);
  const r = engine.daily(m, arrOk ? state.arr : ref.arr, e);
  timeRows(r, m, e);
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

function renderBerryStats(engine) {
  const e = env(), mm = monData();
  const m = def().mults(currentSubs(), state.up, state.down);
  $('cond').textContent = `${condText(m, e)}・起床時に回収して日中はタップしない（いつのまに育成）・食材配列は全パターンの平均で計算`;
  $('hLabel').textContent = '1日のきのみエナジー';

  const base = engine.baseMetric(e);
  const r = engine.daily(m, e);
  const count = r.day + r.night;
  const total = count * r.energy;
  $('hAll').textContent = Math.round(total).toLocaleString();
  $('hDay').textContent = Math.round(r.day * r.energy).toLocaleString();
  $('hNight').textContent = Math.round(r.night * r.energy).toLocaleString();

  timeRows(r, m, e);
  $('rEnergy').innerHTML = `${r.energy}<span>${mm.berry} Lv.${r.LV}</span>`;
  $('rAmt').innerHTML = `${r.berry}個<span>${m.berry ? `基礎${mm.berries}個＋きのみの数S` : 'きのみタイプ'}</span>`;
  $('rCount').innerHTML = `${count.toFixed(1)}個<span>日中${r.day.toFixed(1)}個・睡眠中${r.night.toFixed(1)}個</span>`;
  $('rIng').innerHTML = `${(r.ingP * 100).toFixed(1)}%<span>基礎${+(mm.ingP * 100).toFixed(2)}% × ${m.ingMul.toFixed(3)}</span>`;
  $('rCap').innerHTML = `${r.cap}個<span>${e.camp ? 'チケット込み' : '基礎＋サブスキル'}</span>`;
  $('rFull').innerHTML = `${(r.fullBed * 100).toFixed(1)}%<span>起床時まで${(r.full * 100).toFixed(1)}%</span>`;
  $('rIngs').innerHTML = `${r.ings.toFixed(1)}個<span>満タンになるまで</span>`;
  $('rBase').innerHTML = `${Math.round(base).toLocaleString()}<span>無補正</span>`;
  $('rDRatio').textContent = isComplete() ? `${(total / base).toFixed(2)}倍` : '—';
}

// One job at a time so a switch to a new condition waits behind at most one background job.
function requestDist(engines) {
  if (inFlight) return;
  const type = state.type, engine = engines[type];
  const cur = env();
  const next = [cur, ...ALL_FLAGS.map((f) => ({ ...cur, ...f }))].find((e) => !engine.ready(e));
  if (!next) return;
  inFlight = next;
  worker.postMessage({ type, env: next });
}

function renderBar(engines) {
  const ok = isComplete();
  ['bRatio', 'bRank', 'bOdds'].forEach((id) => $(id).classList.toggle('dim', !ok));
  $('save').disabled = !ok;
  const setPos = (bar, row) => { $('bPos').textContent = bar; if ($('rPos')) $('rPos').innerHTML = row; };
  if (!ok) {
    ['bRatio', 'bRank', 'bOdds'].forEach((id) => { $(id).textContent = '—'; });
    setPos('', '—');
    return;
  }
  const e = env(), engine = engines[state.type];
  const r = scoreOf(engine, { subs: currentSubs(), up: state.up, down: state.down, arr: state.arr }, e);
  $('bRatio').textContent = `${r.toFixed(2)}倍`;
  if (!engine.ready(e)) {
    $('bRank').textContent = '計算中';
    $('bOdds').textContent = '…';
    setPos('', '計算中');
    requestDist(engines);
    return;
  }
  const ge = engine.atLeast(r, e);
  $('bRank').textContent = r > 0 ? fmtPct(ge) : '—';
  $('bOdds').textContent = r > 0 ? `${Math.round(1 / ge).toLocaleString()}匹` : '—';
  const rk = rankOf(engine, r, e);
  setPos(fmtPos(rk), `${rk.pos.toLocaleString()}位<span>${rk.total.toLocaleString()}パターン中（無補正比が同じものは同順位）</span>`);
}

function renderLog(engines) {
  const e = env(), mm = monData(), engine = engines[state.type], { NATL } = def();
  const rd = engine.ready(e);
  requestDist(engines);
  const L = loadLog()
    .filter((x) => x.subs.length === state.N)
    .map((x) => ({ ...x, r: scoreOf(engine, x, e) }))
    .sort((a, b) => b.r - a.r);

  $('log').innerHTML = L.length
    ? L.map((x) => `<li><div>${esc(x.memo) || '—'}<div class="m">${state.type === 'ingredient' ? `${arrName(mm, x.arr)}　` : ''}${x.subs.map(nameOf).join('／')}　▲${NATL[x.up]} ▼${NATL[x.down]}</div></div><div><b>${x.r.toFixed(2)}倍</b><div class="m">${rd ? (x.r > 0 ? `上位${fmtPct(engine.atLeast(x.r, e))}<br>${fmtPos(rankOf(engine, x.r, e))}` : '—') : '計算中'}</div></div><button class="del" data-t="${x.t}">削除</button></li>`).join('')
    : `<li class="empty">${state.N === 4 ? 'Lv.70まで' : 'Lv.50まで'}の記録はまだありません</li>`;

  $('log').querySelectorAll('.del').forEach((b) => {
    b.onclick = () => { removeLogEntry(b.dataset.t); renderLog(engines); };
  });
}

function refresh(engines) {
  renderHeader();
  renderMode();
  renderIngs(engines);
  renderSlots(engines);
  renderNat(engines);
  if (state.type === 'ingredient') renderIngStats(engines.ingredient); else renderBerryStats(engines.berry);
  renderBar(engines);
  renderLog(engines);
}
