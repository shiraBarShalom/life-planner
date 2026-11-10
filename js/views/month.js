import { store } from '../store.js';
import { h, ic, iconBtn, btn, select } from '../ui.js';
import { occurrences, deadlinesOn, cat, dayType, tasksFor } from '../engine.js';
import { today, monthGrid, monthLabel, MONTHS, DAY_NAMES, DAY_SHORT, hebrewDay, pad } from '../date.js';
import { go, quickAdd } from '../editors.js';
import { catLegend } from './common.js';

const DOT_ORDER = ['work', 'lesson', 'assignment', 'study', 'exam', 'career', 'exercise', 'driving', 'project', 'english', 'confidence', 'home'];

export function render(root, [ym]) {
  const s = store.s;
  const t = today();
  let [y, m] = (ym && /^\d{4}-\d{2}$/.test(ym) ? ym : t.slice(0, 7)).split('-').map(Number);
  const nav = (dm) => { let nm = m + dm, ny = y; if (nm < 1) { nm = 12; ny--; } if (nm > 12) { nm = 1; ny++; } go(`#/month/${ny}-${pad(nm)}`); };
  const days = monthGrid(y, m);
  const prefix = `${y}-${pad(m)}`;

  const monthSel = select(MONTHS.map((n, i) => ({ value: i + 1, label: n })), m, { 'aria-label': 'חודש', onchange: (e) => go(`#/month/${y}-${pad(+e.target.value)}`) });
  const yearSel = select(Array.from({ length: 13 }, (_, i) => ({ value: Number(t.slice(0, 4)) - 2 + i, label: String(Number(t.slice(0, 4)) - 2 + i) })), y, { 'aria-label': 'שנה', onchange: (e) => go(`#/month/${e.target.value}-${pad(m)}`) });
  if (![...yearSel.options].some((o) => +o.value === y)) { yearSel.append(h('option', { value: y }, String(y))); yearSel.value = y; }

  const grid = h('div.month-grid', { role: 'grid', 'aria-label': monthLabel(y, m) },
    DAY_NAMES.map((d, i) => h('div.mg-dow', { role: 'columnheader', 'aria-label': d }, h('span.long', d), h('span.short', DAY_SHORT[i]))),
    days.map((d) => {
      const occs = occurrences(s, d);
      const cats = [...new Set(occs.map((o) => o.cat))];
      const dots = DOT_ORDER.filter((c) => cats.includes(c)).slice(0, 6);
      const dls = deadlinesOn(s, d);
      const doneCount = occs.filter((o) => o.done).length;
      const dt = dayType(s, d);
      const tasks = tasksFor(s, d).filter((x) => !x.rec && !x.overdue);
      const drive = occs.find((o) => o.cat === 'driving');
      const lesson = occs.find((o) => o.cat === 'lesson');
      const lines = [
        ...dls.filter((x) => x.kind !== 'target').map((x) => ({ text: x.title, cls: x.kind + (x.open ? '' : ' closed') })),
        ...dls.filter((x) => x.kind === 'target').map((x) => ({ text: x.title.replace('יעד פנימי: ', '◎ '), cls: 'target' })),
        drive ? { text: `🚗 ${drive.start}`, cls: 'driving' } : null,
        lesson ? { text: lesson.title.split('–')[0].trim(), cls: 'lesson' } : null,
      ].filter(Boolean);
      return h('button.mg-day' + (d.startsWith(prefix) ? '' : '.out') + (d === t ? '.today' : '') + (d < t ? '.past' : '') + `.dt-${dt}`, {
        type: 'button', role: 'gridcell', onclick: () => go(`#/day/${d}`),
        'aria-label': `${d}${dls.length ? ', ' + dls.map((x) => x.title).join(', ') : ''}`,
      },
      h('span.mg-num', Number(d.slice(8))),
      h('span.mg-heb', hebrewDay(d)),
      dls.some((x) => x.kind === 'assignment' && x.open) || dls.some((x) => x.kind === 'exam') ? h('span.mg-flag', { 'aria-hidden': 'true' }) : null,
      h('span.mg-lines', lines.slice(0, 3).map((l) => h('span.mg-line.' + l.cls.split(' ').join('.'), l.text)), lines.length > 3 ? h('span.mg-line.more', `+${lines.length - 3}`) : null),
      h('span.mg-dots', dots.map((c) => h('i', { style: { background: cat(s, c).color } }))),
      tasks.length ? h('span.mg-tasks', `${tasks.length} משימות`) : null,
      occs.length && d <= t ? h('span.mg-done', { style: { '--p': Math.round((doneCount / occs.length) * 100) + '%' } }) : null);
    }));

  root.replaceChildren(h('div.page.month',
    h('header.cal-head',
      h('div.cal-title', h('h1', monthLabel(y, m))),
      h('div.cal-nav',
        iconBtn('right', 'החודש הקודם', () => nav(-1)),
        btn('היום', () => go(`#/month/${t.slice(0, 7)}`), 'ghost sm'),
        iconBtn('left', 'החודש הבא', () => nav(1)),
        monthSel, yearSel,
        btn('הוספה', () => quickAdd(t), 'primary sm', 'plus'))),
    grid,
    catLegend(s, DOT_ORDER.slice(0, 10)),
    h('p.muted.small.center', ic('flag', 13), ' סימון אדום = הגשה/מבחן · ◎ = יעד פנימי · לחיצה על יום פותחת את התוכנית השעתית שלו'),
  ));

  // swipe between months
  let x0 = null;
  grid.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  grid.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 70) nav(dx > 0 ? 1 : -1); // RTL: swipe right → next
  }, { passive: true });
}
