import { store } from '../store.js';
import { h, ic, iconBtn, btn, seg, dayPicker, bar, toast } from '../ui.js';
import { weekPlanFor, weekStats, range7, cat, findOcc, moveOcc, updateOcc } from '../engine.js';
import { today, weekStart, addDays, weekLabel, isISO, hours, fromMin } from '../date.js';
import { timeGrid } from '../timegrid.js';
import { go, act, openOccActions, openBlockEditor, openPlanner, openWeekReview, openExport, quickAdd } from '../editors.js';

export function render(root, [arg]) {
  const s = store.s;
  const t = today();
  const ws = weekStart(isISO(arg) ? arg : t);
  const wp = weekPlanFor(s, ws);
  const days = range7(ws);

  const setPattern = (p) => act('דפוס השבוע עודכן', (st) => {
    const cur = st.weekPlans[ws] || {};
    st.weekPlans[ws] = p === 'custom' ? { ...cur, pattern: 'custom', work: wp.work.slice(), zoom: wp.zoom.slice() } : { ...cur, pattern: p };
  });
  const patternSeg = seg([
    { value: 'regular', label: 'רגיל · ב׳–ד׳' }, { value: 'zoom', label: 'זום בשני · ג׳–ה׳' }, { value: 'custom', label: 'מותאם' },
  ], wp.pattern, setPattern);

  const custom = wp.pattern === 'custom' ? h('div.custom-pattern',
    h('div', h('span.field-label', 'ימי עבודה'), dayPicker(wp.work, (v) => act('ימי עבודה', (st) => { st.weekPlans[ws].work = v.filter((x) => x < 5); }), ['א', 'ב', 'ג', 'ד', 'ה'])),
    h('div', h('span.field-label', 'ימי זום מהבית'), dayPicker(wp.zoom, (v) => act('ימי זום', (st) => { st.weekPlans[ws].zoom = v.filter((x) => x < 5); }), ['א', 'ב', 'ג', 'ד', 'ה']))) : null;

  const narrow = matchMedia('(max-width: 720px)').matches;
  const grid = timeGrid(s, days, {
    ppm: narrow ? 0.95 : 1.05,
    compact: narrow,
    onTap: (key) => openOccActions(key),
    onEmpty: (date, m) => openBlockEditor({ date, start: fromMin(m), end: fromMin(m + 60) }),
    onChange: (key, date, sm, em) => {
      const o = findOcc(store.s, key);
      if (!o) return;
      act('הבלוק הוזז', (st) => {
        const oo = findOcc(st, key);
        if (date !== oo.date) moveOcc(st, oo, date, sm, em);
        else updateOcc(st, oo, { start: fromMin(sm), end: fromMin(em) }, 'this');
      });
      toast(o.src === 'series' ? 'עודכן רק המופע הזה (הסדרה נשמרה)' : 'הבלוק עודכן', { action: { label: 'ביטול', fn: () => store.undo() } });
    },
  });

  const st = weekStats(s, ws);
  const cats = s.categories.filter((c) => (st.by[c.id]?.planned || 0) > 0 || c.target > 0);
  const stats = h('div.wbars', cats.map((c) => {
    const x = st.by[c.id] || { planned: 0, actual: 0 };
    const target = (c.target || 0) * 60;
    return h('div.wbar', h('div.wbar-top', h('span', h('i', { style: { background: c.color } }), c.name),
      h('small', `בפועל ${hours(x.actual)} · מתוכנן ${hours(x.planned)}${target ? ` · יעד ${c.target}` : ''} ש׳`)),
    h('div.dual-bar', h('div.dual-planned', { style: { width: Math.min(100, target ? (x.planned / target) * 100 : 100) + '%', background: c.color } }),
      h('div.dual-actual', { style: { width: Math.min(100, target ? (x.actual / target) * 100 : x.planned ? (x.actual / x.planned) * 100 : 0) + '%', background: c.color } })));
  }));

  const planned = wp.planned;
  root.replaceChildren(h('div.page.week',
    h('header.cal-head',
      h('div.cal-title', h('h1', 'שבוע'), h('p.muted', weekLabel(ws))),
      h('div.cal-nav',
        iconBtn('right', 'השבוע הקודם', () => go(`#/week/${addDays(ws, -7)}`)),
        btn('השבוע', () => go(`#/week/${weekStart(t)}`), 'ghost sm'),
        iconBtn('left', 'השבוע הבא', () => go(`#/week/${addDays(ws, 7)}`)))),
    h('div.week-tools',
      h('div.pattern', h('span.field-label', 'דפוס העבודה של השבוע הזה'), patternSeg, custom),
      h('div.row.wrap',
        btn('תכנון שבועי חכם', () => openPlanner(ws), planned ? 'ghost' : 'primary', 'wand'),
        btn('סקירה שבועית', () => openWeekReview(ws), 'ghost', 'list'),
        btn('הוספה', () => quickAdd(ws < t && addDays(ws, 6) >= t ? t : ws), 'ghost', 'plus'))),
    !planned && addDays(ws, 6) >= t ? h('div.banner', ic('sparkle', 18), h('span', 'השבוע עוד לא תוכנן. התכנון החכם יחלק את בלוקי העומק לפי מועדי הגשה, מבחנים ויעדים – ותוכלי לאשר כל שינוי.'), btn('תכנון', () => openPlanner(ws), 'primary sm')) : null,
    h('p.muted.small.hint-line', ic('clock', 13), narrow ? ' לחיצה ארוכה על בלוק וגרירה להזזה · משיכת הידית התחתונה לשינוי משך · הקשה על מקום ריק להוספה' : ' גרירה להזזה (גם בין ימים) · משיכת הקצה התחתון לשינוי משך · Alt+חיצים להזזה במקלדת'),
    h('div.grid-scroll', { dataset: { keep: 'week-grid' } }, grid),
    h('section.card', h('div.card-head', h('h2.card-title', 'שעות השבוע – מתוכנן מול בפועל'), h('div.card-actions', btn('ייצוא יום כתמונה', () => openExport(ws <= t && t <= addDays(ws, 6) ? addDays(t, 1) : ws), 'ghost sm', 'image'))), stats),
  ));
}
