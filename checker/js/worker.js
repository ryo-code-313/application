import { createEngines } from './types.js';

const engines = createEngines();

self.onmessage = ({ data: { type, env } }) => {
  self.postMessage({ type, env, dist: engines[type].dist(env) });
};
