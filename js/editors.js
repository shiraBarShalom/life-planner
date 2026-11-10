// Editing sheets and interactive dialogs.
import { store, uid } from './store.js';
import {
  h, ic, btn, openSheet, confirmDialog, choose, toast, field, input, textarea, select, seg, dayPicker, check, hexA, icon,
} from './ui.js';
import {
  cat, findOcc, setDone, setActual, updateOcc, deleteOcc, duplicateOcc, splitOcc, mergeWithNext, nextAdjacent, newSeries,
  recLabel, planWeek, applyPlan, proposeReschedule, applyMoves, occToTask, proposeWorkLate, applyWorkLate, findGap,
  STATUS, effDue, internalTarget, courseShort, weekStats, range7, goalWeek,
} from './engine.js';
import {
  today, addDays, toMin, fromMin, dur, fmtLong, fmtDM, fmtDayShort, weekLabel, nowMin, DAY_NAMES, hours,
} from './date.js';
import { renderDayImages } from './export.js';
import { DAY_TYPES } from './seed.js';

export const go = (hash) => { if (location.hash !== hash) location.hash = hash; };

export function act(label, fn, { undoToast = false } = {}) {
  const r = store.commit(label, fn);
  if (undoToast) toast(label, { action: { label: 'ביטול', fn: () => store.undo() } });
  return r;
}

const catOptions = (s) => s.categories.map((c) => ({ value: c.id, label: c.name }));
const courseOptions = (s) => [{ value: '', label: '— ללא —' }, ...s.courses.map((c) => ({ value: c.id, label: c.short || c.name }))];
const goalOptions = (s) => [{ value: '', label: '— ללא —' }, ...s.goals.map((g) => ({ value: g.id, label: g.title }))];
const assignmentOptions = (s, courseId) => [{ value: '', label: '— ללא —' }, ...s.assignments.filter((a) => !courseId || a.courseId === courseId).map((a) => ({ value: a.id, label: `${courseShort(s, a.courseId)} · ${a.title}` }))];

// ---------- recurrence editor ----------
function recEditor(rec, until) {
  const kind = select([
    { value: '', label: 'ללא חזרה (חד-פעמי)' }, { value: 'daily', label: 'כל יום' }, { value: 'weekly', label: 'שבועי / מותאם אישית' },
    { value: 'daytype', label: 'לפי סוג יום (תבנית)' }, { value: 'monthly', label: 'חודשי' },
  ], rec?.kind || '');
  const every = input('number', rec?.every || 1, { min: 1, max: 12, inputMode: 'numeric' });
  const days = dayPicker(rec?.days || []);
  const types = Object.entries(DAY_TYPES).map(([k, v]) => {
    const c = check(v, (rec?.types || []).includes(k));
    c.dataset.type = k;
    return c;
  });
  const typesWrap = h('div.checks', types);
  const untilIn = input('date', until || '');
  const skipSh = check('לדלג על שבת', rec?.skipShabbat);
  const wrap = h('div.rec-editor');
  const render = () => {
    const k = kind.value;
    wrap.replaceChildren(
      field('חזרה', kind),
      k === 'weekly' ? field('ימים', days) : null,
      k === 'weekly' || k === 'daily' ? field(k === 'weekly' ? 'כל כמה שבועות' : 'כל כמה ימים', every) : null,
      k === 'daily' ? skipSh : null,
      k === 'daytype' ? field('סוגי ימים', typesWrap, 'סוג היום נקבע לפי דפוס העבודה של כל שבוע') : null,
      k ? field('עד תאריך (לא חובה)', untilIn) : null,
    );
  };
  kind.onchange = render;
  render();
  wrap.read = (date) => {
    const k = kind.value;
    if (!k) return { rec: null, until: null };
    const r = { kind: k };
    if (k === 'weekly') { r.days = days.value.length ? days.value : [new Date(date).getUTCDay()]; r.every = Math.max(1, +every.value || 1); }
    if (k === 'daily') { r.every = Math.max(1, +every.value || 1); r.skipShabbat = skipSh.querySelector('input').checked; }
    if (k === 'daytype') r.types = types.filter((c) => c.querySelector('input').checked).map((c) => c.dataset.type);
    if (k === 'monthly') r.day = Number(date.slice(8));
    return { rec: r, until: untilIn.value || null };
  };
  return wrap;
}

// ---------- block editor ----------
export function openBlockEditor({ occKey = null, date = today(), start = null, end = null, catId = 'study', preset = {} } = {}) {
  const s = store.s;
  const o = occKey ? findOcc(s, occKey) : null;
  const d = o || {
    title: preset.title || '', cat: preset.cat || catId, date, start: start || '09:00', end: end || fromMin(toMin(start || '09:00') + 60),
    courseId: preset.courseId || null, goalId: preset.goalId || null, assignmentId: preset.assignmentId || null, fixed: false, notes: '', meta: preset.meta || null, taskId: preset.taskId || null,
  };
  const series = o && o.src === 'series' ? s.series.find((x) => x.id === o.id) : null;
  const title = input('text', d.title, { placeholder: 'מה עושים?', autofocus: !o, enterKeyHint: 'done' });
  const catSel = select(catOptions(s), d.cat);
  const dateIn = input('date', d.date);
  const startIn = input('time', d.start, { step: 300 });
  const endIn = input('time', d.end, { step: 300 });
  const durLbl = h('span.chip.soft');
  const updDur = () => { const m = toMin(endIn.value) - toMin(startIn.value); durLbl.textContent = m > 0 ? dur(m) : 'שעת סיום לפני ההתחלה'; durLbl.classList.toggle('bad', m <= 0); };
  startIn.oninput = () => { updDur(); };
  endIn.oninput = updDur;
  updDur();
  const courseSel = select(courseOptions(s), d.courseId || '');
  const asgSel = select(assignmentOptions(s, d.courseId), d.assignmentId || '');
  courseSel.onchange = () => { const v = asgSel.value; asgSel.replaceChildren(...assignmentOptions(s, courseSel.value).map((x) => h('option', { value: x.value }, x.label))); asgSel.value = v; };
  const goalSel = select(goalOptions(s), d.goalId || '');
  const fixedCb = check('התחייבות קבועה (לא להזיז אוטומטית)', d.fixed);
  const notes = textarea(d.notes, { placeholder: 'הערות' });
  const lessonNo = input('text', d.meta?.lessonNo || '', { placeholder: 'למשל 23–24' });
  const cost = input('number', d.meta?.cost ?? '', { placeholder: '₪', inputMode: 'decimal' });
  const dbl = check('שיעור כפול', d.meta?.double !== false);
  const drivingBox = h('div.grid2', field('מס׳ שיעור', lessonNo), field('עלות', cost), dbl);
  const showDriving = () => { drivingBox.hidden = catSel.value !== 'driving'; };
  catSel.addEventListener('change', showDriving);
  showDriving();

  let scope = 'this';
  const rec = recEditor(series ? series.rec : null, series ? series.until : null);
  const recBox = h('div', rec);
  const scopeSeg = series ? seg([
    { value: 'this', label: 'רק המופע הזה' }, { value: 'future', label: 'מהיום והלאה' }, { value: 'all', label: 'כל הסדרה' },
  ], 'this', (v) => { scope = v; recBox.hidden = v === 'this'; dateIn.disabled = v !== 'this'; }) : null;
  if (series) recBox.hidden = true;

  const body = h('div.form',
    field('כותרת', title),
    h('div.grid2', field('קטגוריה', catSel), field('תאריך', dateIn)),
    h('div.grid2', field('התחלה', startIn), field('סיום', endIn)),
    h('div.row', durLbl, o?.conflicts?.length ? h('span.chip.warn', ic('alert', 14), 'חופף לבלוק אחר') : null),
    drivingBox,
    h('details.more', h('summary', 'קישור לקורס, מטלה ומטרה'),
      h('div.grid2', field('קורס', courseSel), field('מטלה', asgSel)), field('מטרה', goalSel)),
    fixedCb,
    field('הערות', notes),
    series ? h('div.scope', h('span.field-label', ic('repeat', 14), ' ' + recLabel(series.rec)), scopeSeg) : null,
    recBox,
  );

  const save = () => {
    const sm = toMin(startIn.value), em = toMin(endIn.value);
    if (!title.value.trim()) { title.focus(); toast('חסרה כותרת'); return; }
    if (!(em > sm)) { toast('שעת הסיום חייבת להיות אחרי ההתחלה'); return; }
    const ch = {
      title: title.value.trim(), cat: catSel.value, start: startIn.value, end: endIn.value,
      courseId: courseSel.value || null, goalId: goalSel.value || null, assignmentId: asgSel.value || null,
      fixed: fixedCb.querySelector('input').checked, notes: notes.value,
    };
    if (catSel.value === 'driving') ch.meta = { lessonNo: lessonNo.value, cost: cost.value === '' ? null : Number(cost.value), double: dbl.querySelector('input').checked };
    const r = rec.read(dateIn.value || d.date);
    act(o ? 'הבלוק עודכן' : 'נוסף בלוק', (st) => {
      if (!o) {
        if (r.rec) st.series.push(newSeries({ ...ch, rec: r.rec, until: r.until, from: dateIn.value || date }));
        else st.blocks.push({ id: uid(), ...ch, date: dateIn.value || date, done: false, actual: null, taskId: d.taskId || null, meta: ch.meta || d.meta || null });
      } else if (o.src === 'block') {
        updateOcc(st, o, { ...ch, date: dateIn.value || o.date, ...(r.rec ? { rec: r.rec, until: r.until } : {}) });
      } else {
        const extra = scope !== 'this' && r.rec ? { rec: r.rec, until: r.until } : {};
        updateOcc(st, o, { ...ch, ...(scope === 'this' ? { date: dateIn.value || o.date } : {}), ...extra }, scope);
      }
    });
    sh.close();
    toast(o ? 'נשמר ✓' : 'נוסף ליומן ✓');
  };
  const footer = [
    o ? btn('מחיקה', () => { sh.close(); deleteFlow(o); }, 'ghost danger-text', 'trash') : null,
    h('span.spacer'),
    btn('ביטול', () => sh.close(), 'ghost'),
    btn('שמירה', save, 'primary', 'check'),
  ];
  const sh = openSheet({ title: o ? 'עריכת בלוק' : 'בלוק חדש', body, footer });
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
}

async function deleteFlow(o) {
  let scope = 'this';
  if (o.src === 'series') {
    scope = await choose('מחיקת בלוק חוזר', [
      { value: 'this', label: 'רק המופע הזה', sub: fmtLong(o.date), icon: 'calendar' },
      { value: 'future', label: 'מהיום והלאה', sub: 'מופעים קודמים יישמרו', icon: 'arrow' },
      { value: 'all', label: 'כל הסדרה', sub: recLabel(o.rec), icon: 'trash' },
    ]);
    if (!scope) return;
  }
  act(`"${o.title}" נמחק`, (st) => deleteOcc(st, o, scope), { undoToast: true });
}

// ---------- quick actions for an occurrence ----------
export function openOccActions(key) {
  const s = store.s;
  const o = findOcc(s, key);
  if (!o) return;
  const C = cat(s, o.cat);
  const len = o.e - o.s;
  const actualIn = input('number', o.actual ?? '', { placeholder: String(len), min: 0, step: 5, inputMode: 'numeric' });
  actualIn.onchange = () => {
    const v = actualIn.value === '' ? null : Math.max(0, Number(actualIn.value));
    store.commit('זמן בפועל', (st) => setActual(st, findOcc(st, key), v), { silent: false });
  };
  const nx = nextAdjacent(s, o);
  const a = o.assignmentId ? s.assignments.find((x) => x.id === o.assignmentId) : null;
  const tile = (label, iconName, fn, cls = '') => h('button.tile' + (cls ? '.' + cls : ''), { type: 'button', onclick: fn }, ic(iconName, 22), h('span', label));
  const body = h('div',
    h('div.occ-head', { style: { '--c': C.color } },
      h('div.occ-head-bar'),
      h('div', h('h3', o.title), h('p.muted', `${fmtDayShort(o.date)} · ${o.start}–${o.end} · ${dur(len)} · ${C.name}`),
        o.rec ? h('p.muted.small', ic('repeat', 13), ' ' + recLabel(o.rec)) : null,
        a ? h('p.small', ic('flag', 13), ` ${courseShort(s, a.courseId)} ${a.title} · הגשה ${fmtDM(effDue(a))}`) : null,
        o.meta?.lessonNo ? h('p.small', `שיעור מס׳ ${o.meta.lessonNo}${o.meta.cost ? ` · ₪${o.meta.cost}` : ''}`) : null,
        o.notes ? h('p.small.notes', o.notes) : null,
        o.conflicts.length ? h('p.small.warn-text', ic('alert', 13), ' חופף ל: ' + o.conflicts.map((k) => findOcc(s, k)?.title).filter(Boolean).join(', ')) : null)),
    h('button.done-toggle' + (o.done ? '.on' : ''), {
      type: 'button',
      onclick: () => { act(o.done ? 'סומן כלא בוצע' : 'כל הכבוד! ✓', (st) => setDone(st, findOcc(st, key), !o.done)); sh.close(); toast(o.done ? 'סומן כלא בוצע' : 'כל הכבוד! ✓'); },
    }, ic('check', 22), h('span', o.done ? 'בוצע · לחצי לביטול' : 'סימון כבוצע')),
    field('זמן בפועל (דקות)', actualIn, `הערכה: ${len} דק׳`),
    h('div.tiles',
      tile('עריכה', 'edit', () => { sh.close(); openBlockEditor({ occKey: key }); }),
      tile('העברה למחר', 'arrow', () => {
        const d2 = addDays(o.date, 1);
        const at = findGap(s, d2, len, o.s) ?? findGap(s, d2, len, 0);
        act('הועבר למחר', (st) => updateOcc(st, findOcc(st, key), { date: d2, ...(at != null ? { start: fromMin(at), end: fromMin(at + len) } : {}) }, 'this'), { undoToast: true });
        sh.close();
        if (at == null) toast('הועבר למחר באותה שעה – אין זמן פנוי, בדקי חפיפות');
      }),
      tile('שכפול', 'dup', async () => {
        sh.close();
        const where = await choose('שכפול בלוק', [
          { value: 'after', label: 'מיד אחרי, באותו יום', icon: 'clock' },
          { value: 'tomorrow', label: 'מחר באותה שעה', icon: 'arrow' },
          { value: 'week', label: 'בשבוע הבא באותו יום', icon: 'week' },
        ]);
        if (!where) return;
        act('שוכפל', (st) => duplicateOcc(st, o, where === 'after' ? o.date : addDays(o.date, where === 'tomorrow' ? 1 : 7), where === 'after' ? o.e : o.s), { undoToast: true });
      }),
      tile('פיצול', 'scissors', () => { sh.close(); openSplit(o); }),
      nx ? tile('מיזוג עם הבא', 'merge', () => {
        act('אוחד עם הבלוק הבא', (st) => mergeWithNext(st, findOcc(st, key)), { undoToast: true });
        sh.close();
      }) : null,
      tile('מחיקה', 'trash', () => { sh.close(); deleteFlow(o); }, 'danger'),
    ),
  );
  const sh = openSheet({ title: 'פעולות', body });
}

function openSplit(o) {
  const mid = Math.round((o.s + (o.e - o.s) / 2) / 5) * 5;
  const at = input('time', fromMin(mid), { step: 300 });
  const sh = openSheet({
    title: 'פיצול בלוק',
    body: h('div.form', h('p.muted', `${o.title} · ${o.start}–${o.end}`), field('לפצל בשעה', at, 'יתקבלו שני בלוקים נפרדים שאפשר להזיז בנפרד')),
    footer: [btn('ביטול', () => sh.close(), 'ghost'), btn('פיצול', () => {
      const ok = store.commit('פוצל', (st) => splitOcc(st, findOcc(st, o.key) || o, toMin(at.value)));
      if (!ok) { store.undo(); toast('בחרי שעה בתוך הבלוק'); return; }
      sh.close();
      toast('הבלוק פוצל ✓', { action: { label: 'ביטול', fn: () => store.undo() } });
    }, 'primary', 'scissors')],
  });
}

// ---------- tasks ----------
export function openTaskEditor(taskId = null, defaults = {}) {
  const s = store.s;
  const t = taskId ? s.tasks.find((x) => x.id === taskId) : null;
  const d = t || { title: '', cat: 'study', priority: 2, estimate: 30, deadline: null, date: null, status: 'todo', subtasks: [], rec: null, notes: '', goalId: null, courseId: null, ...defaults };
  const title = input('text', d.title, { placeholder: 'מה צריך לעשות?', autofocus: true, enterKeyHint: 'done' });
  const catSel = select(catOptions(s), d.cat);
  const pri = seg([{ value: 1, label: 'גבוהה' }, { value: 2, label: 'בינונית' }, { value: 3, label: 'נמוכה' }], d.priority || 2);
  const est = input('number', d.estimate ?? '', { min: 0, step: 5, inputMode: 'numeric' });
  const date = input('date', d.date || '');
  const deadline = input('date', d.deadline || '');
  const status = select([{ value: 'todo', label: 'לביצוע' }, { value: 'doing', label: 'בתהליך' }, { value: 'done', label: 'הושלם' }], d.status);
  const courseSel = select(courseOptions(s), d.courseId || '');
  const goalSel = select(goalOptions(s), d.goalId || '');
  const notes = textarea(d.notes, { placeholder: 'הערות' });
  const rec = recEditor(d.rec, d.rec?.until);
  let subs = (d.subtasks || []).map((x) => ({ ...x }));
  const subList = h('div.subs');
  const renderSubs = () => subList.replaceChildren(...subs.map((sub, i) => h('div.sub-row',
    check('', sub.done, (v) => { sub.done = v; }),
    h('input.input.sm', { value: sub.title, oninput: (e) => { sub.title = e.target.value; } }),
    h('button.icon-btn.ghost', { type: 'button', 'aria-label': 'מחיקת תת-משימה', html: icon('x', 16), onclick: () => { subs.splice(i, 1); renderSubs(); } }))),
  h('button.link-btn', { type: 'button', onclick: () => { subs.push({ id: uid(), title: '', done: false }); renderSubs(); subList.querySelector('.sub-row:last-of-type input.input')?.focus(); } }, '+ תת-משימה'));
  renderSubs();
  const body = h('div.form',
    field('משימה', title),
    h('div.grid2', field('קטגוריה', catSel), field('זמן משוער (דק׳)', est)),
    field('עדיפות', pri),
    h('div.grid2', field('תאריך ביצוע', date), field('דדליין', deadline)),
    h('div.grid2', field('סטטוס', status), field('קורס', courseSel)),
    field('מטרה', goalSel),
    field('תתי-משימות', subList),
    field('הערות', notes),
    h('details.more', { open: !!d.rec }, h('summary', 'חזרה (משימה קבועה)'), rec),
  );
  const save = () => {
    if (!title.value.trim()) { title.focus(); return; }
    const r = rec.read(date.value || today());
    const data = {
      title: title.value.trim(), cat: catSel.value, priority: Number(pri.value), estimate: est.value === '' ? null : Number(est.value),
      date: date.value || null, deadline: deadline.value || null, status: status.value,
      courseId: courseSel.value || null, goalId: goalSel.value || null, notes: notes.value,
      subtasks: subs.filter((x) => x.title.trim()),
      rec: r.rec ? { ...r.rec, from: (t?.rec?.from) || date.value || today(), until: r.until } : null,
    };
    act(t ? 'המשימה עודכנה' : 'נוספה משימה', (st) => {
      if (t) Object.assign(st.tasks.find((x) => x.id === t.id), data);
      else st.tasks.push({ id: uid(), doneDates: {}, createdAt: today(), ...data });
    });
    sh.close();
    toast(t ? 'נשמר ✓' : 'המשימה נוספה ✓');
  };
  const sh = openSheet({
    title: t ? 'עריכת משימה' : 'משימה חדשה', body,
    footer: [
      t ? btn('מחיקה', () => { sh.close(); act(`"${t.title}" נמחקה`, (st) => { st.tasks = st.tasks.filter((x) => x.id !== t.id); }, { undoToast: true }); }, 'ghost danger-text', 'trash') : null,
      t ? btn('לתזמן ביומן', () => { sh.close(); scheduleTask(t.id); }, 'ghost', 'calendar') : null,
      h('span.spacer'),
      btn('שמירה', save, 'primary', 'check'),
    ],
  });
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
}

export function scheduleTask(taskId) {
  const s = store.s;
  const t = s.tasks.find((x) => x.id === taskId);
  if (!t) return;
  const len = Math.max(15, t.estimate || 30);
  const dateIn = input('date', t.date || today());
  const startIn = input('time', '', { step: 300 });
  const suggest = (searchAhead) => {
    let d = dateIn.value || today();
    if (d < today()) d = today();
    let at = null;
    for (let i = 0; i < (searchAhead ? 14 : 1) && at == null; i++) {
      const dd = addDays(d, i);
      at = findGap(store.s, dd, len, dd === today() ? nowMin() + 10 : 0);
      if (at != null) d = dd;
    }
    dateIn.value = d;
    startIn.value = at != null ? fromMin(at) : '';
    hint.textContent = at != null ? `החלון הפנוי הראשון: ${fmtDayShort(d)} ${fromMin(at)}` : 'אין חלון פנוי מתאים ביום הזה – אפשר לבחור שעה ידנית (תוצג התראת חפיפה)';
  };
  const hint = h('small.field-hint');
  dateIn.onchange = () => suggest(false);
  suggest(true);
  const sh = openSheet({
    title: 'תזמון ביומן',
    body: h('div.form', h('p', h('b', t.title), ` · ${dur(len)}`), h('div.grid2', field('יום', dateIn), field('שעה', startIn)), hint),
    footer: [btn('ביטול', () => sh.close(), 'ghost'), btn('הוספה ליומן', () => {
      if (!startIn.value) { toast('בחרי שעה'); return; }
      const st0 = toMin(startIn.value);
      act('נוסף ליומן', (st) => {
        st.blocks.push({ id: uid(), title: t.title, cat: t.cat, date: dateIn.value, start: startIn.value, end: fromMin(st0 + len), fixed: false, done: false, actual: null, notes: t.notes || '', courseId: t.courseId, goalId: t.goalId, assignmentId: null, taskId: t.id, meta: null });
        const tt = st.tasks.find((x) => x.id === t.id);
        if (!tt.rec) tt.date = dateIn.value;
      });
      sh.close();
      toast('נוסף ליומן ✓', { action: { label: 'פתיחה', fn: () => go(`#/day/${dateIn.value}`) } });
    }, 'primary', 'calendar')],
  });
}

// ---------- export ----------
export async function openExport(iso) {
  const sh = openSheet({ title: 'ייצוא הלוח כתמונה', wide: true, body: h('div.export-loading', h('div.spinner'), h('p', 'מעצבת את הלוח…')) });
  let blobs;
  try {
    blobs = await renderDayImages(store.s, iso);
  } catch (e) {
    console.error(e);
    sh.set(h('p', 'לא הצלחתי ליצור תמונה: ' + e.message));
    return;
  }
  const files = blobs.map((b, i) => new File([b], `planner-${iso}${blobs.length > 1 ? '-' + (i + 1) : ''}.png`, { type: 'image/png' }));
  const urls = blobs.map((b) => URL.createObjectURL(b));
  const canShare = !!(navigator.canShare && navigator.canShare({ files }));
  const canCopy = !!(navigator.clipboard && window.ClipboardItem);
  const download = (i) => {
    const a = h('a', { href: urls[i], download: files[i].name });
    document.body.append(a);
    a.click();
    a.remove();
  };
  const share = async (fs) => {
    try {
      await navigator.share({ files: fs, title: 'הלוח שלי', text: fmtLong(iso) });
    } catch (e) {
      if (e.name !== 'AbortError') toast('השיתוף לא הצליח – נסי הורדה');
    }
  };
  const copy = async (i) => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobs[i] })]);
      toast('התמונה הועתקה ✓');
    } catch {
      toast('הדפדפן לא מאפשר העתקת תמונה – לחיצה ארוכה על התמונה ← העתקה');
    }
  };
  const standaloneIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  sh.set([
    h('p.muted.center', `${fmtLong(iso)} · ${blobs.length > 1 ? `${blobs.length} תמונות (היום ארוך – חולק כדי שלא ייחתך)` : 'תמונה אחת'} · 1080×1920`),
    h('div.export-grid', urls.map((u, i) => h('figure.export-fig',
      h('img', { src: u, alt: `הלוח של ${fmtLong(iso)} – עמוד ${i + 1}` }),
      h('figcaption.row.center',
        canShare ? btn('', () => share([files[i]]), 'ghost sm', 'share', { 'aria-label': 'שיתוף תמונה זו' }) : null,
        canCopy ? btn('', () => copy(i), 'ghost sm', 'copy', { 'aria-label': 'העתקת תמונה זו' }) : null,
        btn('', () => download(i), 'ghost sm', 'download', { 'aria-label': 'הורדת תמונה זו' }))))),
    standaloneIOS ? h('p.hint', ic('sparkle', 14), ' באייפון: "שיתוף" ← "שמירת תמונה" שומר לתמונות, או בחרי WhatsApp ושלחי לעצמך. אפשר גם ללחוץ לחיצה ארוכה על התמונה.') : null,
  ], [
    canShare ? btn(blobs.length > 1 ? 'שיתוף כל התמונות' : 'שיתוף / שמירה לתמונות', () => share(files), 'primary', 'share') : null,
    canCopy ? btn('העתקה', () => copy(0), 'ghost', 'copy') : null,
    btn(blobs.length > 1 ? 'הורדת הכל' : 'הורדה', () => urls.forEach((_, i) => setTimeout(() => download(i), i * 400)), canShare ? 'ghost' : 'primary', 'download'),
  ]);
}

// ---------- weekly planner preview ----------
export function openPlanner(ws) {
  const { proposals, notes, slots } = planWeek(store.s, ws);
  const byDay = {};
  for (const p of proposals) (byDay[p.date] ||= []).push(p);
  const body = h('div',
    h('p.muted', `השבוע ${weekLabel(ws)} · ${slots} בלוקי עומק פנויים לתכנון. המתכננת ממלאת רק בלוקים שלא ערכת ידנית, ולא נוגעת בהתחייבויות קבועות, שינה, ארוחות והפסקות.`),
    notes.length ? h('div.alert-list', notes.map((n) => h('div.alert.warn', ic('alert', 16), h('span', n)))) : null,
    proposals.length ? Object.keys(byDay).sort().map((d) => h('div.plan-day',
      h('h4', fmtDayShort(d) + ' · ' + DAY_NAMES[new Date(d).getUTCDay()]),
      byDay[d].map((p) => h('div.plan-row', { style: { '--c': cat(store.s, p.cat).color } },
        h('span.plan-time', `${p.start}–${p.end}`), h('span.plan-new', p.title), h('small.muted', 'במקום: ' + p.before))))) :
      h('p.empty-inline', 'הכול כבר מתוכנן – אין שינויים מוצעים.'),
  );
  const sh = openSheet({
    title: 'תכנון שבועי חכם', wide: true, body,
    footer: [btn('ביטול', () => sh.close(), 'ghost'), proposals.length ? btn(`החלת ${proposals.length} שינויים`, () => {
      act('השבוע תוכנן', (st) => applyPlan(st, ws, proposals));
      sh.close();
      toast('השבוע תוכנן ✓', { action: { label: 'ביטול', fn: () => store.undo() } });
    }, 'primary', 'wand') : null],
  });
}

// ---------- reschedule unfinished ----------
export function openReschedule(iso) {
  let includeUpcoming = false;
  const sh = openSheet({ title: 'העברת משימות שלא הושלמו', wide: true });
  const render = () => {
    const p = proposeReschedule(store.s, iso, includeUpcoming);
    const any = p.moves.length || p.unplaced.length;
    sh.set(h('div',
      h('p.muted', 'בלוקים שלא סומנו כבוצעו יועברו לחלונות פנויים בימים הקרובים, בלי לגעת בהתחייבויות קבועות, שינה, ארוחות והפסקות.'),
      iso === today() ? check('לכלול גם בלוקים של היום שעוד לא התחילו', includeUpcoming, (v) => { includeUpcoming = v; render(); }) : null,
      !any ? h('p.empty-inline', 'אין מה להעביר – כל הכבוד! ✨') : null,
      p.moves.map((m) => h('div.plan-row', { style: { '--c': cat(store.s, m.o.cat).color } },
        h('span.plan-new', m.o.title), h('small', `${m.o.start} ← ${fmtDayShort(m.date)} ${fromMin(m.s)}–${fromMin(m.e)}`))),
      p.unplaced.length ? [h('h4', 'לא נמצא זמן פנוי (יועברו לרשימת המשימות):'), p.unplaced.map((o) => h('div.plan-row.muted', { style: { '--c': cat(store.s, o.cat).color } }, h('span.plan-new', o.title), h('small', dur(o.e - o.s))))] : null,
    ), [btn('ביטול', () => sh.close(), 'ghost'), any ? btn('אישור והעברה', () => {
      act('בלוקים הועברו', (st) => { applyMoves(st, p.moves); for (const o of p.unplaced) occToTask(st, o); });
      sh.close();
      toast(`${p.moves.length} הועברו${p.unplaced.length ? `, ${p.unplaced.length} לרשימת המשימות` : ''} ✓`, { action: { label: 'ביטול', fn: () => store.undo() } });
    }, 'primary', 'arrow') : null]);
  };
  render();
}

export function openWorkLate(iso) {
  const sh = openSheet({ title: 'העבודה התארכה' });
  const pick = (min) => {
    const p = proposeWorkLate(store.s, iso, min);
    if (!p) { sh.set(h('p', 'אין בלוק עבודה ביום הזה.')); return; }
    sh.set(h('div',
      h('p', `העבודה תסתיים ב-${fromMin(p.work.e + min)}. שעת השינה (${store.s.settings.bed}) נשמרת.`),
      p.shifts.slice(1).map((x) => h('div.plan-row', { style: { '--c': cat(store.s, x.o.cat).color } }, h('span.plan-new', x.o.title), h('small', `${x.o.start} ← ${fromMin(x.s)}–${fromMin(x.e)}`))),
      p.moves.map((m) => h('div.plan-row', { style: { '--c': cat(store.s, m.o.cat).color } }, h('span.plan-new', m.o.title), h('small', `יועבר ל${fmtDayShort(m.date)} ${fromMin(m.s)}`))),
      p.removes.length ? h('p.muted', 'יבוטלו להיום: ' + p.removes.map((o) => o.title).join(', ')) : null,
    ), [btn('חזרה', () => sh.set(options()), 'ghost'), btn('אישור', () => {
      act('היום עודכן', (st) => applyWorkLate(st, p));
      sh.close();
      toast('היום עודכן ✓', { action: { label: 'ביטול', fn: () => store.undo() } });
    }, 'primary', 'check')]);
  };
  const options = () => h('div', h('p.muted', 'בכמה זמן?'), h('div.chips-row', [15, 30, 45, 60, 90, 120].map((m) => btn(dur(m), () => pick(m), 'ghost'))));
  sh.set(options());
}

// ---------- weekly review ----------
export function openWeekReview(ws) {
  const s = store.s;
  const r = s.reviews[ws] || {};
  const st = weekStats(s, ws);
  const wins = textarea(r.wins, { placeholder: 'מה הצליח לי השבוע? במה אני גאה?' });
  const lessons = textarea(r.lessons, { placeholder: 'מה היה קשה? מה לומדים מזה?' });
  const next = textarea(r.next, { placeholder: '3 עדיפויות לשבוע הבא' });
  const brave = textarea(r.brave, { placeholder: 'רגע של אומץ / ביטחון השבוע' });
  const goalsRow = s.goals.filter((g) => !g.longTerm && (g.cats || []).length).map((g) => {
    const w = goalWeek(s, g, ws);
    return h('div.mini-stat', h('b', g.title), h('span', `${hours(w.done)} / ${hours(w.planned)} ש׳`));
  });
  const sh = openSheet({
    title: 'סקירה שבועית · ' + weekLabel(ws), wide: true,
    body: h('div.form',
      h('div.row.wrap', h('span.chip', `מתוכנן: ${hours(st.planned)} ש׳`), h('span.chip', `בוצע: ${hours(st.actual)} ש׳`)),
      h('div.mini-stats', goalsRow),
      field('הצלחות', wins), field('תובנות', lessons), field('ביטחון עצמי', brave), field('לשבוע הבא', next)),
    footer: [btn('סגירה', () => sh.close(), 'ghost'), btn('שמירה', () => {
      act('הסקירה נשמרה', (x) => { x.reviews[ws] = { wins: wins.value, lessons: lessons.value, next: next.value, brave: brave.value, at: Date.now() }; });
      sh.close();
      toast('הסקירה נשמרה ✓');
    }, 'primary', 'check')],
  });
}

// ---------- goals ----------
export function openGoalEditor(goalId = null) {
  const s = store.s;
  const g = goalId ? s.goals.find((x) => x.id === goalId) : null;
  const d = g || { title: '', icon: 'target', color: '#C9788A', priority: 2, deadline: null, cats: [], outcome: '', why: '', steps: [], milestones: [], progressMode: 'auto', progress: 0, longTerm: false, notes: '' };
  const title = input('text', d.title, { autofocus: true });
  const deadline = input('date', d.deadline || '');
  const color = input('color', d.color);
  const pri = seg([{ value: 1, label: 'עליונה' }, { value: 2, label: 'גבוהה' }, { value: 3, label: 'רגילה' }], d.priority);
  const outcome = textarea(d.outcome, { placeholder: 'איך אדע שהצלחתי? (תוצאה מדידה)' });
  const why = textarea(d.why, { placeholder: 'למה זה חשוב לי?' });
  const notes = textarea(d.notes, { placeholder: 'הערות' });
  const longTerm = check('חלום ארוך טווח (בלי בלוקים יומיים)', d.longTerm);
  const mode = seg([{ value: 'auto', label: 'אוטומטית לפי צעדים' }, { value: 'manual', label: 'ידנית' }], d.progressMode);
  const prog = input('range', d.progress || 0, { min: 0, max: 100, step: 5 });
  const catsWrap = h('div.checks', s.categories.map((c) => { const el = check(c.name, (d.cats || []).includes(c.id)); el.dataset.cat = c.id; return el; }));
  const iconSel = select(['target', 'briefcase', 'school', 'heart', 'car', 'globe', 'cpu', 'run', 'home', 'book', 'sparkle', 'users'].map((x) => ({ value: x, label: x })), d.icon);
  const body = h('div.form',
    field('שם המטרה', title),
    h('div.grid2', field('תאריך יעד', deadline), field('צבע', color)),
    field('עדיפות', pri),
    field('תוצאה מדידה', outcome),
    field('למה', why),
    field('קטגוריות ביומן שמקושרות למטרה', catsWrap, 'שעות ביומן בקטגוריות האלה ייספרו כהתקדמות שבועית'),
    field('חישוב התקדמות', mode),
    field('התקדמות ידנית', prog),
    h('div.grid2', field('אייקון', iconSel), longTerm),
    field('הערות', notes),
  );
  const sh = openSheet({
    title: g ? 'עריכת מטרה' : 'מטרה / חלום חדש', body,
    footer: [
      g ? btn('מחיקה', async () => {
        if (!(await confirmDialog(`למחוק את "${g.title}"?`, { ok: 'מחיקה', danger: true }))) return;
        sh.close();
        act('המטרה נמחקה', (st) => { st.goals = st.goals.filter((x) => x.id !== g.id); }, { undoToast: true });
        go('#/goals');
      }, 'ghost danger-text', 'trash') : null,
      h('span.spacer'),
      btn('שמירה', () => {
        if (!title.value.trim()) return title.focus();
        const data = {
          title: title.value.trim(), deadline: deadline.value || null, color: color.value, priority: Number(pri.value),
          outcome: outcome.value, why: why.value, notes: notes.value, longTerm: longTerm.querySelector('input').checked,
          progressMode: mode.value, progress: Number(prog.value), icon: iconSel.value,
          cats: [...catsWrap.children].filter((c) => c.querySelector('input').checked).map((c) => c.dataset.cat),
        };
        const newId = g ? g.id : 'g-' + uid();
        act('המטרה נשמרה', (st) => {
          if (g) Object.assign(st.goals.find((x) => x.id === g.id), data);
          else st.goals.push({ id: newId, steps: [], milestones: [], ...data });
        });
        sh.close();
        if (!g) go(`#/goal/${newId}`);
      }, 'primary', 'check'),
    ],
  });
}

// ---------- university ----------
export function openAssignmentEditor(id = null, courseId = null) {
  const s = store.s;
  const a = id ? s.assignments.find((x) => x.id === id) : null;
  const d = a || { courseId: courseId || s.courses[0]?.id, title: '', due: today(), estimateH: 6, kind: 'mmn', status: 'not-started', grade: null, extendedTo: null, loggedMin: 0, target: null, notes: '' };
  const title = input('text', d.title, { placeholder: 'ממ"ן 01' });
  const courseSel = select(s.courses.map((c) => ({ value: c.id, label: c.name })), d.courseId);
  const due = input('date', d.due);
  const target = input('date', d.target || '');
  const ext = input('date', d.extendedTo || '');
  const est = input('number', d.estimateH, { min: 0, step: 0.5, inputMode: 'decimal' });
  const logged = input('number', Math.round((d.loggedMin || 0) / 6) / 10, { min: 0, step: 0.5, inputMode: 'decimal' });
  const status = select(Object.entries(STATUS).map(([value, label]) => ({ value, label })), d.status);
  const grade = input('number', d.grade ?? '', { min: 0, max: 100, inputMode: 'numeric' });
  const notes = textarea(d.notes);
  const skipWarn = h('p.alert.warn', ic('alert', 16), h('span', 'שימי לב: דילוג על מטלה עלול להשפיע על הציון הסופי או על זכאות לבחינה – בדקי את תנאי הקורס.'));
  const upd = () => { skipWarn.hidden = status.value !== 'skipped'; };
  status.onchange = upd;
  upd();
  const sh = openSheet({
    title: a ? 'עריכת מטלה' : 'מטלה חדשה',
    body: h('div.form',
      h('div.grid2', field('שם', title), field('קורס', courseSel)),
      h('div.grid2', field('הגשה רשמית (23:59)', due), field('יעד פנימי', target, a ? `ברירת מחדל: ${fmtDM(internalTarget({ ...a, target: null }))}` : 'ריק = יומיים לפני, לא בשישי/שבת')),
      h('div.grid2', field('סטטוס', status), field('הארכה עד', ext)),
      skipWarn,
      h('div.grid2', field('הערכת זמן (שעות)', est), field('שעות שהושקעו', logged)),
      field('ציון', grade),
      field('הערות', notes)),
    footer: [
      a ? btn('מחיקה', () => { sh.close(); act('המטלה נמחקה', (st) => { st.assignments = st.assignments.filter((x) => x.id !== a.id); }, { undoToast: true }); }, 'ghost danger-text', 'trash') : null,
      h('span.spacer'),
      btn('שמירה', () => {
        if (!title.value.trim() || !due.value) { toast('חסרים שם ותאריך הגשה'); return; }
        const data = {
          title: title.value.trim(), courseId: courseSel.value, due: due.value, target: target.value || null, extendedTo: ext.value || null,
          estimateH: Number(est.value) || 0, loggedMin: Math.round((Number(logged.value) || 0) * 60), status: status.value,
          grade: grade.value === '' ? null : Number(grade.value), notes: notes.value,
        };
        if (data.status === 'extended' && !data.extendedTo) { toast('הוסיפי תאריך הארכה'); return; }
        act('המטלה נשמרה', (st) => {
          if (a) Object.assign(st.assignments.find((x) => x.id === a.id), data);
          else st.assignments.push({ id: uid(), kind: 'mmn', ...data });
        });
        sh.close();
        toast('נשמר ✓');
      }, 'primary', 'check'),
    ],
  });
}

export function openCourseEditor(id = null) {
  const s = store.s;
  const c = id ? s.courses.find((x) => x.id === id) : null;
  const d = c || { name: '', short: '', color: '#C76D7E', targetGrade: 95, grade: null, lectures: { total: 12, watched: 0 }, weeklyH: 4, examDate: null, notes: '', active: true };
  const name = input('text', d.name, { autofocus: true });
  const short = input('text', d.short);
  const color = input('color', d.color);
  const target = input('number', d.targetGrade ?? '', { min: 0, max: 100 });
  const grade = input('number', d.grade ?? '', { min: 0, max: 100 });
  const total = input('number', d.lectures.total, { min: 0 });
  const weekly = input('number', d.weeklyH, { min: 0, step: 0.5 });
  const exam = input('date', d.examDate || '');
  const active = check('קורס פעיל (נכלל בתכנון השבועי)', d.active !== false);
  const notes = textarea(d.notes);
  const sh = openSheet({
    title: c ? 'עריכת קורס' : 'קורס חדש',
    body: h('div.form',
      h('div.grid2', field('שם הקורס', name), field('שם קצר', short)),
      h('div.grid2', field('ציון יעד', target), field('ציון סופי', grade)),
      h('div.grid2', field('מספר הרצאות', total), field('שעות לימוד שבועיות (יעד)', weekly)),
      h('div.grid2', field('תאריך בחינה', exam), field('צבע', color)),
      active, field('הערות', notes)),
    footer: [
      c ? btn('מחיקה', async () => {
        if (!(await confirmDialog(`למחוק את הקורס "${c.name}" ואת המטלות שלו?`, { ok: 'מחיקה', danger: true }))) return;
        sh.close();
        act('הקורס נמחק', (st) => { st.courses = st.courses.filter((x) => x.id !== c.id); st.assignments = st.assignments.filter((x) => x.courseId !== c.id); }, { undoToast: true });
      }, 'ghost danger-text', 'trash') : null,
      h('span.spacer'),
      btn('שמירה', () => {
        if (!name.value.trim()) return name.focus();
        const data = {
          name: name.value.trim(), short: short.value.trim() || name.value.trim(), color: color.value,
          targetGrade: target.value === '' ? null : Number(target.value), grade: grade.value === '' ? null : Number(grade.value),
          weeklyH: Number(weekly.value) || 0, examDate: exam.value || null, notes: notes.value, active: active.querySelector('input').checked,
        };
        act('הקורס נשמר', (st) => {
          if (c) { const x = st.courses.find((y) => y.id === c.id); Object.assign(x, data); x.lectures.total = Number(total.value) || 0; }
          else st.courses.push({ id: 'c-' + uid(), lectures: { total: Number(total.value) || 0, watched: 0 }, plannerKey: null, ...data });
        });
        sh.close();
      }, 'primary', 'check'),
    ],
  });
}

export function openExamEditor(id = null) {
  const s = store.s;
  const e = id ? s.exams.find((x) => x.id === id) : null;
  const d = e || { title: '', date: today(), time: '09:00', courseId: null, notes: '' };
  const title = input('text', d.title, { autofocus: true });
  const date = input('date', d.date);
  const time = input('time', d.time || '');
  const courseSel = select(courseOptions(s), d.courseId || '');
  const notes = textarea(d.notes);
  const sh = openSheet({
    title: e ? 'עריכת מבחן' : 'מבחן חדש',
    body: h('div.form', field('שם', title), h('div.grid2', field('תאריך', date), field('שעה', time)), field('קורס', courseSel), field('הערות', notes)),
    footer: [
      e ? btn('מחיקה', () => { sh.close(); act('המבחן נמחק', (st) => { st.exams = st.exams.filter((x) => x.id !== e.id); }, { undoToast: true }); }, 'ghost danger-text', 'trash') : null,
      h('span.spacer'),
      btn('שמירה', () => {
        if (!title.value.trim() || !date.value) return;
        const data = { title: title.value.trim(), date: date.value, time: time.value, courseId: courseSel.value || null, notes: notes.value };
        act('המבחן נשמר', (st) => { if (e) Object.assign(st.exams.find((x) => x.id === e.id), data); else st.exams.push({ id: uid(), goalId: 'g-academic', ...data }); });
        sh.close();
      }, 'primary', 'check'),
    ],
  });
}

export function quickAdd(date = today()) {
  choose('מה להוסיף?', [
    { value: 'block', label: 'בלוק ביומן', sub: 'זמן מוגדר ביום', icon: 'calendar' },
    { value: 'task', label: 'משימה', sub: 'עם דדליין, עדיפות ותתי-משימות', icon: 'tasks' },
    { value: 'lesson', label: 'שיעור נהיגה', sub: 'המורה קובע את השעה', icon: 'car' },
  ]).then((v) => {
    if (v === 'block') openBlockEditor({ date });
    if (v === 'task') openTaskEditor(null, { date });
    if (v === 'lesson') {
      const g = store.s.goals.find((x) => x.tracker === 'driving');
      const no = (g?.lessonsDone || 22) + 1;
      openBlockEditor({ date, start: '07:20', end: '08:50', preset: { title: 'שיעור נהיגה כפול', cat: 'driving', goalId: g?.id, meta: { lessonNo: `${no}–${no + 1}`, cost: null, double: true } } });
    }
  });
}
