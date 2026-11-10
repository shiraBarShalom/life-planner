// Central state container: one JSON document persisted to IndexedDB.
// Every change goes through store.commit(), which snapshots for undo,
// schedules a debounced save and re-renders subscribers.
import * as db from './db.js';
import { createSeed, SCHEMA } from './seed.js';
import { invalidate } from './engine.js';

let state = null;
let version = 0;
let saveTimer = null;
const subs = new Set();
const undoStack = [];

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const clone = (o) => JSON.parse(JSON.stringify(o));

function migrate(s) {
  // Fill in any collections that newer versions added.
  const base = createSeed({ empty: true });
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  s.settings = { ...base.settings, ...s.settings };
  s.settings.planner = { ...base.settings.planner, ...(s.settings.planner || {}) };
  s.schema = SCHEMA;
  return s;
}

export function validateBackup(obj) {
  return obj && typeof obj === 'object' && Array.isArray(obj.series) && Array.isArray(obj.tasks) && obj.settings && Array.isArray(obj.categories);
}

async function save() {
  clearTimeout(saveTimer);
  saveTimer = null;
  await db.set('state', state);
}

function touch(silent) {
  version++;
  invalidate();
  state.meta.updatedAt = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 250);
  if (!silent) subs.forEach((fn) => fn());
}

export const store = {
  get s() { return state; },
  get v() { return version; },
  get canUndo() { return undoStack.length > 0; },

  async init() {
    let s = await db.get('state');
    let fresh = false;
    if (!validateBackup(s)) {
      s = createSeed();
      fresh = true;
    }
    state = migrate(s);
    if (fresh) await save();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && saveTimer) save();
    });
    window.addEventListener('pagehide', () => { if (saveTimer) save(); });
    return fresh;
  },

  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },

  /** Mutate state. opts.undo=false skips snapshot, opts.silent=true skips re-render. */
  commit(label, fn, opts = {}) {
    if (opts.undo !== false) {
      undoStack.push({ label, snap: JSON.stringify(state) });
      if (undoStack.length > 20) undoStack.shift();
    }
    invalidate();
    const result = fn(state);
    touch(opts.silent);
    return result;
  },

  undo() {
    const u = undoStack.pop();
    if (!u) return null;
    state = JSON.parse(u.snap);
    touch();
    return u.label;
  },

  replace(newState, label = 'שחזור גיבוי') {
    undoStack.push({ label, snap: JSON.stringify(state) });
    state = migrate(newState);
    touch();
  },

  flush: save,
};
