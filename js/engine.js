// Scheduling engine: expands recurring series into daily occurrences,
// detects conflicts, computes progress/alerts, and produces planning proposals.
// Proposal functions are read-only; apply* functions mutate (call inside store.commit).
import {
  today, nowMin, addDays, diffDays, weekday, weekStart, toMin, fromMin, dur, relDay, fmtDM, fmtShort, DAY_NAMES,
} from './date.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
let cache = new Map();
export function invalidate() { cache = new Map(); }

export const FIELDS = ['title', 'cat', 'start', 'end', 'courseId', 'goalId', 'assignmentId', 'notes', 'fixed', 'meta', 'taskId'];
const pickDef = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
const filterKeys = (o, fn) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => fn(k)));
export const range7 = (ws) => Array.from({ length: 7 }, (_, i) => addDays(ws, i));

// Categories that are part of the protected daily rhythm, not "work items" to move around.
export const RHYTHM = new Set(['routine', 'break', 'commute', 'work', 'family', 'lesson']);
export const GOAL_CATS = new Set(['study', 'assignment', 'exam', 'career', 'project', 'english', 'confidence', 'personal', 'exercise', 'home', 'driving']);

export function cat(s, id) {
  return s.categories.find((c) => c.id === id) || { id, name: 'כללי', color: '#C8B8AE', icon: 'dot', target: 0 };
}

// ---------- week patterns & day types ----------
export function weekPlanFor(s, ws) {
  const wp = s.weekPlans[ws] || {};
  const pattern = wp.pattern || s.settings.defaultPattern || 'regular';
  if (pattern === 'custom') return { pattern, work: wp.work || [], zoom: wp.zoom || [], planned: !!wp.planned };
  const p = s.patterns[pattern] || s.patterns.regular;
  return { pattern, work: p.work, zoom: p.zoom, planned: !!wp.planned };
}

export function dayType(s, iso) {
  const wd = weekday(iso);
  if (wd === 6) return 'shabbat';
  if (wd === 5) return 'friday';
  const wp = weekPlanFor(s, weekStart(iso));
  if (wp.zoom.includes(wd)) return 'zoom';
  if (wp.work.includes(wd)) return 'work';
  return 'study';
}

export function matchRec(s, rec, from, until, iso) {
  if (!rec) return false;
  if (from && iso < from) return false;
  if (until && iso > until) return false;
  const wd = weekday(iso);
  switch (rec.kind) {
    case 'daily':
      if (rec.skipShabbat && wd === 6) return false;
      return diffDays(from || iso, iso) % (rec.every || 1) === 0;
    case 'weekly': {
      if (!(rec.days || []).includes(wd)) return false;
      const w = Math.floor(diffDays(weekStart(from || iso), weekStart(iso)) / 7);
      return w % (rec.every || 1) === 0;
    }
    case 'monthly':
      return Number(iso.slice(8)) === Number(rec.day);
    case 'daytype':
      return (rec.types || []).includes(dayType(s, iso));
    default:
      return false;
  }
}

export function recLabel(rec) {
  if (!rec) return 'חד-פעמי';
  const DT = { work: 'ימי עבודה', zoom: 'ימי זום', study: 'ימי לימודים', friday: 'שישי', shabbat: 'שבת' };
  switch (rec.kind) {
    case 'daily': return rec.every > 1 ? `כל ${rec.every} ימים` : 'כל יום';
    case 'weekly': {
      const d = (rec.days || []).map((x) => DAY_NAMES[x]).join(', ');
      return rec.every > 1 ? `כל ${rec.every} שבועות: ${d}` : `שבועי: ${d}`;
    }
    case 'monthly': return `חודשי: ב-${rec.day} לחודש`;
    case 'daytype': return 'תבנית: ' + (rec.types || []).map((t) => DT[t]).join(', ');
    default: return '';
  }
}

// ---------- occurrences ----------
export function occurrences(s, iso) {
  const hit = cache.get(iso);
  if (hit) return hit;
  const out = [];
  for (const sr of s.series) {
    if (!matchRec(s, sr.rec, sr.from, sr.until, iso)) continue;
    const ex = sr.exceptions[iso];
    if (ex && ex.deleted) continue;
    const o = {
      key: `${sr.id}@${iso}`, src: 'series', id: sr.id, date: iso,
      title: sr.title, cat: sr.cat, start: sr.start, end: sr.end, fixed: !!sr.fixed,
      courseId: sr.courseId || null, goalId: sr.goalId || null, assignmentId: sr.assignmentId || null, taskId: null,
      notes: sr.notes || '', meta: sr.meta || null, slot: sr.slot || null, tag: sr.tag || null,
      done: !!sr.done[iso], actual: sr.actual[iso] ?? null, planned: false, manual: false, rec: sr.rec,
    };
    if (ex) {
      for (const f of FIELDS) if (ex[f] !== undefined) o[f] = ex[f];
      o.planned = !!ex.planned;
      o.manual = !!ex.manual;
    }
    out.push(o);
  }
  for (const b of s.blocks) {
    if (b.date !== iso) continue;
    out.push({
      key: b.id, src: 'block', id: b.id, date: iso, title: b.title, cat: b.cat, start: b.start, end: b.end,
      fixed: !!b.fixed, courseId: b.courseId || null, goalId: b.goalId || null, assignmentId: b.assignmentId || null,
      taskId: b.taskId || null, notes: b.notes || '', meta: b.meta || null, slot: null, tag: null,
      done: !!b.done, actual: b.actual ?? null, planned: false, manual: true, rec: null,
    });
  }
  for (const o of out) {
    o.s = toMin(o.start);
    o.e = toMin(o.end);
    if (o.e <= o.s) o.e = Math.min(o.s + 15, 24 * 60);
    o.conflicts = [];
  }
  out.sort((a, b) => a.s - b.s || a.e - b.e);
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length && out[j].s < out[i].e; j++) {
      out[i].conflicts.push(out[j].key);
      out[j].conflicts.push(out[i].key);
    }
  }
  cache.set(iso, out);
  return out;
}

export function findOcc(s, key) {
  if (!key) return null;
  if (key.includes('@')) {
    const date = key.slice(key.lastIndexOf('@') + 1);
    return occurrences(s, date).find((o) => o.key === key) || null;
  }
  const b = s.blocks.find((x) => x.id === key);
  return b ? occurrences(s, b.date).find((o) => o.key === key) || null : null;
}

export function conflictPairs(occs) {
  const pairs = [];
  for (let i = 0; i < occs.length; i++)
    for (let j = i + 1; j < occs.length && occs[j].s < occs[i].e; j++) pairs.push([occs[i], occs[j]]);
  return pairs;
}

export function nextAdjacent(s, o) {
  return occurrences(s, o.date).find((x) => x.key !== o.key && x.s >= o.e && x.s <= o.e + 30) || null;
}

// ---------- mutations on occurrences ----------
const seriesOf = (s, o) => s.series.find((x) => x.id === o.id);
const blockOf = (s, o) => s.blocks.find((x) => x.id === o.id);

export function blockFromOcc(o, changes = {}) {
  return {
    id: uid(), title: o.title, cat: o.cat, date: o.date, start: o.start, end: o.end, fixed: !!o.fixed,
    done: !!o.done, actual: o.actual ?? null, notes: o.notes || '', courseId: o.courseId || null, goalId: o.goalId || null,
    assignmentId: o.assignmentId || null, taskId: o.taskId || null, meta: o.meta || null, ...changes,
  };
}

export function newSeries(data) {
  return {
    id: uid(), title: data.title, cat: data.cat, start: data.start, end: data.end, rec: data.rec,
    from: data.from, until: data.until || null, fixed: !!data.fixed, notes: data.notes || '',
    courseId: data.courseId || null, goalId: data.goalId || null, assignmentId: data.assignmentId || null,
    slot: data.slot || null, tag: null, meta: data.meta || null, exceptions: {}, done: {}, actual: {},
  };
}

export function setDone(s, o, done, actual) {
  const wasDone = o.done;
  if (o.src === 'series') {
    const sr = seriesOf(s, o);
    if (!sr) return;
    if (done) sr.done[o.date] = true; else delete sr.done[o.date];
    if (actual !== undefined) { if (actual == null) delete sr.actual[o.date]; else sr.actual[o.date] = actual; }
  } else {
    const b = blockOf(s, o);
    if (!b) return;
    b.done = done;
    if (actual !== undefined) b.actual = actual;
  }
  if (o.assignmentId && wasDone !== done) {
    const a = s.assignments.find((x) => x.id === o.assignmentId);
    if (a) {
      const m = actual ?? o.actual ?? o.e - o.s;
      a.loggedMin = Math.max(0, (a.loggedMin || 0) + (done ? m : -m));
      if (done && a.status === 'not-started') a.status = 'in-progress';
    }
  }
  if (o.taskId && done) {
    const t = s.tasks.find((x) => x.id === o.taskId);
    if (t && !t.rec) t.status = 'done';
  }
  if (o.cat === 'driving' && o.meta && done !== wasDone) {
    const g = s.goals.find((x) => x.tracker === 'driving');
    if (g) g.lessonsDone = Math.max(0, (g.lessonsDone || 0) + (done ? (o.meta.double === false ? 1 : 2) : (o.meta.double === false ? -1 : -2)));
  }
  invalidate();
}

export function setActual(s, o, minutes) {
  if (o.src === 'series') {
    const sr = seriesOf(s, o);
    if (minutes == null) delete sr.actual[o.date]; else sr.actual[o.date] = minutes;
  } else blockOf(s, o).actual = minutes;
  invalidate();
}

/** scope: 'this' | 'future' | 'all' */
export function updateOcc(s, o, ch, scope = 'this') {
  if (o.src === 'block') {
    const b = blockOf(s, o);
    if (!b) return;
    if (ch.rec) {
      const sr = newSeries({ ...b, ...ch, from: ch.date || b.date });
      s.series.push(sr);
      s.blocks = s.blocks.filter((x) => x !== b);
    } else Object.assign(b, pickDef(ch, [...FIELDS, 'date']));
    invalidate();
    return;
  }
  const sr = seriesOf(s, o);
  if (!sr) return;
  if (scope === 'this') {
    if (ch.date && ch.date !== o.date) {
      sr.exceptions[o.date] = { deleted: true };
      delete sr.done[o.date];
      delete sr.actual[o.date];
      s.blocks.push(blockFromOcc(o, pickDef(ch, [...FIELDS, 'date'])));
    } else {
      const ex = { ...(sr.exceptions[o.date] || {}) };
      delete ex.planned;
      Object.assign(ex, pickDef(ch, FIELDS), { manual: true });
      sr.exceptions[o.date] = ex;
    }
  } else if (scope === 'all' || o.date <= sr.from) {
    Object.assign(sr, pickDef(ch, [...FIELDS, 'rec', 'until']));
  } else {
    const nsr = JSON.parse(JSON.stringify(sr));
    nsr.id = uid();
    nsr.from = o.date;
    nsr.exceptions = filterKeys(sr.exceptions, (k) => k >= o.date);
    nsr.done = filterKeys(sr.done, (k) => k >= o.date);
    nsr.actual = filterKeys(sr.actual, (k) => k >= o.date);
    sr.exceptions = filterKeys(sr.exceptions, (k) => k < o.date);
    sr.done = filterKeys(sr.done, (k) => k < o.date);
    sr.actual = filterKeys(sr.actual, (k) => k < o.date);
    sr.until = addDays(o.date, -1);
    Object.assign(nsr, pickDef(ch, [...FIELDS, 'rec', 'until']));
    s.series.push(nsr);
  }
  invalidate();
}

export function deleteOcc(s, o, scope = 'this') {
  if (o.src === 'block') s.blocks = s.blocks.filter((x) => x.id !== o.id);
  else {
    const sr = seriesOf(s, o);
    if (!sr) return;
    if (scope === 'all' || (scope === 'future' && o.date <= sr.from)) s.series = s.series.filter((x) => x !== sr);
    else if (scope === 'future') sr.until = addDays(o.date, -1);
    else {
      sr.exceptions[o.date] = { deleted: true };
      delete sr.done[o.date];
      delete sr.actual[o.date];
    }
  }
  invalidate();
}

export function moveOcc(s, o, date, sMin, eMin) {
  updateOcc(s, o, { date, start: fromMin(sMin), end: fromMin(eMin) }, 'this');
}

export function duplicateOcc(s, o, date = o.date, startMin = o.e) {
  const len = o.e - o.s;
  const st = Math.min(startMin, 24 * 60 - len - 1);
  s.blocks.push(blockFromOcc(o, { date, start: fromMin(st), end: fromMin(st + len), done: false, actual: null }));
  invalidate();
}

export function splitOcc(s, o, at) {
  if (at <= o.s + 4 || at >= o.e - 4) return false;
  const end = o.end;
  s.blocks.push(blockFromOcc(o, { start: fromMin(at), end, done: false, actual: null }));
  updateOcc(s, o, { end: fromMin(at) }, 'this');
  return true;
}

export function mergeWithNext(s, o) {
  const nx = nextAdjacent(s, o);
  if (!nx) return false;
  const end = nx.end;
  deleteOcc(s, nx, 'this');
  updateOcc(s, o, { end }, 'this');
  return true;
}

// ---------- tasks ----------
export function taskWhen(t) { return t.date || t.deadline || null; }

export function tasksFor(s, iso) {
  const t0 = today();
  const out = [];
  for (const t of s.tasks) {
    if (t.rec) {
      if (matchRec(s, t.rec, t.rec.from || t.createdAt, t.rec.until, iso)) out.push({ t, done: !!(t.doneDates || {})[iso], rec: true });
      continue;
    }
    const when = taskWhen(t);
    if (when === iso) out.push({ t, done: t.status === 'done' });
    else if (iso === t0 && when && when < t0 && t.status !== 'done') out.push({ t, done: false, overdue: true });
  }
  out.sort((a, b) => a.done - b.done || (b.overdue ? 1 : 0) - (a.overdue ? 1 : 0) || (a.t.priority || 2) - (b.t.priority || 2));
  return out;
}

export function toggleTask(s, t, iso) {
  if (t.rec) {
    t.doneDates ||= {};
    if (t.doneDates[iso]) delete t.doneDates[iso]; else t.doneDates[iso] = true;
  } else {
    t.status = t.status === 'done' ? 'todo' : 'done';
    t.doneAt = t.status === 'done' ? today() : null;
  }
}

// ---------- deadlines ----------
export const effDue = (a) => a.extendedTo || a.due;
export const isOpen = (a) => !['submitted', 'skipped'].includes(a.status);
export function internalTarget(a) {
  if (a.target) return a.target;
  let d = addDays(effDue(a), -2);
  while (weekday(d) === 5 || weekday(d) === 6) d = addDays(d, -1);
  return d;
}
export const remainingMin = (a) => Math.max(0, (a.estimateH || 0) * 60 - (a.loggedMin || 0));
export const courseShort = (s, id) => s.courses.find((c) => c.id === id)?.short || '';
export const STATUS = {
  'not-started': 'טרם התחלתי', 'in-progress': 'בתהליך', partial: 'הושלם חלקית',
  submitted: 'הוגש', extended: 'קיבלתי הארכה', skipped: 'דילגתי',
};

export function urgency(daysLeft) {
  if (daysLeft <= 2) return 'danger';
  if (daysLeft <= 7) return 'warn';
  return 'ok';
}

export function plannedForAssignment(s, a, from = today()) {
  let m = 0;
  const due = effDue(a);
  for (let d = from; d <= due; d = addDays(d, 1))
    for (const o of occurrences(s, d)) if (o.assignmentId === a.id && !o.done) m += o.e - o.s;
  return m;
}

export function deadlinesOn(s, iso) {
  const out = [];
  for (const a of s.assignments) {
    if (effDue(a) === iso) out.push({ kind: 'assignment', title: `${courseShort(s, a.courseId)} · ${a.title}`, a, open: isOpen(a) });
    else if (isOpen(a) && internalTarget(a) === iso) out.push({ kind: 'target', title: `יעד פנימי: ${courseShort(s, a.courseId)} ${a.title}`, a, open: true });
  }
  for (const e of s.exams) if (e.date === iso) out.push({ kind: 'exam', title: e.title, e, open: true });
  for (const g of s.goals) {
    for (const m of g.milestones || []) if (m.date === iso && !m.done) out.push({ kind: 'milestone', title: m.title, g, m, open: true });
    if (g.deadline === iso && !g.longTerm) out.push({ kind: 'goal', title: `יעד: ${g.title}`, g, open: true });
  }
  return out;
}

export function upcoming(s, days = 30, from = today()) {
  const end = addDays(from, days);
  const out = [];
  for (const a of s.assignments) {
    const due = effDue(a);
    if (!isOpen(a) || due < from || due > end) continue;
    out.push({ date: due, kind: 'assignment', title: `${courseShort(s, a.courseId)} · ${a.title}`, sub: `יעד פנימי: ${fmtDM(internalTarget(a))}`, a, color: cat(s, 'assignment').color, href: '#/uni' });
  }
  for (const e of s.exams) if (e.date >= from && e.date <= end) out.push({ date: e.date, kind: 'exam', title: e.title, sub: e.time ? `בשעה ${e.time}` : '', e, color: cat(s, 'exam').color, href: '#/uni' });
  for (const g of s.goals) {
    for (const m of g.milestones || []) if (!m.done && m.date && m.date >= from && m.date <= end) out.push({ date: m.date, kind: 'milestone', title: m.title, sub: g.title, color: g.color, href: `#/goal/${g.id}` });
  }
  for (const t of s.tasks) if (!t.rec && t.status !== 'done' && t.deadline && t.priority === 1 && t.deadline >= from && t.deadline <= end)
    out.push({ date: t.deadline, kind: 'task', title: t.title, sub: 'משימה בעדיפות גבוהה', color: cat(s, t.cat).color, href: '#/tasks' });
  for (const b of s.blocks) if (b.cat === 'driving' && b.date >= from && b.date <= end && !b.done)
    out.push({ date: b.date, kind: 'driving', title: b.title, sub: `בשעה ${b.start}`, color: cat(s, 'driving').color, href: `#/day/${b.date}` });
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out.map((x) => ({ ...x, daysLeft: diffDays(from, x.date) }));
}

// ---------- progress & stats ----------
export function dayProgress(s, iso) {
  const occs = occurrences(s, iso).filter((o) => o.cat !== 'commute');
  const tasks = tasksFor(s, iso).filter((x) => !x.overdue);
  const done = occs.filter((o) => o.done).length + tasks.filter((x) => x.done).length;
  const total = occs.length + tasks.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function weekStats(s, ws) {
  const by = {};
  let planned = 0, actual = 0;
  for (const d of range7(ws)) {
    for (const o of occurrences(s, d)) {
      const len = o.e - o.s;
      const c = (by[o.cat] ||= { planned: 0, actual: 0 });
      c.planned += len;
      planned += len;
      if (o.done) { const a = o.actual ?? len; c.actual += a; actual += a; }
    }
  }
  return { by, planned, actual };
}

export function goalProgress(g) {
  if (g.progressMode === 'manual') return g.progress || 0;
  const items = [...(g.steps || []), ...(g.milestones || [])];
  if (!items.length) return g.progress || 0;
  return Math.round((items.filter((x) => x.done).length / items.length) * 100);
}

export function goalWeek(s, g, ws) {
  let planned = 0, done = 0;
  const sessions = [];
  for (const d of range7(ws)) for (const o of occurrences(s, d)) {
    if (o.goalId === g.id || (g.cats || []).includes(o.cat)) {
      planned += o.e - o.s;
      if (o.done) done += o.actual ?? o.e - o.s;
      sessions.push(o);
    }
  }
  return { planned, done, sessions };
}

export function sleepMinutes(st) {
  const b = toMin(st.bed), w = toMin(st.wake);
  return b > w ? 24 * 60 - b + w : w - b;
}

export function freeMinutes(s, iso) {
  const wake = toMin(s.settings.wake), bed = toMin(s.settings.bed);
  let cur = wake, free = 0;
  for (const o of occurrences(s, iso)) {
    if (o.s > cur) free += Math.min(o.s, bed) - cur;
    cur = Math.max(cur, o.e);
    if (cur >= bed) break;
  }
  if (bed > cur) free += bed - cur;
  return Math.max(0, free);
}

function dayLabel(d) {
  const n = diffDays(today(), d);
  if (n >= -1 && n <= 2) return relDay(d);
  return `ביום ${DAY_NAMES[weekday(d)]} ${fmtShort(d)}`;
}

export function alerts(s, from = today(), days = 7) {
  const out = [];
  const st = s.settings;
  const bedM = toMin(st.bed), wakeM = toMin(st.wake);
  const sleep = sleepMinutes(st);
  if (sleep < st.sleepTarget * 60 - 10)
    out.push({ level: 'warn', icon: 'moon', text: `חלון השינה בהגדרות (${dur(sleep)}) קצר מהיעד של ${st.sleepTarget} שעות.`, href: '#/settings' });

  for (let i = 0; i < days; i++) {
    const d = addDays(from, i);
    const occs = occurrences(s, d);
    for (const [a, b] of conflictPairs(occs).slice(0, 3))
      out.push({ level: 'warn', icon: 'alert', text: `חפיפה ${dayLabel(d)}: "${a.title}" (${a.start}–${a.end}) ו"${b.title}" (${b.start}–${b.end}).`, href: `#/day/${d}` });
    if (bedM > wakeM) {
      const late = occs.find((o) => o.e > bedM + 5 && !['family'].includes(o.cat));
      if (late) out.push({ level: 'warn', icon: 'moon', text: `${dayLabel(d)} "${late.title}" נגמר אחרי שעת השינה (${st.bed}).`, href: `#/day/${d}` });
      const early = occs.find((o) => o.s < wakeM - 5);
      if (early) out.push({ level: 'info', icon: 'moon', text: `${dayLabel(d)} "${early.title}" מתחיל לפני שעת הקימה (${st.wake}).`, href: `#/day/${d}` });
    }
    for (const o of occs) if (GOAL_CATS.has(o.cat) && o.e - o.s > 240)
      out.push({ level: 'info', icon: 'clock', text: `${dayLabel(d)} "${o.title}" נמשך ${dur(o.e - o.s)} – כדאי לשלב הפסקה קצרה באמצע.`, href: `#/day/${d}` });
    const tmin = tasksFor(s, d).filter((x) => !x.done && !x.overdue).reduce((m, x) => m + (x.t.estimate || 0), 0);
    const free = freeMinutes(s, d);
    if (tmin > 60 && tmin > free + 30)
      out.push({ level: 'info', icon: 'clock', text: `${dayLabel(d)}: משימות בהיקף ${dur(tmin)} אבל רק ${dur(free)} פנויות ביומן.`, href: `#/day/${d}` });
  }

  const t = today();
  for (const a of s.assignments) {
    if (!isOpen(a)) continue;
    const due = effDue(a);
    const dl = diffDays(t, due);
    const name = `${courseShort(s, a.courseId)} ${a.title}`;
    if (dl < 0) {
      out.push({ level: 'danger', icon: 'flag', text: `${name}: מועד ההגשה (${fmtDM(due)}) עבר – עדכני סטטוס או הארכה.`, href: '#/uni' });
      continue;
    }
    if (dl > 14) continue;
    const need = remainingMin(a);
    const planned = plannedForAssignment(s, a);
    if (dl <= 3 && a.status === 'not-started')
      out.push({ level: 'danger', icon: 'flag', text: `${name} להגשה ${relDay(due)} ועדיין לא התחלת.`, href: '#/uni', action: 'plan' });
    else if (need > 0 && planned + 30 < need)
      out.push({ level: dl <= 7 ? 'warn' : 'info', icon: 'flag', text: `${name} (${relDay(due)}) בסיכון: מתוכננות ${dur(planned)} מתוך ~${dur(need)} נדרשות.`, href: '#/uni', action: 'plan' });
  }

  const dues = [
    ...s.assignments.filter(isOpen).map((a) => ({ date: effDue(a), title: `${courseShort(s, a.courseId)} ${a.title}` })),
    ...s.exams.map((e) => ({ date: e.date, title: e.title })),
  ].filter((x) => x.date >= t && diffDays(t, x.date) <= 35).sort((a, b) => (a.date < b.date ? -1 : 1));
  for (let i = 0; i + 1 < dues.length; i++) {
    const a = dues[i], b = dues[i + 1];
    if (diffDays(a.date, b.date) <= 1 && a.date !== b.date)
      out.push({ level: 'info', icon: 'calendar', text: `צפיפות מועדים: ${a.title} (${fmtDM(a.date)}) ו${b.title} (${fmtDM(b.date)}) – כדאי לסיים מוקדם.`, href: '#/uni' });
  }

  const seen = new Set();
  const rank = { danger: 0, warn: 1, info: 2 };
  return out.filter((x) => !seen.has(x.text) && seen.add(x.text)).sort((a, b) => rank[a.level] - rank[b.level]);
}

// ---------- free-slot search & rescheduling ----------
export function findGap(s, iso, len, fromMinute = 0, extra = []) {
  const wake = toMin(s.settings.wake), bed = toMin(s.settings.bed);
  const busy = [
    ...occurrences(s, iso).map((o) => [o.s, o.e]),
    ...extra.filter((x) => x.date === iso).map((x) => [x.s, x.e]),
  ].sort((a, b) => a[0] - b[0]);
  let cur = Math.max(wake, Math.ceil(fromMinute / 5) * 5);
  for (const [a, b] of busy) {
    if (a - cur >= len) return cur;
    cur = Math.max(cur, b);
  }
  return bed - cur >= len ? cur : null;
}

function placeLater(s, o, startDate, startMin, extra, maxDays = 10) {
  const len = o.e - o.s;
  const limit = o.assignmentId ? effDue(s.assignments.find((a) => a.id === o.assignmentId) || { due: '9999-12-31' }) : null;
  for (let i = 0; i < maxDays; i++) {
    const d = addDays(startDate, i);
    if (limit && d > limit) break;
    if (weekday(d) === 6) continue;
    const at = findGap(s, d, len, i === 0 ? startMin : 0, extra);
    if (at != null) return { date: d, s: at, e: at + len };
  }
  return null;
}

export function proposeReschedule(s, iso, includeUpcoming = false) {
  const t = today(), nm = nowMin();
  const items = occurrences(s, iso).filter((o) =>
    !o.done && !o.fixed && !RHYTHM.has(o.cat) && (iso < t || iso > t || o.e <= nm || (includeUpcoming && o.s >= nm)));
  const extra = [];
  const moves = [], unplaced = [];
  const startDate = iso < t ? t : iso === t ? t : addDays(iso, 1);
  const startMin = startDate === t ? nm + 10 : 0;
  const order = (o) => (o.cat === 'assignment' ? 0 : o.cat === 'study' ? 1 : o.cat === 'exam' ? 1 : 2);
  for (const o of [...items].sort((a, b) => order(a) - order(b))) {
    const p = placeLater(s, o, startDate === iso && iso > t ? addDays(iso, 1) : startDate, startMin, extra);
    if (p) { moves.push({ o, ...p }); extra.push(p); } else unplaced.push(o);
  }
  return { moves, unplaced };
}

export function applyMoves(s, moves) {
  for (const m of moves) moveOcc(s, m.o, m.date, m.s, m.e);
}

export function occToTask(s, o) {
  s.tasks.push({
    id: uid(), title: o.title, cat: o.cat, priority: o.cat === 'assignment' ? 1 : 2, estimate: o.e - o.s,
    deadline: o.assignmentId ? effDue(s.assignments.find((a) => a.id === o.assignmentId) || {}) || null : null,
    date: null, status: 'todo', subtasks: [], rec: null, doneDates: {}, notes: `הועבר מהיומן (${fmtDM(o.date)} ${o.start})`,
    goalId: o.goalId, courseId: o.courseId, createdAt: today(),
  });
  deleteOcc(s, o, 'this');
}

export function proposeWorkLate(s, iso, minutes) {
  const occs = occurrences(s, iso);
  const work = occs.find((o) => o.cat === 'work');
  if (!work) return null;
  const bed = toMin(s.settings.bed);
  const shifts = [{ o: work, s: work.s, e: work.e + minutes }];
  const removes = [], toPlace = [];
  for (const o of occs) {
    if (o.key === work.key || o.s < work.e || o.done) continue;
    if (o.fixed) continue;
    const ns = o.s + minutes, ne = o.e + minutes;
    if (ne <= bed) shifts.push({ o, s: ns, e: ne });
    else if (ns <= bed - 10) shifts.push({ o, s: ns, e: bed });
    else if (RHYTHM.has(o.cat)) removes.push(o);
    else toPlace.push(o);
  }
  const extra = [];
  const moves = [];
  for (const o of toPlace) {
    const p = placeLater(s, o, addDays(iso, 1), 0, extra);
    if (p) { moves.push({ o, ...p }); extra.push(p); } else removes.push(o);
  }
  return { work, minutes, shifts, removes, moves };
}

export function applyWorkLate(s, p) {
  for (const sh of p.shifts) updateOcc(s, sh.o, { start: fromMin(sh.s), end: fromMin(sh.e) }, 'this');
  for (const o of p.removes) deleteOcc(s, o, 'this');
  applyMoves(s, p.moves);
}

// ---------- weekly planner ----------
const TOPICS = {
  infi1: ['הרצאה מוקלטת + סיכום', 'הוכחות – הבנה ושחזור לבד', 'תרגול עצמאי'],
  infi2: ['הרצאה מוקלטת (מרצה לבחירתי)', 'הוכחות ותרגול', 'פתרון שאלות'],
  db: ['הרצאה + סיכום', 'תרגול SQL ואלגברה רלציונית', 'תרגול נרמול ושאלות'],
  default: ['הרצאה + סיכום', 'תרגול עצמאי', 'חזרה'],
};
const EXAM_TOPICS = ['חזרה ממוקדת', 'מבחן קודם בתנאי אמת', 'תיקון טעויות ממבחן קודם'];
const AMIRAM_TOPICS = ['אמירם: הבנת הנקרא + אוצר מילים', 'אמירם: תרגול שאלות בזמן', 'אמירם: סימולציה חלקית'];
export const CAREER_TOPICS = [
  'קריירה: LeetCode – תבנית + 2 בעיות Medium לבד',
  'קריירה: פרויקט End-to-End (Backend, API, DB)',
  'קריירה: ניתוח משרות + הגשת מועמדויות',
  'קריירה: יסודות – OS / Linux / C / רשתות',
  'קריירה: LeetCode + ניתוח סיבוכיות בקול באנגלית',
  'קריירה: בדיקות, Git, Code Review ו-CI/CD',
  'קריירה: הכנה לראיון התנהגותי וטכני',
];

export function planWeek(s, ws) {
  const t = today(), nm = nowMin(), P = s.settings.planner || {};
  const we = addDays(ws, 6);
  const slots = [];
  for (const d of range7(ws)) {
    if (d < t) continue;
    for (const o of occurrences(s, d)) {
      if ((o.slot !== 'focus' && o.slot !== 'career') || o.done || o.manual) continue;
      if (d === t && o.s < nm) continue;
      slots.push({ o, date: d, len: o.e - o.s, as: null });
    }
  }
  const slotKeys = new Set(slots.map((x) => x.o.key));
  const used = {}; // courseId -> minutes assigned
  const notes = [];
  const free = (pred) => slots.filter((x) => !x.as && pred(x));
  const cap = (arr) => arr.reduce((m, x) => m + x.len, 0);

  const open = s.assignments
    .filter((a) => isOpen(a) && effDue(a) >= t && internalTarget(a) <= addDays(we, 4))
    .sort((a, b) => (effDue(a) < effDue(b) ? -1 : 1));

  for (const a of open) {
    const due = effDue(a), target = internalTarget(a);
    const short = courseShort(s, a.courseId);
    let existing = 0;
    for (let d = t; d <= due; d = addDays(d, 1))
      for (const o of occurrences(s, d)) if (o.assignmentId === a.id && !o.done && !slotKeys.has(o.key)) existing += o.e - o.s;
    let solve = Math.max(0, remainingMin(a) - existing);
    let learn = a.status === 'not-started' && a.kind !== 'participation' ? (P.learnFirstH ?? 3) * 60 : 0;
    const solveThisWeek = target <= we || due <= we;
    if (!solveThisWeek) solve = 0;
    if (!solve && !learn) continue;
    const urgent = diffDays(t, due) <= 4;
    const ok = (x) => x.o.slot === 'focus' || urgent;
    let cands = free((x) => ok(x) && x.date <= target);
    if (cap(cands) < solve + learn) cands = free((x) => ok(x) && x.date <= due);

    // Solve in long, uninterrupted sittings: fill the days with most focus capacity first.
    const solveSlots = [];
    if (solve > 0) {
      const byDay = {};
      for (const x of cands) (byDay[x.date] ||= []).push(x);
      const dayOrder = Object.keys(byDay).sort((d1, d2) => cap(byDay[d2]) - cap(byDay[d1]) || (d1 < d2 ? 1 : -1));
      for (const d of dayOrder) {
        for (const x of byDay[d].sort((p, q) => p.o.s - q.o.s)) {
          if (solve <= 0) break;
          if (x.len < (P.minAssignmentBlock || 90) && cap(byDay[d]) < 120 && dayOrder.length > 1 && solve > x.len) continue;
          x.as = { title: `${short} · ${a.title} – פתרון ברצף`, cat: 'assignment', courseId: a.courseId, assignmentId: a.id };
          solve -= x.len;
          solveSlots.push(x);
          used[a.courseId] = (used[a.courseId] || 0) + x.len;
        }
        if (solve <= 0) break;
      }
    }
    // Learn the material first – in slots before the first solving sitting.
    if (learn > 0) {
      const firstSolve = solveSlots.length ? solveSlots.reduce((m, x) => (x.date + x.o.start < m ? x.date + x.o.start : m), '9999') : '9999';
      const before = free((x) => x.o.slot === 'focus' && x.date + x.o.start < firstSolve && x.date <= due).sort((p, q) => (p.date + p.o.start < q.date + q.o.start ? -1 : 1));
      for (const x of before) {
        if (learn <= 0) break;
        x.as = { title: `${short} · השלמת חומר לקראת ${a.title}`, cat: 'study', courseId: a.courseId, assignmentId: null };
        learn -= x.len;
        used[a.courseId] = (used[a.courseId] || 0) + x.len;
      }
    }
    if (solve > 0) notes.push(`${short} ${a.title}: חסרות כ-${dur(solve)} זמן פתרון עד ${fmtDM(due)}. מומלץ להוסיף סשן ידני או לבקש הארכה.`);
    if (learn > 0 && solveThisWeek) notes.push(`${short} ${a.title}: לא נמצא מספיק זמן להשלמת חומר לפני הפתרון (חסרות ~${dur(learn)}).`);
  }

  // General study demand for remaining focus slots
  const demands = s.courses.filter((c) => c.active !== false).map((c) => {
    const examSoon = c.examDate && c.examDate >= t && diffDays(t, c.examDate) <= 28;
    return {
      kind: 'course', c, need: (c.weeklyH || 0) * 60 * (examSoon ? 1.5 : 1) - (used[c.id] || 0),
      weight: (P[c.plannerKey] ?? 1) * (examSoon ? 1.5 : 1), topics: examSoon ? EXAM_TOPICS : TOPICS[c.plannerKey] || TOPICS.default, n: 0,
    };
  });
  const amiram = s.exams.find((e) => e.id === 'e-amiram') || s.exams.find((e) => /אמירם/.test(e.title));
  if (amiram && amiram.date >= t) {
    const dl = diffDays(t, amiram.date);
    if (dl <= 60) demands.push({ kind: 'amiram', need: dl <= 14 ? 240 : dl <= 28 ? 150 : 60, weight: P.amiram ?? 1, topics: AMIRAM_TOPICS, n: 0 });
  }
  for (const x of slots.filter((y) => !y.as && y.o.slot === 'focus').sort((p, q) => (p.date + p.o.start < q.date + q.o.start ? -1 : 1))) {
    let best = null;
    for (const d of demands) if (d.need > 0 && (!best || d.need * d.weight > best.need * best.weight)) best = d;
    if (!best) { x.as = { title: 'בלוק למידה עמוק – חזרה ותרגול חופשי', cat: 'study', courseId: null, assignmentId: null }; continue; }
    const topic = best.topics[best.n++ % best.topics.length];
    x.as = best.kind === 'amiram'
      ? { title: topic, cat: 'exam', courseId: null, assignmentId: null }
      : { title: `${best.c.short} · ${topic}`, cat: 'study', courseId: best.c.id, assignmentId: null };
    best.need -= x.len;
  }
  const wi = Math.floor(diffDays('2026-01-04', ws) / 7);
  let ci = 0;
  for (const x of slots.filter((y) => !y.as && y.o.slot === 'career'))
    x.as = { title: CAREER_TOPICS[(wi * 2 + ci++) % CAREER_TOPICS.length], cat: 'career', courseId: null, assignmentId: null };

  const proposals = slots
    .filter((x) => x.as && (x.as.title !== x.o.title || x.as.assignmentId !== x.o.assignmentId))
    .map((x) => ({ key: x.o.key, seriesId: x.o.id, date: x.date, start: x.o.start, end: x.o.end, before: x.o.title, ...x.as }));
  return { proposals, notes, slots: slots.length };
}

export function applyPlan(s, ws, proposals) {
  for (const p of proposals) {
    const sr = s.series.find((x) => x.id === p.seriesId);
    if (!sr) continue;
    const prev = sr.exceptions[p.date];
    if (prev && (prev.deleted || prev.manual)) continue;
    sr.exceptions[p.date] = { title: p.title, cat: p.cat, courseId: p.courseId, assignmentId: p.assignmentId, planned: true };
  }
  s.weekPlans[ws] = { ...(s.weekPlans[ws] || {}), planned: true };
  invalidate();
}

// Keep template blocks in sync with work/wake settings.
export function syncTemplatesFromSettings(s) {
  const st = s.settings;
  const ws = toMin(st.workStart), we = toMin(st.workEnd), c = Number(st.commuteMin) || 0;
  for (const sr of s.series) {
    if (sr.tag === 'work') { sr.start = st.workStart; sr.end = st.workEnd; }
    if (sr.tag === 'commuteAm') { sr.start = fromMin(ws - c); sr.end = st.workStart; }
    if (sr.tag === 'commutePm') { sr.start = st.workEnd; sr.end = fromMin(we + c); }
    if (sr.tag === 'wake') { const len = toMin(sr.end) - toMin(sr.start); sr.start = st.wake; sr.end = fromMin(toMin(st.wake) + len); }
    if (sr.tag === 'exercise') sr.end = fromMin(toMin(sr.start) + (Number(st.exerciseMin) || 30));
    if (sr.tag === 'winddown') { const len = toMin(sr.end) - toMin(sr.start); sr.end = st.bed; sr.start = fromMin(toMin(st.bed) - len); }
  }
  invalidate();
}
