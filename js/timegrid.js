// Interactive time grid: blocks can be tapped, dragged (long-press on touch),
// resized from the bottom handle, and nudged with Alt+Arrow keys.
import { h, icon, hexA } from './ui.js';
import { occurrences, cat } from './engine.js';
import { toMin, fromMin, today, nowMin, dur, weekday, DAY_SHORT, fmtShort } from './date.js';

const SNAP = 15;

function lanes(occs) {
  // Assign side-by-side lanes to overlapping blocks.
  const res = new Map();
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const laneEnds = [];
    for (const o of cluster) {
      let l = laneEnds.findIndex((e) => e <= o.s);
      if (l === -1) { l = laneEnds.length; laneEnds.push(0); }
      laneEnds[l] = o.e;
      res.set(o.key, { lane: l });
    }
    for (const o of cluster) res.get(o.key).count = laneEnds.length;
    cluster = [];
  };
  for (const o of occs) {
    if (o.s >= clusterEnd && cluster.length) flush();
    cluster.push(o);
    clusterEnd = Math.max(clusterEnd, o.e);
  }
  if (cluster.length) flush();
  return res;
}

export function timeGrid(s, days, { ppm = 1.1, onTap, onEmpty, onChange, showHead = true, compact = false } = {}) {
  const all = days.map((d) => occurrences(s, d));
  let start = toMin(s.settings.viewStart || '04:00'), end = toMin(s.settings.viewEnd || '21:30');
  for (const list of all) for (const o of list) { start = Math.min(start, Math.floor(o.s / 60) * 60); end = Math.max(end, Math.ceil(o.e / 60) * 60); }
  const height = (end - start) * ppm;
  const t = today();

  const root = h('div.tg' + (compact ? '.compact' : ''), { style: { '--ppm': ppm, '--hour': ppm * 60 + 'px' } });
  if (showHead) {
    root.append(h('div.tg-head', h('div.tg-corner'), days.map((d) => h('a.tg-dh' + (d === t ? '.today' : ''), { href: `#/day/${d}` },
      h('span', DAY_SHORT[weekday(d)]), h('b', fmtShort(d))))));
  }
  const hoursCol = h('div.tg-hours', { style: { height: height + 'px' } });
  for (let m = Math.ceil(start / 60) * 60; m < end; m += 60) hoursCol.append(h('span', { style: { top: (m - start) * ppm + 'px' } }, fromMin(m)));
  const body = h('div.tg-body', hoursCol);
  const cols = [];
  days.forEach((d, i) => {
    const col = h('div.tg-col' + (d === t ? '.today' : ''), { dataset: { date: d }, style: { height: height + 'px', backgroundPosition: `0 ${(Math.ceil(start / 60) * 60 - start) * ppm}px` } });
    const L = lanes(all[i]);
    for (const o of all[i]) {
      const C = cat(s, o.cat);
      const { lane, count } = L.get(o.key);
      const len = o.e - o.s;
      const blk = h('button.tg-blk' + (o.done ? '.done' : '') + (o.conflicts.length ? '.conflict' : '') + (len * ppm < 34 ? '.tiny' : ''), {
        type: 'button',
        dataset: { key: o.key, s: o.s, e: o.e },
        'aria-label': `${o.title}, ${o.start} עד ${o.end}${o.done ? ', בוצע' : ''}`,
        style: {
          top: (o.s - start) * ppm + 'px', height: Math.max(len * ppm - 2, 16) + 'px',
          insetInlineStart: `calc(${(lane / count) * 100}% + 2px)`, width: `calc(${100 / count}% - 4px)`,
          '--c': C.color, background: hexA(C.color, o.done ? 0.1 : 0.2),
        },
      },
      h('span.tg-t', o.done ? h('span.tg-check', { html: icon('check', 12) }) : null, o.title),
      len * ppm >= 40 ? h('span.tg-m', `${o.start}–${o.end}${len >= 45 && !compact ? ' · ' + dur(len) : ''}`) : null,
      o.conflicts.length ? h('span.tg-warn', { html: icon('alert', 12) }) : null,
      len * ppm >= 34 ? h('span.tg-rs', { 'aria-hidden': 'true' }) : null);
      col.append(blk);
    }
    if (d === t) {
      const nm = nowMin();
      if (nm >= start && nm <= end) col.append(h('div.tg-now', { style: { top: (nm - start) * ppm + 'px' } }));
    }
    cols.push(col);
    body.append(col);
  });
  root.append(body);

  // ---- interactions ----
  let cur = null, suppressClick = false;
  const colAt = (x) => cols.find((c) => { const r = c.getBoundingClientRect(); return x >= r.left && x <= r.right; });

  const activate = (st) => {
    st.active = true;
    st.blk.classList.add('dragging');
    root.classList.add('is-dragging');
    try { st.blk.setPointerCapture(st.pid); } catch { /* ignore */ }
    if (navigator.vibrate) navigator.vibrate(8);
  };
  const end_ = (commit) => {
    const st = cur;
    cur = null;
    if (!st) return;
    clearTimeout(st.timer);
    root.classList.remove('is-dragging');
    if (!st.active) return;
    st.blk.classList.remove('dragging');
    if (!st.moved) return;
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 50);
    if (commit && (st.ns !== st.s0 || st.ne !== st.e0 || st.date !== st.date0)) onChange && onChange(st.key, st.date, st.ns, st.ne);
  };

  root.addEventListener('pointerdown', (e) => {
    const blk = e.target.closest('.tg-blk');
    if (!blk || (e.pointerType === 'mouse' && e.button !== 0) || !onChange) return;
    const resize = !!e.target.closest('.tg-rs');
    const col = blk.closest('.tg-col');
    cur = {
      blk, resize, pid: e.pointerId, x0: e.clientX, y0: e.clientY, active: false, key: blk.dataset.key,
      s0: +blk.dataset.s, e0: +blk.dataset.e, ns: +blk.dataset.s, ne: +blk.dataset.e, date0: col.dataset.date, date: col.dataset.date,
      touch: e.pointerType !== 'mouse',
    };
    if (resize) { activate(cur); e.preventDefault(); }
    else if (cur.touch) { const st = cur; st.timer = setTimeout(() => { if (cur === st) activate(st); }, 380); }
  });
  root.addEventListener('pointermove', (e) => {
    const st = cur;
    if (!st || e.pointerId !== st.pid) return;
    const dx = e.clientX - st.x0, dy = e.clientY - st.y0;
    if (!st.active) {
      if (st.touch && Math.hypot(dx, dy) > 8) { clearTimeout(st.timer); cur = null; return; }
      if (!st.touch && Math.hypot(dx, dy) > 5) activate(st); else return;
    }
    e.preventDefault();
    st.moved = true;
    const dm = Math.round(dy / ppm / SNAP) * SNAP;
    if (st.resize) {
      st.ne = Math.min(24 * 60 - 1, Math.max(st.s0 + SNAP, st.e0 + dm));
      st.blk.style.height = Math.max((st.ne - st.s0) * ppm - 2, 16) + 'px';
    } else {
      const len = st.e0 - st.s0;
      st.ns = Math.max(0, Math.min(24 * 60 - 1 - len, st.s0 + dm));
      st.ne = st.ns + len;
      st.blk.style.top = (st.ns - start) * ppm + 'px';
      const c = colAt(e.clientX);
      if (c && c.dataset.date !== st.date) {
        st.date = c.dataset.date;
        c.append(st.blk);
        st.blk.style.insetInlineStart = '2px';
        st.blk.style.width = 'calc(100% - 4px)';
      }
    }
    const m = st.blk.querySelector('.tg-m') || st.blk.querySelector('.tg-t');
    st.blk.dataset.tip = `${fromMin(st.ns)}–${fromMin(st.ne)}`;
    if (m && m.classList.contains('tg-m')) m.textContent = st.blk.dataset.tip;
  });
  root.addEventListener('pointerup', () => end_(true));
  root.addEventListener('pointercancel', () => end_(false));
  // iOS: stop the page from scrolling while a block is being dragged.
  root.addEventListener('touchmove', (e) => { if (cur && cur.active) e.preventDefault(); }, { passive: false });
  root.addEventListener('contextmenu', (e) => { if (e.target.closest('.tg-blk')) e.preventDefault(); });

  root.addEventListener('click', (e) => {
    if (suppressClick) { e.preventDefault(); return; }
    const blk = e.target.closest('.tg-blk');
    if (blk) { onTap && onTap(blk.dataset.key); return; }
    const col = e.target.closest('.tg-col');
    if (col && onEmpty) {
      const r = col.getBoundingClientRect();
      const m = Math.floor(((e.clientY - r.top) / ppm + start) / SNAP) * SNAP;
      onEmpty(col.dataset.date, m);
    }
  });
  root.addEventListener('keydown', (e) => {
    const blk = e.target.closest('.tg-blk');
    if (!blk || !e.altKey || !onChange || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const d = e.key === 'ArrowUp' ? -SNAP : SNAP;
    const s0 = +blk.dataset.s, e0 = +blk.dataset.e;
    const date = blk.closest('.tg-col').dataset.date;
    if (e.shiftKey) onChange(blk.dataset.key, date, s0, Math.max(s0 + SNAP, e0 + d));
    else onChange(blk.dataset.key, date, s0 + d, e0 + d);
    requestAnimationFrame(() => document.querySelector(`.tg-blk[data-key="${CSS.escape(blk.dataset.key)}"]`)?.focus());
  });
  root.scrollToNow = () => {};
  return root;
}
