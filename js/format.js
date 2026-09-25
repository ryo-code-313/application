// 表示用フォーマット関数。
export const trunc = (x) => Math.trunc(x + 1e-9);

export const fmtPct = (p) => {
  const v = p * 100;
  return v >= 0.01 ? `${v.toFixed(2)}%` : `${v.toPrecision(2)}%`;
};

export const mmss = (sec) => {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return (h ? `${h}時間` : '') + (h ? String(m).padStart(2, '0') : m) + '分' + String(s).padStart(2, '0') + '秒';
};
