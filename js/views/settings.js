import { store, uid, validateBackup } from '../store.js';
import { h, ic, btn, seg, field, input, select, textarea, check, dayPicker, openSheet, confirmDialog, toast, iconBtn, hexA } from '../ui.js';
import { syncTemplatesFromSettings, recLabel, newSeries, sleepMinutes, cat } from '../engine.js';
import { toMin, dur, today } from '../date.js';
import { DAY_TYPES, createSeed } from '../seed.js';
import { pageHead, card } from './common.js';
import { act } from '../editors.js';
import { applyTheme } from '../theme.js';

function seriesEditor(id = null, defaults = {}) {
  const s = store.s;
  const sr = id ? s.series.find((x) => x.id === id) : null;
  const d = sr || { title: '', cat: 'study', start: '09:00', end: '10:00', rec: { kind: 'daytype', types: ['study'] }, from: today(), until: null, fixed: false, notes: '', slot: null, ...defaults };
  const title = input('text', d.title, { autofocus: true });
  const catSel = select(s.categories.map((c) => ({ value: c.id, label: c.name })), d.cat);
  const start = input('time', d.start, { step: 300 });
  const end = input('time', d.end, { step: 300 });
  const kind = select([{ value: 'daytype', label: 'לפי סוג יום' }, { value: 'weekly', label: 'ימים קבועים בשבוע' }, { value: 'daily', label: 'כל יום' }], d.rec.kind);
  const types = Object.entries(DAY_TYPES).map(([k, v]) => { const c = check(v, (d.rec.types || []).includes(k)); c.dataset.t = k; return c; });
  const days = dayPicker(d.rec.days || []);
  const every = input('number', d.rec.every || 1, { min: 1 });
  const from = input('date', d.from);
  const until = input('date', d.until || '');
  const fixed = check('התחייבות קבועה', d.fixed);
  const slot = select([{ value: '', label: 'רגיל' }, { value: 'focus', label: 'בלוק עומק (התכנון החכם יבחר נושא)' }, { value: 'career', label: 'בלוק קריירה (נושא מתחלף)' }], d.slot || '');
  const notes = textarea(d.notes);
  const recBox = h('div');
  const renderRec = () => recBox.replaceChildren(
    kind.value === 'daytype' ? field('סוגי ימים', h('div.checks', types)) : null,
    kind.value === 'weekly' ? h('div', field('ימים', days), field('כל כמה שבועות', every)) : null);
  kind.onchange = renderRec;
  renderRec();
  const sh = openSheet({
    title: sr ? 'עריכת פעילות קבועה' : 'פעילות קבועה חדשה',
    body: h('div.form',
      field('שם', title),
      h('div.grid2', field('קטגוריה', catSel), field('סוג בלוק', slot)),
      h('div.grid2', field('התחלה', start), field('סיום', end)),
      field('חזרה', kind), recBox,
      h('div.grid2', field('החל מ-', from), field('עד (לא חובה)', until)),
      fixed, field('הערות', notes),
      sr ? h('p.muted.small', 'שינוי כאן חל על כל המופעים. לשינוי של יום בודד – ערכי את הבלוק ביומן.') : null),
    footer: [
      sr ? btn('מחיקה', async () => {
        if (!(await confirmDialog(`למחוק את "${sr.title}" מכל הימים?`, { ok: 'מחיקה', danger: true }))) return;
        sh.close();
        act('הפעילות נמחקה', (st) => { st.series = st.series.filter((x) => x.id !== sr.id); }, { undoToast: true });
      }, 'ghost danger-text', 'trash') : null,
      h('span.spacer'),
      btn('שמירה', () => {
        if (!title.value.trim() || toMin(end.value) <= toMin(start.value)) { toast('בדקי שם ושעות'); return; }
        const rec = kind.value === 'daytype' ? { kind: 'daytype', types: types.filter((c) => c.querySelector('input').checked).map((c) => c.dataset.t) }
          : kind.value === 'weekly' ? { kind: 'weekly', days: days.value, every: Math.max(1, +every.value || 1) } : { kind: 'daily', every: 1 };
        const data = { title: title.value.trim(), cat: catSel.value, start: start.value, end: end.value, rec, from: from.value || today(), until: until.value || null, fixed: fixed.querySelector('input').checked, notes: notes.value, slot: slot.value || null };
        act('הפעילות נשמרה', (st) => {
          if (sr) Object.assign(st.series.find((x) => x.id === sr.id), data);
          else st.series.push({ ...newSeries(data), slot: data.slot });
        });
        sh.close();
      }, 'primary', 'check')],
  });
}

function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return blob;
}

export function render(root) {
  const s = store.s;
  const st = s.settings;

  // ---- rhythm ----
  const R = {
    wake: input('time', st.wake), bed: input('time', st.bed), sleepTarget: input('number', st.sleepTarget, { step: 0.25, min: 4, max: 12 }),
    workStart: input('time', st.workStart), workEnd: input('time', st.workEnd), commuteMin: input('number', st.commuteMin, { min: 0, step: 5 }),
    exerciseMin: input('number', st.exerciseMin, { min: 0, step: 5 }), viewStart: input('time', st.viewStart), viewEnd: input('time', st.viewEnd),
  };
  const sync = check('לעדכן גם את בלוקי התבנית (עבודה, נסיעות, קימה, תנועה, רגיעה לפני שינה)', true);
  const rhythm = card('שגרת יום',
    h('div.grid3', field('קימה', R.wake), field('שינה', R.bed), field('יעד שינה (שעות)', R.sleepTarget)),
    h('div.grid3', field('תחילת עבודה', R.workStart), field('סוף עבודה', R.workEnd), field('נסיעה (דק׳ לכל כיוון)', R.commuteMin)),
    h('div.grid3', field('תנועה בבוקר (דק׳)', R.exerciseMin), field('תחילת תצוגת יומן', R.viewStart), field('סוף תצוגת יומן', R.viewEnd)),
    h('p.muted.small', `חלון שינה נוכחי: ${dur(sleepMinutes(st))}`),
    sync,
    btn('שמירת שגרה', () => {
      act('השגרה עודכנה', (x) => {
        for (const [k, el] of Object.entries(R)) x.settings[k] = el.type === 'number' ? Number(el.value) : el.value;
        if (sync.querySelector('input').checked) syncTemplatesFromSettings(x);
      });
      toast('השגרה נשמרה ✓');
    }, 'primary', 'check'));

  // ---- patterns ----
  const patterns = card('דפוסי שבוע',
    h('p.muted.small', 'בכל שבוע בוחרים דפוס בנפרד במסך "שבוע". כאן קובעים את ברירת המחדל ואת הימים של כל דפוס.'),
    field('ברירת מחדל לשבוע חדש', seg([{ value: 'regular', label: s.patterns.regular.name }, { value: 'zoom', label: s.patterns.zoom.name }], st.defaultPattern,
      (v) => act('ברירת מחדל', (x) => { x.settings.defaultPattern = v; }))),
    ...['regular', 'zoom'].map((k) => h('div.pattern-edit',
      h('b', s.patterns[k].name),
      h('div.grid2',
        field('ימי עבודה', dayPicker(s.patterns[k].work, (v) => act('דפוס', (x) => { x.patterns[k].work = v.filter((d) => d < 5); }), ['א', 'ב', 'ג', 'ד', 'ה'])),
        field('ימי זום מהבית', dayPicker(s.patterns[k].zoom, (v) => act('דפוס', (x) => { x.patterns[k].zoom = v.filter((d) => d < 5); }), ['א', 'ב', 'ג', 'ד', 'ה'])))),
    ));

  // ---- templates ----
  const groups = Object.entries(DAY_TYPES).map(([k, label]) => {
    const list = s.series.filter((x) => x.rec.kind === 'daytype' && x.rec.types.includes(k) && (!x.until || x.until >= today())).sort((a, b) => toMin(a.start) - toMin(b.start));
    return h('details.tpl-group', h('summary', h('b', label), h('small.muted', ` · ${list.length} פעילויות`)),
      h('div.tpl-list', list.map((x) => h('button.tpl-row', { type: 'button', onclick: () => seriesEditor(x.id), style: { '--c': cat(s, x.cat).color } },
        h('span.tpl-time', `${x.start}–${x.end}`), h('span.tpl-t', x.title, x.slot === 'focus' ? h('small.chip.soft', 'עומק') : null, x.slot === 'career' ? h('small.chip.soft', 'קריירה') : null, x.until ? h('small.muted', ` עד ${x.until}`) : null),
        x.rec.types.length > 1 ? h('small.muted', x.rec.types.length + ' סוגי ימים') : null))),
      btn('+ פעילות ליום כזה', () => seriesEditor(null, { rec: { kind: 'daytype', types: [k] } }), 'ghost sm'));
  });
  const other = s.series.filter((x) => x.rec.kind !== 'daytype');
  const templates = card('תבניות ופעילויות קבועות',
    h('p.muted.small', 'סוג היום נקבע לפי דפוס השבוע: יום עבודה, יום זום, יום לימודים, שישי ושבת. כל הבלוקים ניתנים לעריכה.'),
    groups,
    other.length ? h('details.tpl-group', { open: true }, h('summary', h('b', 'פעילויות חוזרות נוספות')), h('div.tpl-list', other.map((x) => h('button.tpl-row', { type: 'button', onclick: () => seriesEditor(x.id), style: { '--c': cat(s, x.cat).color } }, h('span.tpl-time', `${x.start}–${x.end}`), h('span.tpl-t', x.title), h('small.muted', recLabel(x.rec)))))) : null,
    btn('פעילות קבועה חדשה', () => seriesEditor(), 'ghost', 'plus'));

  // ---- categories ----
  const cats = card('קטגוריות, צבעים ויעדי שעות שבועיים',
    h('div.cat-list', s.categories.map((c, i) => h('div.cat-row',
      h('input.color', { type: 'color', value: c.color, 'aria-label': 'צבע', onchange: (e) => act('צבע', (x) => { x.categories[i].color = e.target.value; }) }),
      h('input.input.sm', { value: c.name, 'aria-label': 'שם', onchange: (e) => act('שם', (x) => { x.categories[i].name = e.target.value; }) }),
      h('label.mini', h('input.input.sm.num', { type: 'number', min: 0, step: 0.5, value: c.target || 0, 'aria-label': 'יעד שעות', onchange: (e) => act('יעד', (x) => { x.categories[i].target = Number(e.target.value) || 0; }) }), h('small', 'ש׳/שבוע'))))),
    btn('קטגוריה חדשה', () => act('קטגוריה', (x) => { x.categories.push({ id: 'cat-' + uid(), name: 'קטגוריה חדשה', color: '#C9788A', icon: 'dot', target: 0 }); }), 'ghost sm', 'plus'));

  // ---- planner ----
  const P = st.planner;
  const weightRow = (key, label) => h('label.field.inline', h('span.field-label', label),
    h('input', { type: 'range', min: 0, max: 2, step: 0.1, value: P[key] ?? 1, 'aria-label': label, onchange: (e) => act('משקל', (x) => { x.settings.planner[key] = Number(e.target.value); }) }),
    h('small', String(P[key] ?? 1)));
  const planner = card('התכנון החכם',
    h('p.muted.small', 'משקלים יחסיים לחלוקת בלוקי העומק. מועדי הגשה קרובים תמיד מקבלים עדיפות; כל הצעה מוצגת לאישור לפני שינוי.'),
    s.courses.filter((c) => c.plannerKey).map((c) => weightRow(c.plannerKey, c.short)),
    weightRow('amiram', 'אמירם'),
    h('div.grid2',
      field('שעות השלמת חומר לפני פתרון מטלה', h('input.input', { type: 'number', min: 0, step: 0.5, value: P.learnFirstH, onchange: (e) => act('הגדרה', (x) => { x.settings.planner.learnFirstH = Number(e.target.value) || 0; }) })),
      field('בלוק מינימלי לפתרון מטלה (דק׳)', h('input.input', { type: 'number', min: 30, step: 15, value: P.minAssignmentBlock, onchange: (e) => act('הגדרה', (x) => { x.settings.planner.minAssignmentBlock = Number(e.target.value) || 90; }) }))),
    check('תכנון אוטומטי כשנכנסים לשבוע שלא תוכנן (עם אפשרות ביטול)', st.autoPlan, (v) => act('הגדרה', (x) => { x.settings.autoPlan = v; })));

  // ---- habits ----
  const habits = card('הרגלים',
    h('div.cat-list', s.habits.map((hb, i) => h('div.cat-row',
      h('input.input.sm', { value: hb.name, 'aria-label': 'שם הרגל', onchange: (e) => act('הרגל', (x) => { x.habits[i].name = e.target.value; }) }),
      iconBtn('trash', 'מחיקה', () => act('הרגל נמחק', (x) => { x.habits.splice(i, 1); }, { undoToast: true }), 'ghost')))),
    btn('הרגל חדש', () => act('הרגל', (x) => { x.habits.push({ id: 'h-' + uid(), name: 'הרגל חדש', icon: 'sparkle' }); }), 'ghost sm', 'plus'));

  // ---- quotes ----
  const qIn = input('text', '', { placeholder: 'משפט השראה אישי…', enterKeyHint: 'done' });
  const addQ = () => { if (qIn.value.trim()) act('נוסף משפט', (x) => { x.settings.customQuotes = [...(x.settings.customQuotes || []), qIn.value.trim()]; }); };
  qIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') addQ(); });
  const quotes = card('משפטי השראה אישיים',
    h('p.muted.small', 'המשפטים שלך יופיעו לצד משפטי ההשראה המובנים, בהתחלפות יומית.'),
    h('div.cat-list', (st.customQuotes || []).map((q, i) => h('div.cat-row', h('span.grow', q), iconBtn('trash', 'מחיקה', () => act('נמחק', (x) => { x.settings.customQuotes.splice(i, 1); }), 'ghost')))),
    h('div.quick-add', qIn, btn('', addQ, 'primary sm', 'plus', { 'aria-label': 'הוספה' })));

  // ---- appearance ----
  const look = card('מראה',
    field('ערכת צבעים', seg([{ value: 'auto', label: 'לפי המכשיר' }, { value: 'light', label: 'בהיר' }, { value: 'dark', label: 'כהה' }], st.theme, (v) => { act('ערכה', (x) => { x.settings.theme = v; }); applyTheme(v); })),
    field('עיצוב תמונת הייצוא', seg([{ value: 'blush', label: 'ורוד-שמנת' }, { value: 'night', label: 'לילה ורוד' }], st.exportTheme, (v) => act('ייצוא', (x) => { x.settings.exportTheme = v; }))),
    field('שם (לברכת הבוקר)', h('input.input', { value: st.name || '', onchange: (e) => act('שם', (x) => { x.settings.name = e.target.value.trim(); }) })));

  // ---- data ----
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const obj = JSON.parse(await f.text());
      if (!validateBackup(obj)) throw new Error('הקובץ אינו גיבוי תקין של המתכננת');
      if (!(await confirmDialog('הייבוא יחליף את כל הנתונים הנוכחיים במכשיר הזה בנתוני הגיבוי. להמשיך?', { ok: 'ייבוא', danger: true }))) return;
      store.replace(obj);
      applyTheme(store.s.settings.theme);
      toast('הגיבוי שוחזר ✓', { action: { label: 'ביטול', fn: () => store.undo() } });
    } catch (err) {
      toast('שגיאה בייבוא: ' + err.message);
    } finally { e.target.value = ''; }
  } });
  const persistInfo = h('small.muted');
  if (navigator.storage?.persisted) navigator.storage.persisted().then((p) => { persistInfo.textContent = p ? 'האחסון מוגן מפני מחיקה אוטומטית ✓' : 'האחסון במצב רגיל. התקנה למסך הבית ושימוש קבוע מפחיתים סיכון למחיקה; מומלץ לגבות מדי פעם.'; });
  const data = card('נתונים וגיבוי',
    h('p.small', 'כל הנתונים נשמרים מקומית במכשיר (IndexedDB) ועובדים גם בלי אינטרנט. הם לא מסתנכרנים אוטומטית בין מכשירים – לשם כך יש לייצא גיבוי ולייבא במכשיר השני.'),
    persistInfo,
    h('div.row.wrap',
      btn('ייצוא גיבוי (JSON)', async () => {
        const name = `planner-backup-${today()}.json`;
        const text = JSON.stringify(store.s, null, 1);
        const file = new File([text], name, { type: 'application/json' });
        if (navigator.canShare && navigator.canShare({ files: [file] }) && matchMedia('(pointer:coarse)').matches) {
          try { await navigator.share({ files: [file], title: 'גיבוי המתכננת' }); return; } catch (e) { if (e.name === 'AbortError') return; }
        }
        download(name, text);
      }, 'primary', 'download'),
      btn('ייבוא גיבוי', () => fileIn.click(), 'ghost', 'upload'),
      fileIn),
    h('details.more', h('summary', 'סנכרון בין מכשירים בעתיד'),
      h('p.small', 'סנכרון אמיתי דורש שרת ענן. המבנה מוכן לכך: כל הנתונים הם מסמך JSON אחד עם חותמת זמן עדכון, כך שאפשר לחבר בעתיד Supabase (טבלה אחת עם Row Level Security והתחברות במייל). מפתח ה-anon של Supabase ציבורי מטבעו; אסור לשים בקוד הצד-לקוח מפתחות סודיים (service role / API של Claude או Gemini).')),
    h('div.danger-zone',
      btn('איפוס לנתונים ההתחלתיים', async () => {
        if (!(await confirmDialog('כל השינויים שלך יימחקו והאפליקציה תחזור לנתוני הפתיחה. מומלץ לייצא גיבוי קודם. להמשיך?', { ok: 'איפוס', danger: true }))) return;
        store.replace(createSeed(), 'איפוס');
        toast('אופס לנתונים ההתחלתיים', { action: { label: 'ביטול', fn: () => store.undo() } });
      }, 'ghost danger-text', 'trash')));

  const install = card('התקנה באייפון',
    h('ol.steps-ol',
      h('li', 'פתחי את הכתובת ב-Safari.'),
      h('li', 'לחצי על כפתור השיתוף (ריבוע עם חץ למעלה).'),
      h('li', 'בחרי "הוספה למסך הבית" ← "הוסף".'),
      h('li', 'פתחי מהאייקון במסך הבית – האפליקציה תעבוד במסך מלא וגם בלי אינטרנט.')));

  root.replaceChildren(h('div.page.settings',
    pageHead('הגדרות', 'הכול ניתן לעריכה – שעות, תבניות, צבעים, משקלים ונתונים'),
    h('div.grid-2', h('div.stack', rhythm, patterns, look, quotes), h('div.stack', templates, planner, cats, habits)),
    h('div.grid-2', data, install),
    h('p.muted.small.center', 'המתכננת שלי · הנתונים נשמרים רק במכשיר שלך'),
  ));
}
