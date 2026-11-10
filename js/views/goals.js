import { store, uid } from '../store.js';
import { h, ic, icon, btn, ring, bar, check, empty, input } from '../ui.js';
import { goalProgress, goalWeek, cat, upcoming } from '../engine.js';
import { today, diffDays, fmtDM, weekStart, dur, hours, fmtDayShort } from '../date.js';
import { card, pageHead, occRow } from './common.js';
import { act, go, openGoalEditor, openBlockEditor, openTaskEditor, quickAdd } from '../editors.js';

export function render(root) {
  const s = store.s;
  const t = today();
  const ws = weekStart(t);
  const main = s.goals.filter((g) => !g.longTerm).sort((a, b) => a.priority - b.priority);
  const dreams = s.goals.filter((g) => g.longTerm);
  root.replaceChildren(h('div.page.goals',
    pageHead('חלומות ומטרות', 'מטרה ברורה · תאריך יעד · צעדים · עדיפות · פעולה יומית', [btn('מטרה חדשה', () => openGoalEditor(), 'primary', 'plus')]),
    h('div.goal-grid', main.map((g) => {
      const p = goalProgress(g);
      const w = goalWeek(s, g, ws);
      const n = g.deadline ? diffDays(t, g.deadline) : null;
      const next = (g.steps || []).find((x) => !x.done);
      return h('a.goal-card', { href: `#/goal/${g.id}`, style: { '--c': g.color } },
        h('div.goal-card-top', h('span.goal-ic', { html: icon(g.icon, 22) }), ring(p, 58, 5, g.color)),
        h('h3', g.title),
        h('p.muted.small.clamp2', g.outcome),
        next ? h('p.small.next-step', ic('arrow', 13), ' ' + next.title) : null,
        h('div.goal-card-foot',
          n != null ? h('span.chip' + (n < 30 ? '.warn' : ''), n >= 0 ? `${n} ימים` : 'עבר') : h('span.chip.soft', 'מתמשך'),
          w.planned ? h('span.chip.soft', `${hours(w.done)}/${hours(w.planned)} ש׳ השבוע`) : null,
          h('span.chip.soft', ['', 'עדיפות עליונה', 'עדיפות גבוהה', 'רגילה'][g.priority])));
    })),
    h('h2.section-title', 'חלומות ארוכי טווח'),
    h('p.muted.small', 'חלומות שחשוב לזכור, בלי לדחוס אותם ליומן היומי.'),
    h('div.dream-row', dreams.map((g) => h('a.dream', { href: `#/goal/${g.id}`, style: { '--c': g.color } }, ic(g.icon, 18), h('span', g.title)))),
  ));
}

export function renderGoal(root, [id]) {
  const s = store.s;
  const g = s.goals.find((x) => x.id === id);
  if (!g) { root.replaceChildren(empty('המטרה לא נמצאה')); return; }
  const t = today();
  const ws = weekStart(t);
  const p = goalProgress(g);
  const w = goalWeek(s, g, ws);
  const n = g.deadline ? diffDays(t, g.deadline) : null;
  const upd = (label, fn) => act(label, (st) => fn(st.goals.find((x) => x.id === id)));

  const listEditor = (key, label, withDate) => {
    const items = g[key] || [];
    const newIn = input('text', '', { placeholder: `${label} חדש…`, enterKeyHint: 'done' });
    const newDate = withDate ? input('date', '') : null;
    const add = () => {
      if (!newIn.value.trim()) return;
      upd('נוסף', (x) => { (x[key] ||= []).push({ id: uid(), title: newIn.value.trim(), done: false, ...(withDate ? { date: newDate.value || null } : {}) }); });
    };
    newIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    return h('div.step-list',
      items.map((it, i) => h('div.step' + (it.done ? '.done' : ''),
        check('', it.done, (v) => upd(v ? 'כל הכבוד ✓' : 'עודכן', (x) => { x[key][i].done = v; })),
        h('input.input.bare', { value: it.title, 'aria-label': label, onchange: (e) => upd('עודכן', (x) => { x[key][i].title = e.target.value; }) }),
        withDate ? h('input.input.sm.date-sm', { type: 'date', value: it.date || '', 'aria-label': 'תאריך', onchange: (e) => upd('עודכן', (x) => { x[key][i].date = e.target.value || null; }) }) : null,
        h('div.step-tools',
          i > 0 ? h('button.icon-btn.ghost.sm', { type: 'button', 'aria-label': 'למעלה', html: icon('up', 16), onclick: () => upd('סודר', (x) => { const a = x[key]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; }) }) : null,
          h('button.icon-btn.ghost.sm', { type: 'button', 'aria-label': 'מחיקה', html: icon('x', 16), onclick: () => act('נמחק', (st) => { st.goals.find((x) => x.id === id)[key].splice(i, 1); }, { undoToast: true }) })))),
      h('div.quick-add', newIn, newDate, btn('', add, 'primary sm', 'plus', { 'aria-label': 'הוספה' })));
  };

  let driving = null;
  if (g.tracker === 'driving') {
    const lessons = s.blocks.filter((b) => b.cat === 'driving').sort((a, b) => (a.date < b.date ? -1 : 1));
    const cost = lessons.reduce((m, b) => m + (Number(b.meta?.cost) || 0), 0);
    driving = card('מעקב נהיגה', { actions: [btn('שיעור חדש', () => quickAdd(t), 'ghost sm', 'plus')] },
      h('div.stat-row',
        h('div.stat', h('b', g.lessonsDone || 0), h('small', 'שיעורים שבוצעו')),
        h('div.stat', h('b', lessons.filter((b) => b.date >= t && !b.done).length), h('small', 'מתוכננים')),
        h('div.stat', h('b', cost ? `₪${cost}` : '—'), h('small', 'עלות שהוזנה'))),
      h('div.row.wrap',
        h('label.field.inline', h('span.field-label', 'שיעורים שבוצעו'), h('input.input.sm', { type: 'number', min: 0, value: g.lessonsDone || 0, onchange: (e) => upd('עודכן', (x) => { x.lessonsDone = Number(e.target.value) || 0; }) })),
        h('label.field.inline', h('span.field-label', 'תאריך טסט'), h('input.input.sm', { type: 'date', value: g.testDate || '', onchange: (e) => upd('עודכן', (x) => { x.testDate = e.target.value || null; }) }))),
      h('div.lesson-list', lessons.length ? lessons.map((b) => h('a.lesson' + (b.done ? '.done' : ''), { href: `#/day/${b.date}` },
        h('b', fmtDayShort(b.date)), h('span', `${b.start}–${b.end}`), h('span', b.meta?.lessonNo ? `שיעור ${b.meta.lessonNo}` : ''), h('span.muted', b.meta?.cost ? `₪${b.meta.cost}` : ''), b.done ? ic('check', 15) : null)) : h('p.empty-inline', 'אין שיעורים ביומן')));
  }

  const ms = upcoming(s, 400).filter((x) => x.kind === 'milestone' && x.sub === g.title).slice(0, 3);
  root.replaceChildren(h('div.page.goal', { style: { '--c': g.color } },
    h('a.back', { href: '#/goals' }, ic('right', 16), 'כל המטרות'),
    h('section.goal-hero',
      h('div', h('span.goal-ic.big', { html: icon(g.icon, 28) }),
        h('h1', g.title),
        g.outcome ? h('p.goal-outcome', g.outcome) : null,
        g.why ? h('p.muted', ic('heart', 14), ' ' + g.why) : null,
        h('div.row.wrap',
          g.deadline ? h('span.chip' + (n != null && n < 30 ? '.warn' : ''), ic('calendar', 14), `${fmtDM(g.deadline)} · ${n >= 0 ? `עוד ${n} ימים` : 'התאריך עבר'}`) : h('span.chip.soft', 'ללא תאריך יעד'),
          h('span.chip.soft', ['', 'עדיפות עליונה', 'עדיפות גבוהה', 'עדיפות רגילה'][g.priority]))),
      h('div.goal-hero-ring', ring(p, 110, 10, g.color), h('small.muted', g.progressMode === 'manual' ? 'התקדמות ידנית' : 'לפי צעדים ואבני דרך'))),
    h('div.row.wrap',
      btn('עריכת מטרה', () => openGoalEditor(g.id), 'ghost', 'edit'),
      !g.longTerm ? btn('סשן חדש ביומן', () => openBlockEditor({ date: t, catId: g.cats?.[0] || 'personal', preset: { title: g.title, cat: g.cats?.[0] || 'personal', goalId: g.id } }), 'ghost', 'calendar') : null,
      btn('משימה למטרה', () => openTaskEditor(null, { goalId: g.id, cat: g.cats?.[0] || 'personal' }), 'ghost', 'tasks')),
    h('div.grid-2',
      card('צעדי פעולה (לפי סדר עדיפות)', listEditor('steps', 'צעד', false)),
      card('אבני דרך', listEditor('milestones', 'אבן דרך', true), ms.length ? h('p.muted.small', 'הבאה: ' + ms[0].title + ' · ' + fmtDM(ms[0].date)) : null)),
    driving,
    !g.longTerm ? card(`השבוע: ${hours(w.done)} מתוך ${hours(w.planned)} שעות`, bar(w.planned ? (w.done / w.planned) * 100 : 0, g.color),
      h('div.occ-list', w.sessions.filter((o) => o.date >= t).slice(0, 12).map((o) => occRow(s, o, { showDate: true })), w.sessions.length ? null : h('p.empty-inline', 'אין סשנים מקושרים השבוע. אפשר להוסיף "סשן חדש ביומן".'))) : null,
    s.tasks.some((x) => x.goalId === g.id) ? card('משימות מקושרות', h('div.task-list', s.tasks.filter((x) => x.goalId === g.id && !x.rec).map((x) => h('button.task-main.lined' + (x.status === 'done' ? '.done' : ''), { type: 'button', onclick: () => openTaskEditor(x.id) },
      h('span.task-title', x.status === 'done' ? '✓ ' : '', x.title), h('small', [x.deadline ? 'דדליין ' + fmtDM(x.deadline) : '', x.estimate ? ' · ' + dur(x.estimate) : ''].join('')))))) : null,
    g.notes ? card('הערות', h('p', g.notes)) : null,
  ));
}
