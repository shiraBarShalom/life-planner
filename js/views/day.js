import { store } from '../store.js';
import { h, ic, iconBtn, btn, ring, textarea, toast } from '../ui.js';
import { occurrences, dayProgress, dayType, findOcc, updateOcc, moveOcc, alerts, deadlinesOn, freeMinutes, cat } from '../engine.js';
import { today, addDays, fmtLong, hebrewDate, isISO, relDay, fromMin, dur, weekStart, diffDays } from '../date.js';
import { DAY_TYPES } from '../seed.js';
import { timeGrid } from '../timegrid.js';
import { card, tasksList, prioritiesEditor, occRow } from './common.js';
import { go, act, openOccActions, openBlockEditor, openExport, openReschedule, openWorkLate, quickAdd } from '../editors.js';

let viewMode = 'timeline';

export function render(root, [arg]) {
  const s = store.s;
  const t = today();
  const iso = isISO(arg) ? arg : t;
  const occs = occurrences(s, iso);
  const prog = dayProgress(s, iso);
  const dt = dayType(s, iso);
  const dls = deadlinesOn(s, iso);
  const al = alerts(s, iso, 1).filter((a) => !a.href || a.href.includes(iso));
  const est = occs.reduce((m, o) => m + (o.e - o.s), 0);
  const act_ = occs.filter((o) => o.done).reduce((m, o) => m + (o.actual ?? o.e - o.s), 0);
  const estDone = occs.filter((o) => o.done).reduce((m, o) => m + (o.e - o.s), 0);
  const hasWork = occs.some((o) => o.cat === 'work');

  const grid = timeGrid(s, [iso], {
    ppm: 1.35, showHead: false,
    onTap: (key) => openOccActions(key),
    onEmpty: (date, m) => openBlockEditor({ date, start: fromMin(m), end: fromMin(m + 60) }),
    onChange: (key, date, sm, em) => {
      const o = findOcc(store.s, key);
      act('הבלוק עודכן', (st) => updateOcc(st, findOcc(st, key), { start: fromMin(sm), end: fromMin(em) }, 'this'));
      toast(o?.src === 'series' ? 'עודכן רק המופע הזה' : 'הבלוק עודכן', { action: { label: 'ביטול', fn: () => store.undo() } });
    },
  });

  const dayData = s.days[iso] || {};
  const notes = textarea(dayData.notes || '', { rows: 4, placeholder: 'מחשבות, דברים לזכור, מה למדתי היום…' });
  notes.addEventListener('change', () => store.commit('הערות', (st) => { (st.days[iso] ||= {}).notes = notes.value; }, { silent: true, undo: false }));
  const refl = textarea(dayData.reflection || '', { rows: 3, placeholder: 'מה עשיתי היום שדרש אומץ? על מה אני גאה?' });
  refl.addEventListener('change', () => store.commit('רפלקציה', (st) => { (st.days[iso] ||= {}).reflection = refl.value; }, { silent: true, undo: false }));

  const modeBtns = h('div.seg.small',
    h('button.seg-btn' + (viewMode === 'timeline' ? '.on' : ''), { type: 'button', onclick: () => { viewMode = 'timeline'; render(root, [iso]); } }, 'ציר זמן'),
    h('button.seg-btn' + (viewMode === 'list' ? '.on' : ''), { type: 'button', onclick: () => { viewMode = 'list'; render(root, [iso]); } }, 'רשימה'));

  root.replaceChildren(h('div.page.day',
    h('header.cal-head',
      h('div.cal-title', h('h1', fmtLong(iso)), h('p.muted', [relDay(iso), hebrewDate(iso), DAY_TYPES[dt]].filter(Boolean).join(' · '))),
      h('div.cal-nav',
        iconBtn('right', 'היום הקודם', () => go(`#/day/${addDays(iso, -1)}`)),
        btn('היום', () => go(`#/day/${t}`), 'ghost sm'),
        iconBtn('left', 'היום הבא', () => go(`#/day/${addDays(iso, 1)}`)),
        h('input.input.sm', { type: 'date', value: iso, 'aria-label': 'מעבר לתאריך', onchange: (e) => e.target.value && go(`#/day/${e.target.value}`) }))),
    h('div.day-actions',
      btn('הוספה', () => quickAdd(iso), 'primary', 'plus'),
      btn(iso === addDays(t, 1) ? 'הורדת הלוח של מחר' : 'ייצוא היום כתמונה', () => openExport(iso), 'ghost', 'image'),
      btn('העברת לא-גמורים', () => openReschedule(iso), 'ghost', 'arrow'),
      hasWork && iso >= t ? btn('העבודה התארכה', () => openWorkLate(iso), 'ghost', 'clock') : null,
      h('a.btn.ghost', { href: `#/week/${weekStart(iso)}` }, ic('week', 18), h('span', 'לשבוע'))),
    dls.length ? h('div.dl-banner', dls.map((d) => h('span.chip.' + (d.kind === 'target' ? 'soft' : 'danger'), ic(d.kind === 'exam' ? 'target' : 'flag', 14), d.title + (d.kind === 'assignment' ? ' · עד 23:59' : '')))) : null,
    al.length ? h('div.alert-list', al.slice(0, 4).map((a) => h('div.alert.' + a.level, ic(a.icon || 'alert', 16), h('span', a.text)))) : null,
    h('div.day-layout',
      h('section.card.timeline-card',
        h('div.card-head', h('h2.card-title', 'לוח הזמנים'), h('div.card-actions', modeBtns)),
        viewMode === 'timeline' ? h('div.day-grid', grid) : h('div.occ-list', occs.length ? occs.map((o) => occRow(s, o)) : h('p.empty-inline', 'אין בלוקים')),
        h('p.muted.small', ic('clock', 13), ' לחיצה ארוכה וגרירה להזזה · הידית התחתונה משנה משך · הקשה על בלוק לסימון ועריכה')),
      h('div.stack',
        h('section.card.day-progress',
          ring(prog.pct, 84, 8),
          h('div', h('b', `${prog.done} / ${prog.total} הושלמו`),
            h('p.muted.small', `מתוכנן ${dur(est)} · בוצע ${dur(act_)}${estDone ? ` (הערכה ${dur(estDone)})` : ''}`),
            h('p.muted.small', `זמן פנוי ביומן: ${dur(freeMinutes(s, iso))}`))),
        card('3 העדיפויות', prioritiesEditor(s, iso)),
        card('משימות', tasksList(s, iso)),
        card('הערות', notes),
        card('רפלקציה וביטחון', refl))),
  ));
}
