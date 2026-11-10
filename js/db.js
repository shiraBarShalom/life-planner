// Minimal IndexedDB key-value wrapper with a localStorage fallback.
const DB_NAME = 'life-planner';
const STORE = 'kv';
let dbp = null;

function open() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB blocked'));
    });
  }
  return dbp;
}

function tx(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req && req.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

export async function get(key) {
  try {
    return await tx('readonly', (st) => st.get(key));
  } catch (e) {
    console.warn('IndexedDB read failed, using localStorage', e);
    const v = localStorage.getItem('lp:' + key);
    return v ? JSON.parse(v) : undefined;
  }
}

export async function set(key, value) {
  try {
    await tx('readwrite', (st) => st.put(value, key));
  } catch (e) {
    console.warn('IndexedDB write failed, using localStorage', e);
    localStorage.setItem('lp:' + key, JSON.stringify(value));
  }
}
