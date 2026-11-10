import { store } from './store.js';
import { h, ic, icon, toast, closeAllSheets } from './ui.js';
import { planWeek, applyPlan, weekPlanFor } from './engine.js';
import { today, weekStart, addDays, tomorrow } from './date.js';
import { applyTheme } from './theme.js';
import { openExport, quickAdd } from './editors.js';
import * as dashboard from './views/dashboard.js';
import * as month from './views/month.js';
import * as week from './views/week.js';
import * as day from './views/day.js';
import * as goals from './views/goals.js';
import * as uni from './views/uni.js';
import * as tasks from './views/tasks.js';
import * as settings from './views/settings.js';

const ROUTES = {
  home: { view: dashboard.render, title: 'בית' },
  day: { view: day.render, title: 'יום' },
  week: { view: week.render, title: 'שבוע' },
  month: { view: month.render, title: 'חודש' },
  goals: { view: goals.render, title: 'חלומות ומטרות' },
  goal: { view: goals.renderGoal, title: 'מטרה', nav: 'goals' },
  uni: { view: uni.render, title: 'אוניברסיטה' },
  tasks: { view: tasks.render, title: 'משימות' },
  settings: { view: settings.render, title: 'הגדרות' },
};

const NAV = [
  { id: 'home', label: 'בית', icon: 'home' },
  { id: 'day', label: 'יום', icon: 'day' },
  { id: 'week', label: 'שבוע', icon: 'week' },
  { id: 'month', label: 'חודש', icon: 'calendar' },
  { id: 'goals', label: 'חלומות', icon: 'target' },
  { id: 'uni', label: 'אוניברסיטה', icon: 'school' },
  { id: 'tasks', label: 'משימות', icon: 'tasks' },
  { id: 'settings', label: 'הגדרות', icon: 'settings' },
];
const MOBILE_NAV = ['home', 'day', 'week', 'month', 'more'];

let main, sideNav, tabBar;
let lastRoute = '';

function parse() {
  const parts = (location.hash || '#/home').replace(/^#\/?/, '').split('/').filter(Boolean);
  const name = ROUTES[parts[0]] ? parts[0] : 'home';
  return { name, args: parts.slice(1) };
}

function navHref(id) {
  if (id === 'day') return `#/day/${today()}`;
  if (id === 'week') return `#/week/${weekStart(today())}`;
  if (id === 'month') return `#/month/${today().slice(0, 7)}`;
  return `#/${id}`;
}

function openMore() {
  import('./ui.js').then(({ choose }) => choose('עוד', [
    { value: 'goals', label: 'חלומות ומטרות', icon: 'target' },
    { value: 'uni', label: 'אוניברסיטה', icon: 'school' },
    { value: 'tasks', label: 'משימות', icon: 'tasks' },
    { value: 'settings', label: 'הגדרות', icon: 'settings' },
  ]).then((v) => { if (v) location.hash = navHref(v); }));
}

function buildShell() {
  const app = document.getElementById('app');
  sideNav = h('nav.side', { 'aria-label': 'ניווט ראשי' },
    h('div.brand', h('span.brand-mark', { html: icon('sparkle', 22) }), h('div', h('b', 'המתכננת שלי'), h('small', 'חלומות → פעולות יומיות'))),
    NAV.map((n) => h('a.side-link', { href: navHref(n.id), dataset: { nav: n.id } }, ic(n.icon), h('span', n.label))),
    h('button.side-cta', { type: 'button', onclick: () => openExport(tomorrow()) }, ic('image'), h('span', 'הורדת הלוח של מחר')));
  main = h('main#main', { tabIndex: -1 });
  tabBar = h('nav.tabbar', { 'aria-label': 'ניווט' }, MOBILE_NAV.map((id) => {
    if (id === 'more') return h('button.tab', { type: 'button', dataset: { nav: 'more' }, onclick: openMore }, ic('more', 22), h('span', 'עוד'));
    const n = NAV.find((x) => x.id === id);
    return h('a.tab', { href: navHref(id), dataset: { nav: id } }, ic(n.icon, 22), h('span', n.label));
  }));
  const fab = h('button.fab', { type: 'button', 'aria-label': 'הוספה מהירה', onclick: () => {
    const r = parse();
    quickAdd(r.name === 'day' && r.args[0] ? r.args[0] : today());
  }, html: icon('plus', 26) });
  app.replaceChildren(sideNav, h('div.main-wrap', main), tabBar, fab);
}

function render() {
  const { name, args } = parse();
  const key = name + '/' + args.join('/');
  const same = key === lastRoute;
  const keep = {};
  if (same) main.querySelectorAll('[data-keep]').forEach((el) => { keep[el.dataset.keep] = [el.scrollLeft, el.scrollTop]; });
  const y = window.scrollY;
  try {
    ROUTES[name].view(main, args);
  } catch (e) {
    console.error(e);
    main.replaceChildren(h('div.page', h('h1', 'אופס'), h('p', 'משהו השתבש בתצוגה הזו: ' + e.message), h('a.btn.primary', { href: '#/home' }, 'חזרה לבית')));
  }
  document.title = `${ROUTES[name].title} · המתכננת שלי`;
  const navId = ROUTES[name].nav || name;
  document.querySelectorAll('[data-nav]').forEach((el) => {
    const on = el.dataset.nav === navId || (el.dataset.nav === 'more' && ['goals', 'uni', 'tasks', 'settings'].includes(navId));
    el.classList.toggle('on', on);
    if (el.tagName === 'A') { el.href = navHref(el.dataset.nav); if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); }
  });
  if (same) {
    window.scrollTo(0, y);
    main.querySelectorAll('[data-keep]').forEach((el) => { const k = keep[el.dataset.keep]; if (k) { el.scrollLeft = k[0]; el.scrollTop = k[1]; } });
  } else {
    window.scrollTo(0, 0);
    if (name === 'week' || name === 'day') scrollToMorning();
    lastRoute = key;
    maybeAutoPlan(name, args);
  }
}

function scrollToMorning() {
  // On the current day/week, scroll so the current time is visible.
  requestAnimationFrame(() => {
    const now = main.querySelector('.tg-now');
    if (now) {
      const r = now.getBoundingClientRect();
      if (r.top > window.innerHeight * 0.8) window.scrollTo({ top: window.scrollY + r.top - window.innerHeight * 0.35 });
    }
  });
}

function maybeAutoPlan(name, args) {
  const s = store.s;
  if (!s.settings.autoPlan || name !== 'week') return;
  const ws = weekStart(args[0] || today());
  if (weekPlanFor(s, ws).planned || addDays(ws, 6) < today()) return;
  const { proposals } = planWeek(s, ws);
  if (!proposals.length) return;
  store.commit('תכנון אוטומטי', (st) => applyPlan(st, ws, proposals));
  toast(`השבוע תוכנן אוטומטית (${proposals.length} בלוקים)`, { action: { label: 'ביטול', fn: () => store.undo() }, timeout: 6000 });
}

let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(() => { renderQueued = false; render(); });
}

async function boot() {
  let fresh;
  try {
    fresh = await store.init();
  } catch (e) {
    document.getElementById('app').textContent = 'שגיאה בטעינת הנתונים: ' + e.message;
    return;
  }
  applyTheme(store.s.settings.theme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => applyTheme(store.s.settings.theme));
  if (fresh) {
    // First run: plan this week and next so the calendar opens ready to use.
    const ws = weekStart(today());
    for (const w of [ws, addDays(ws, 7)]) {
      const { proposals } = planWeek(store.s, w);
      store.commit('תכנון ראשוני', (st) => applyPlan(st, w, proposals), { undo: false, silent: true });
    }
  }
  buildShell();
  window.addEventListener('hashchange', () => { closeAllSheets(); render(); });
  store.subscribe(scheduleRender);
  render();
  document.getElementById('splash')?.remove();
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  // Refresh "now" indicators every minute and roll over at midnight.
  let lastDay = today();
  setInterval(() => {
    if (document.visibilityState !== 'visible' || document.querySelector('.backdrop') || document.activeElement?.matches('input,textarea,select')) return;
    const d = today();
    if (d !== lastDay) { lastDay = d; render(); return; }
    const { name } = parse();
    if (name === 'home' || name === 'day' || name === 'week') render();
  }, 60000);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw?.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller)
            toast('גרסה חדשה זמינה', { action: { label: 'רענון', fn: () => location.reload() }, timeout: 10000 });
        });
      });
    }).catch((e) => console.warn('SW registration failed', e));
  }
}

boot();
