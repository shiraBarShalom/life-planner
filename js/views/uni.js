import { store } from '../store.js';
import { h, ic, btn, bar, select, ring, empty } from '../ui.js';
import { effDue, isOpen, internalTarget, STATUS, urgency, plannedForAssignment, remainingMin, range7, occurrences, cat } from '../engine.js';
import { today, diffDays, fmtDM, weekStart, dur, hours, weekday, DAY_NAMES, relDay, addDays } from '../date.js';
import { card, pageHead } from './common.js';
import { act, openAssignmentEditor, openCourseEditor, openExamEditor, openBlockEditor, openPlanner } from '../editors.js';

export function render(root) {
  const s = store.s;
  const t = today();
  const ws = weekStart(t);

  const courseCards = s.courses.map((c) => {
    const as = s.assignments.filter((a) => a.courseId === c.id).sort((a, b) => (effDue(a) < effDue(b) ? -1 : 1));
    const next = as.find((a) => isOpen(a) && effDue(a) >= t);
    const sub = as.filter((a) => a.status === 'submitted').length;
    let planned = 0, done = 0;
    for (const d of range7(ws)) for (const o of occurrences(s, d)) if (o.courseId === c.id) { planned += o.e - o.s; if (o.done) done += o.actual ?? o.e - o.s; }
    const lessons = [];
    for (let i = 0; i < 21; i++) { const d = addDays(t, i); for (const o of occurrences(s, d)) if (o.courseId === c.id && o.cat === 'lesson') lessons.push(o); }
    const lp = c.lectures.total ? (c.lectures.watched / c.lectures.total) * 100 : 0;
    const graded = as.filter((a) => a.grade != null);
    const avg = graded.length ? Math.round(graded.reduce((m, a) => m + a.grade, 0) / graded.length) : null;
    return h('section.card.course', { style: { '--c': c.color } },
      h('div.card-head', h('h2.card-title', h('i.course-dot'), c.name), h('div.card-actions', btn('', () => openCourseEditor(c.id), 'ghost sm', 'edit', { 'aria-label': 'עריכת קורס' }))),
      h('div.stat-row',
        h('div.stat', h('b', c.targetGrade ?? '—'), h('small', 'ציון יעד')),
        h('div.stat', h('b', c.grade ?? avg ?? '—'), h('small', c.grade != null ? 'ציון סופי' : 'ממוצע ממ"נים')),
        h('div.stat', h('b', `${sub}/${as.length}`), h('small', 'מטלות הוגשו')),
        h('div.stat', h('b', `${hours(done)}/${hours(planned)}`), h('small', 'ש׳ השבוע'))),
      h('div.lect',
        h('div.wbar-top', h('span', 'הרצאות שהושלמו'), h('small', `${c.lectures.watched} / ${c.lectures.total}`)),
        bar(lp, c.color),
        h('div.row',
          btn('−', () => act('הרצאות', (st) => { const x = st.courses.find((y) => y.id === c.id); x.lectures.watched = Math.max(0, x.lectures.watched - 1); }), 'ghost sm', null, { 'aria-label': 'הפחתת הרצאה' }),
          btn('+ הרצאה הושלמה', () => act('הרצאה הושלמה ✓', (st) => { const x = st.courses.find((y) => y.id === c.id); x.lectures.watched = Math.min(x.lectures.total || 999, x.lectures.watched + 1); }), 'ghost sm'))),
      next ? h('p.next-dl.' + urgency(diffDays(t, effDue(next))), ic('flag', 14), ` הבא: ${next.title} · ${fmtDM(effDue(next))} (${relDay(effDue(next))}) · יעד פנימי ${fmtDM(internalTarget(next))}`) : h('p.muted.small', 'אין מטלות פתוחות'),
      lessons.length ? h('p.small', ic('school', 14), ' מפגשים קרובים: ' + lessons.slice(0, 3).map((o) => `${DAY_NAMES[weekday(o.date)]} ${fmtDM(o.date)} ${o.start}`).join(' · ')) : null,
      c.examDate ? h('p.small', ic('target', 14), ` בחינה: ${fmtDM(c.examDate)} (${relDay(c.examDate)})`) : null,
      c.notes ? h('p.muted.small', c.notes) : null,
      h('div.row.wrap',
        btn('סשן לימוד', () => openBlockEditor({ date: t, preset: { title: `${c.short} · `, cat: 'study', courseId: c.id, goalId: 'g-academic' } }), 'ghost sm', 'plus'),
        btn('מפגש / שיעור', () => openBlockEditor({ date: t, start: '09:00', end: '12:00', preset: { title: `${c.short} – שיעור זום`, cat: 'lesson', courseId: c.id } }), 'ghost sm', 'school'),
        btn('מטלה', () => openAssignmentEditor(null, c.id), 'ghost sm', 'flag')));
  });

  const rows = [...s.assignments].sort((a, b) => (effDue(a) < effDue(b) ? -1 : 1));
  const table = h('div.asg-list', rows.map((a) => {
    const c = s.courses.find((x) => x.id === a.courseId);
    const due = effDue(a);
    const dl = diffDays(t, due);
    const open = isOpen(a);
    const planned = open && dl >= 0 && dl <= 30 ? plannedForAssignment(s, a) : 0;
    const need = remainingMin(a);
    const risk = open && dl >= 0 && dl <= 14 && planned + 30 < need;
    const shabbat = weekday(due) === 6;
    const statusSel = select(Object.entries(STATUS).map(([value, label]) => ({ value, label })), a.status, {
      'aria-label': 'סטטוס',
      onchange: (e) => {
        const v = e.target.value;
        if (v === 'extended' && !a.extendedTo) { openAssignmentEditor(a.id); e.target.value = a.status; return; }
        act('הסטטוס עודכן', (st) => { st.assignments.find((x) => x.id === a.id).status = v; });
      },
    });
    return h('div.asg' + (open ? '' : '.closed') + '.' + (open ? urgency(dl) : 'ok'), { style: { '--c': c?.color || '#ccc' } },
      h('div.asg-main', { role: 'button', tabIndex: 0, onclick: (e) => { if (!e.target.closest('select')) openAssignmentEditor(a.id); }, onkeydown: (e) => { if (e.key === 'Enter') openAssignmentEditor(a.id); } },
        h('span.asg-count', open ? (dl < 0 ? '!' : dl === 0 ? 'היום' : dl) : '✓', open && dl > 0 ? h('small', 'ימים') : null),
        h('div.asg-text',
          h('b', `${c?.short || ''} · ${a.title}`),
          h('small', `הגשה ${DAY_NAMES[weekday(due)]} ${fmtDM(due)} 23:59${a.extendedTo ? ' (הארכה)' : ''} · יעד פנימי ${fmtDM(internalTarget(a))}`),
          h('small.muted', [
            `הערכה ${a.estimateH} ש׳`, a.loggedMin ? `הושקעו ${dur(a.loggedMin)}` : '', open && dl >= 0 && dl <= 30 ? `מתוכננות ${dur(planned)}` : '',
            a.grade != null ? `ציון ${a.grade}` : '', shabbat && open ? 'חל בשבת' : '',
          ].filter(Boolean).join(' · ')),
          risk ? h('small.danger-text', ic('alert', 12), ' בסיכון – אין מספיק זמן מתוכנן') : null,
          a.status === 'skipped' ? h('small.warn-text', ic('alert', 12), ' דילוג עלול להשפיע על הציון – בדקי את תנאי הקורס') : null)),
      statusSel);
  }));

  const examList = s.exams.length ? h('div.dl-list', [...s.exams].sort((a, b) => (a.date < b.date ? -1 : 1)).map((e) => {
    const n = diffDays(t, e.date);
    return h('button.dl-row.' + urgency(n), { type: 'button', onclick: () => openExamEditor(e.id), style: { '--c': cat(s, 'exam').color } },
      h('span.dl-count', n < 0 ? h('b', '✓') : [h('b', n), h('small', 'ימים')]),
      h('span.dl-text', h('b', e.title), h('small', `${DAY_NAMES[weekday(e.date)]} ${fmtDM(e.date)}${e.time ? ' · ' + e.time : ''}${e.notes ? ' · ' + e.notes : ''}`)));
  })) : empty('אין מבחנים');

  const gpa = s.settings.gpa ?? 0;
  root.replaceChildren(h('div.page.uni',
    pageHead('אוניברסיטה', 'B.Sc. מדעי המחשב · האוניברסיטה הפתוחה', [
      btn('תכנון שבועי', () => openPlanner(ws), 'ghost', 'wand'),
      btn('קורס', () => openCourseEditor(), 'ghost', 'plus'),
      btn('מטלה', () => openAssignmentEditor(), 'primary', 'plus'),
    ]),
    h('section.card.gpa-card',
      ring(Math.min(100, gpa), 80, 7),
      h('div', h('b', 'ממוצע נוכחי'), h('p.muted.small', 'החלום: מצטיינת נשיא · יעד 95+ בכל קורס'),
        h('label.field.inline', h('span.field-label', 'ממוצע'), h('input.input.sm', { type: 'number', min: 0, max: 100, step: 0.1, value: gpa, onchange: (e) => act('ממוצע', (st) => { st.settings.gpa = Number(e.target.value) || 0; }) }))),
      h('p.muted.small', 'קודם להבין לעומק, ואז לפתור מטלה בבלוק ארוך ורציף. הרצאה אינה מחליפה תרגול עצמאי.')),
    h('div.course-grid', courseCards),
    card('מטלות ומועדי הגשה', { actions: [btn('מטלה', () => openAssignmentEditor(), 'ghost sm', 'plus')] }, h('p.muted.small', 'השיוך לקורסים לפי צילומי המסך – ניתן לתקן בלחיצה על מטלה.'), table),
    card('מבחנים', { actions: [btn('מבחן', () => openExamEditor(), 'ghost sm', 'plus')] }, examList),
  ));
}
