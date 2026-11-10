import { store } from '../store.js';
import { h, ic, btn, ring, bar, hexA } from '../ui.js';
import { occurrences, dayProgress, weekStats, cat, goalProgress, dayType, range7, sleepMinutes } from '../engine.js';
import { today, tomorrow, fmtLong, hebrewDate, nowMin, greeting, weekStart, diffDays, addDays, dur, hours, fmtDM, weekday } from '../date.js';
import { quoteFor, challengeFor } from '../quotes.js';
import { DAY_TYPES } from '../seed.js';
import { card, occRow, alertsCard, deadlineList, prioritiesEditor, tasksList } from './common.js';
import { openExport, act, go } from '../editors.js';

let quoteOffset = 0;

export function render(root) {
  const s = store.s;
  const t = today();
  const nm = nowMin();
  const occs = occurrences(s, t);
  const prog = dayProgress(s, t);
  const nowO = occs.find((o) => nm >= o.s && nm < o.e);
  const nextO = occs.find((o) => o.s > nm);

  const quoteText = h('p.quote-text', quoteFor(s.settings, t, quoteOffset));
  const hero = h('section.hero',
    h('div.hero-top',
      h('div', h('p.hero-greet', `${greeting(nm)}${s.settings.name ? ', ' + s.settings.name : ''}`), h('h1.hero-date', fmtLong(t)),
        h('p.muted', [hebrewDate(t), DAY_TYPES[dayType(s, t)]].filter(Boolean).join(' · '))),
      ring(prog.pct, 74, 7)),
    h('button.quote', { type: 'button', 'aria-label': 'משפט השראה – לחצי למשפט אחר', onclick: () => { quoteOffset++; quoteText.textContent = quoteFor(s.settings, t, quoteOffset); } },
      h('span.quote-mark', '”'), quoteText),
  );

  const exportCta = h('div.cta-row',
    h('button.cta', { type: 'button', onclick: () => openExport(tomorrow()) },
      ic('image', 26), h('span', h('b', 'הורדת הלוח של מחר'), h('small', 'לשמירה בתמונות ולשליחה בוואטסאפ'))),
    h('button.cta.secondary', { type: 'button', onclick: () => openExport(t) }, ic('download', 20), h('b', 'הלוח של היום')));

  const nowCard = h('section.card.now-card',
    nowO ? h('div.now-block', { style: { '--c': cat(s, nowO.cat).color } }, h('small', 'עכשיו'), h('b', nowO.title), h('span.muted', `עד ${nowO.end} · נשארו ${dur(nowO.e - nm)}`)) :
      h('div.now-block', h('small', 'עכשיו'), h('b', nm >= 21 * 60 || nm < 4 * 60 + 30 ? 'זמן שינה 🌙' : 'זמן פנוי'), h('span.muted', 'נשימה, מים, מנוחה')),
    nextO ? h('div.now-block.next', { style: { '--c': cat(s, nextO.cat).color } }, h('small', `הבא · ${nextO.start}`), h('b', nextO.title), h('span.muted', `בעוד ${dur(nextO.s - nm)}`)) : null,
    h('div.now-progress', h('span', `${prog.done} מתוך ${prog.total} בוצעו היום`), bar(prog.pct)));

  // countdowns
  const cds = [];
  for (const e of s.exams) if (e.date >= t) cds.push({ title: e.title, date: e.date, color: cat(s, 'exam').color, icon: 'target', href: '#/uni' });
  const goalsJan = s.goals.filter((g) => !g.longTerm && g.deadline && g.deadline >= t);
  const byDate = {};
  for (const g of goalsJan) (byDate[g.deadline] ||= []).push(g);
  for (const [d, gs] of Object.entries(byDate)) cds.push({ title: gs.length > 1 ? `${gs.length} חלומות: ${gs.map((g) => g.title.split(' ')[0]).join(', ')}` : gs[0].title, date: d, color: gs[0].color, icon: 'sparkle', href: gs.length > 1 ? '#/goals' : `#/goal/${gs[0].id}` });
  const drive = s.blocks.filter((b) => b.cat === 'driving' && b.date >= t && !b.done).sort((a, b) => (a.date < b.date ? -1 : 1))[0];
  if (drive) cds.push({ title: `שיעור נהיגה · ${drive.start}`, date: drive.date, color: cat(s, 'driving').color, icon: 'car', href: `#/day/${drive.date}` });
  cds.sort((a, b) => (a.date < b.date ? -1 : 1));
  const countdowns = h('div.countdowns', cds.slice(0, 8).map((c) => {
    const n = diffDays(t, c.date);
    return h('a.cd', { href: c.href, style: { '--c': c.color } }, ic(c.icon, 18), h('b.cd-n', n === 0 ? 'היום' : n), n ? h('small', n === 1 ? 'יום' : 'ימים') : null, h('span.cd-t', c.title), h('small.muted', fmtDM(c.date)));
  }));

  // habits
  const log = s.habitLog[t] || {};
  const ws = weekStart(t);
  const habits = h('div.habits', s.habits.map((hb) => {
    let streak = 0;
    for (let d = log[hb.id] ? t : addDays(t, -1); s.habitLog[d]?.[hb.id]; d = addDays(d, -1)) streak++;
    const week = range7(ws).map((d) => h('i' + (s.habitLog[d]?.[hb.id] ? '.on' : '') + (d === t ? '.today' : '')));
    return h('button.habit' + (log[hb.id] ? '.on' : ''), {
      type: 'button', 'aria-pressed': String(!!log[hb.id]),
      onclick: () => act('הרגל', (st) => {
        st.habitLog[t] ||= {};
        if (st.habitLog[t][hb.id]) delete st.habitLog[t][hb.id]; else st.habitLog[t][hb.id] = true;
      }, { undo: false }),
    }, ic(hb.icon, 18), h('span.habit-n', hb.name), h('span.habit-week', week), streak > 1 ? h('small.streak', `🔥 ${streak}`) : null);
  }));

  // weekly progress by category
  const st = weekStats(s, ws);
  const cats = s.categories.filter((c) => c.target > 0 || ['study', 'career', 'english', 'project', 'exam'].includes(c.id)).filter((c) => !['work'].includes(c.id));
  const weekBars = h('div.wbars', cats.map((c) => {
    const x = st.by[c.id] || { planned: 0, actual: 0 };
    const target = (c.target || 0) * 60;
    const pct = target ? (x.actual / target) * 100 : x.planned ? (x.actual / x.planned) * 100 : 0;
    return h('div.wbar', h('div.wbar-top', h('span', h('i', { style: { background: c.color } }), c.name), h('small', `${hours(x.actual)} / ${hours(x.planned)} ש׳${target ? ` · יעד ${c.target}` : ''}`)), bar(pct, c.color));
  }));

  const goals = s.goals.filter((g) => !g.longTerm).sort((a, b) => a.priority - b.priority).slice(0, 8);
  const goalsRow = h('div.goal-mini-row', goals.map((g) => h('a.goal-mini', { href: `#/goal/${g.id}`, style: { '--c': g.color } }, ring(goalProgress(g), 52, 5, g.color), h('span', g.title))));

  const sleep = sleepMinutes(s.settings);
  root.replaceChildren(h('div.page.dashboard',
    hero,
    !s.courses.length && !s.settings.welcomeDismissed ? h('div.banner', ic('upload', 18),
      h('span', 'ברוכה הבאה! יש לך קובץ גיבוי עם הנתונים שלך? אפשר לייבא אותו בהגדרות ← "ייבוא גיבוי".'),
      h('a.btn.primary.sm', { href: '#/settings' }, 'להגדרות'),
      h('button.icon-btn.ghost.sm', { type: 'button', 'aria-label': 'סגירה', onclick: () => act('הודעה', (x) => { x.settings.welcomeDismissed = true; }) }, ic('x', 16))) : null,
    exportCta,
    h('div.grid-2', nowCard, card('אתגר הביטחון של היום', h('p.challenge', ic('heart', 18), h('span', challengeFor(t))), h('p.muted.small', 'קטן, אמיץ, אפשרי. סמני "אתגר ביטחון" בהרגלים כשסיימת.'))),
    alertsCard(s, t, 7),
    h('div.grid-2',
      card('סדר היום', { actions: [h('a.link-btn', { href: `#/day/${t}` }, 'ליומן המלא')] },
        h('div.occ-list', occs.length ? occs.map((o) => occRow(s, o)) : h('p.empty-inline', 'אין בלוקים היום'))),
      h('div.stack',
        card('העדיפויות של היום', prioritiesEditor(s, t)),
        card('משימות היום', tasksList(s, t)))),
    card('ספירה לאחור', countdowns),
    h('div.grid-2',
      card('מועדים קרובים', { actions: [h('a.link-btn', { href: '#/uni' }, 'אוניברסיטה')] }, deadlineList(s, 30, 7)),
      card('הרגלים', { actions: [h('small.muted', `שינה מתוכננת: ${dur(sleep)}`)] }, habits)),
    card('התקדמות שבועית · מתוכנן מול בפועל', { actions: [h('a.link-btn', { href: `#/week/${ws}` }, 'לשבוע')] }, weekBars),
    card('החלומות שלי', { actions: [h('a.link-btn', { href: '#/goals' }, 'הכול')] }, goalsRow),
  ));
}
