// Components shared between views.
import { store } from '../store.js';
import { h, ic, icon, btn, hexA, empty } from '../ui.js';
import { cat, setDone, findOcc, toggleTask, tasksFor, alerts, upcoming, urgency } from '../engine.js';
import { dur, fmtDM, relDay, today, toMin, nowMin } from '../date.js';
import { openOccActions, openTaskEditor, openPlanner, act, go } from '../editors.js';
import { weekStart } from '../date.js';

export function card(title, ...children) {
  let actions = null;
  if (children[0] && children[0].actions) actions = children.shift().actions;
  return h('section.card', title ? h('div.card-head', h('h2.card-title', title), actions ? h('div.card-actions', actions) : null) : null, ...children);
}

export function occRow(s, o, { showDate = false } = {}) {
  const C = cat(s, o.cat);
  const now = o.date === today() && nowMin() >= o.s && nowMin() < o.e;
  return h('div.occ-row' + (o.done ? '.done' : '') + (now ? '.now' : '') + (o.conflicts.length ? '.conflict' : ''), { style: { '--c': C.color } },
    h('button.tick', {
      type: 'button', 'aria-label': o.done ? 'בטל סימון' : 'סמן כבוצע', 'aria-pressed': String(o.done),
      onclick: () => act(o.done ? 'בוטל' : 'בוצע', (st) => setDone(st, findOcc(st, o.key), !o.done)), html: icon('check', 14),
    }),
    h('button.occ-main', { type: 'button', onclick: () => openOccActions(o.key) },
      h('span.occ-time', o.start, h('small', o.end)),
      h('span.occ-bar'),
      h('span.occ-text', h('b', o.title), h('small', [showDate ? relDay(o.date) + ' · ' : '', C.name, ' · ', dur(o.e - o.s), o.actual != null ? ` · בפועל ${dur(o.actual)}` : ''].join(''))),
      o.conflicts.length ? h('span.occ-flag', { html: icon('alert', 15), title: 'חפיפה' }) : null,
      now ? h('span.chip.now-chip', 'עכשיו') : null));
}

export function taskRow(s, item, iso) {
  const { t, done, overdue } = item;
  const C = cat(s, t.cat);
  const subs = t.subtasks || [];
  return h('div.task-row' + (done ? '.done' : ''), { style: { '--c': C.color } },
    h('button.tick.round', {
      type: 'button', 'aria-label': done ? 'בטל סימון' : 'סמן כהושלם', 'aria-pressed': String(done),
      onclick: () => act('משימה עודכנה', (st) => toggleTask(st, st.tasks.find((x) => x.id === t.id), iso)), html: icon('check', 14),
    }),
    h('button.task-main', { type: 'button', onclick: () => openTaskEditor(t.id) },
      h('span.task-title', t.priority === 1 ? h('span.star', '★') : null, t.title),
      h('small', [
        overdue ? h('span.danger-text', 'באיחור · ') : null,
        C.name,
        t.estimate ? ' · ' + dur(t.estimate) : '',
        t.deadline ? ` · דדליין ${fmtDM(t.deadline)}` : '',
        t.rec ? ' · חוזרת' : '',
        subs.length ? ` · ${subs.filter((x) => x.done).length}/${subs.length}` : '',
      ])));
}

export function alertsCard(s, from, days = 7, limit = 4) {
  const list = alerts(s, from, days);
  if (!list.length) return card('התראות חכמות', h('p.ok-line', ic('check', 16), ' הכול נראה מאוזן. אין חפיפות או מועדים בסיכון.'));
  let expanded = false;
  const wrap = h('div.alert-list');
  const render = () => {
    wrap.replaceChildren(...list.slice(0, expanded ? list.length : limit).map((a) => h('div.alert.' + a.level,
      ic(a.icon || 'alert', 16),
      h('span', a.text),
      a.action === 'plan' ? h('button.link-btn', { type: 'button', onclick: () => openPlanner(weekStart(today())) }, 'תכנון') :
        a.href ? h('a.link-btn', { href: a.href }, 'פתיחה') : null)),
    list.length > limit ? h('button.link-btn.more-btn', { type: 'button', onclick: () => { expanded = !expanded; render(); } }, expanded ? 'הצג פחות' : `עוד ${list.length - limit}`) : null);
  };
  render();
  return card('התראות חכמות', wrap);
}

export function deadlineList(s, days = 30, limit = 8) {
  const list = upcoming(s, days).slice(0, limit);
  if (!list.length) return empty('אין מועדים קרובים ב-30 הימים הבאים');
  return h('div.dl-list', list.map((d) => h('a.dl-row.' + urgency(d.daysLeft), { href: d.href || '#/uni', style: { '--c': d.color } },
    h('span.dl-count', d.daysLeft === 0 ? h('b', 'היום') : [h('b', d.daysLeft), h('small', d.daysLeft === 1 ? 'יום' : 'ימים')]),
    h('span.dl-text', h('b', d.title), h('small', `${fmtDM(d.date)}${d.sub ? ' · ' + d.sub : ''}`)))));
}

export function prioritiesEditor(s, iso) {
  const pr = (s.days[iso]?.priorities || ['', '', '']).concat(['', '', '']).slice(0, 3);
  return h('div.prio-list', pr.map((p, i) => h('label.prio', h('span.prio-n', i + 1), h('input.input.bare', {
    value: p, placeholder: ['העדיפות הכי חשובה', 'עדיפות שנייה', 'עדיפות שלישית'][i],
    onchange: (e) => store.commit('עדיפות', (st) => {
      st.days[iso] ||= {};
      const arr = (st.days[iso].priorities || ['', '', '']).slice();
      arr[i] = e.target.value;
      st.days[iso].priorities = arr;
    }, { silent: true, undo: false }),
  }))));
}

export function quickTaskInput(iso) {
  const inp = h('input.input', { placeholder: 'הוספת משימה מהירה…', enterKeyHint: 'done', 'aria-label': 'הוספת משימה מהירה' });
  const add = () => {
    const v = inp.value.trim();
    if (!v) return;
    act('נוספה משימה', (st) => st.tasks.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: v, cat: 'personal', priority: 2, estimate: 30, deadline: null, date: iso, status: 'todo', subtasks: [], rec: null, doneDates: {}, notes: '', goalId: null, courseId: null, createdAt: today() }));
  };
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  return h('div.quick-add', inp, btn('', add, 'primary sm', 'plus', { 'aria-label': 'הוספה' }));
}

export function tasksList(s, iso) {
  const items = tasksFor(s, iso);
  return h('div.task-list', items.length ? items.map((x) => taskRow(s, x, iso)) : h('p.empty-inline', 'אין משימות ליום הזה'), quickTaskInput(iso));
}

export function catLegend(s, ids) {
  return h('div.legend', ids.map((id) => { const c = cat(s, id); return h('span.legend-i', h('i', { style: { background: c.color } }), c.name); }));
}

export function pageHead(title, sub, actions) {
  return h('header.page-head', h('div', h('h1', title), sub ? h('p.muted', sub) : null), actions ? h('div.page-actions', actions) : null);
}

export { go, hexA };
