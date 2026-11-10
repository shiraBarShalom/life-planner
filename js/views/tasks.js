import { store } from '../store.js';
import { h, btn, seg, select, empty } from '../ui.js';
import { taskWhen, isOpen, cat, recLabel } from '../engine.js';
import { today, addDays, weekStart } from '../date.js';
import { pageHead, taskRow } from './common.js';
import { openTaskEditor } from '../editors.js';

let filter = 'open';
let catFilter = '';
let sort = 'smart';

export function render(root) {
  const s = store.s;
  const t = today();
  const we = addDays(weekStart(t), 6);
  const match = (x) => {
    if (catFilter && x.cat !== catFilter) return false;
    const w = taskWhen(x);
    switch (filter) {
      case 'open': return x.rec || x.status !== 'done';
      case 'today': return !x.rec && x.status !== 'done' && w && w <= t;
      case 'week': return !x.rec && x.status !== 'done' && w && w <= we;
      case 'overdue': return !x.rec && x.status !== 'done' && w && w < t;
      case 'nodate': return !x.rec && x.status !== 'done' && !w;
      case 'recurring': return !!x.rec;
      case 'done': return !x.rec && x.status === 'done';
      default: return true;
    }
  };
  const list = s.tasks.filter(match).sort((a, b) => {
    if (sort === 'priority') return (a.priority || 2) - (b.priority || 2);
    if (sort === 'date') return (taskWhen(a) || '9999') < (taskWhen(b) || '9999') ? -1 : 1;
    const ka = `${a.rec ? 1 : 0}${a.priority || 2}${taskWhen(a) || '9999'}`, kb = `${b.rec ? 1 : 0}${b.priority || 2}${taskWhen(b) || '9999'}`;
    return ka < kb ? -1 : 1;
  });
  const rerender = () => render(root);
  const counts = { overdue: s.tasks.filter((x) => !x.rec && x.status !== 'done' && taskWhen(x) && taskWhen(x) < t).length };
  root.replaceChildren(h('div.page.tasks',
    pageHead('משימות', `${s.tasks.filter((x) => !x.rec && x.status !== 'done').length} פתוחות · ${s.tasks.filter((x) => x.rec).length} קבועות${counts.overdue ? ` · ${counts.overdue} באיחור` : ''}`, [btn('משימה חדשה', () => openTaskEditor(), 'primary', 'plus')]),
    h('div.filters',
      h('div.scroll-x', seg([
        { value: 'open', label: 'פתוחות' }, { value: 'today', label: 'היום' }, { value: 'week', label: 'השבוע' }, { value: 'overdue', label: 'באיחור' },
        { value: 'nodate', label: 'ללא תאריך' }, { value: 'recurring', label: 'קבועות' }, { value: 'done', label: 'הושלמו' },
      ], filter, (v) => { filter = v; rerender(); })),
      h('div.row',
        select([{ value: '', label: 'כל הקטגוריות' }, ...s.categories.map((c) => ({ value: c.id, label: c.name }))], catFilter, { 'aria-label': 'קטגוריה', onchange: (e) => { catFilter = e.target.value; rerender(); } }),
        select([{ value: 'smart', label: 'מיון חכם' }, { value: 'priority', label: 'לפי עדיפות' }, { value: 'date', label: 'לפי תאריך' }], sort, { 'aria-label': 'מיון', onchange: (e) => { sort = e.target.value; rerender(); } }))),
    h('section.card', h('div.task-list.big', list.length ? list.map((x) => {
      const row = taskRow(s, { t: x, done: x.rec ? !!x.doneDates?.[t] : x.status === 'done', overdue: !x.rec && x.status !== 'done' && taskWhen(x) && taskWhen(x) < t }, t);
      if (x.rec) row.querySelector('.task-main small')?.append(' · ' + recLabel(x.rec));
      return row;
    }) : empty('אין משימות בתצוגה הזו'))),
  ));
}
