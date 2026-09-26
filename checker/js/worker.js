import { createEngines } from './types.js';
import { cacheKey, loadDist, saveDist } from './distcache.js';

const engines = createEngines();

// 保存してある分布があればそれを返し、なければ計算して保存する。
// 計算が必要なときは先に { computing: true } を送り、画面に「計算中」と出せるようにする。
self.onmessage = async ({ data: { type, env } }) => {
  const key = cacheKey(type, env);
  const saved = await loadDist(key);
  if (saved) {
    self.postMessage({ type, env, dist: saved });
    return;
  }
  self.postMessage({ type, env, computing: true });
  const dist = engines[type].dist(env);
  self.postMessage({ type, env, dist });
  await saveDist(key, dist);
};
