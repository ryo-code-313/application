import { createEngine } from './calc.js';

const engine = createEngine();

self.onmessage = ({ data: env }) => {
  self.postMessage({ env, dist: engine.dist(env) });
};
