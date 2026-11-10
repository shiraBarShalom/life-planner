// Renders a designed 1080x1920 PNG of a day's schedule on Canvas (RTL Hebrew).
// Long days are split across several images – nothing is clipped.
import { occurrences, tasksFor, cat, dayType, upcoming } from './engine.js';
import { fmtLong, hebrewDate, dur, today, addDays } from './date.js';
import { quoteFor } from './quotes.js';
import { DAY_TYPES } from './seed.js';

const W = 1080, H = 1920, M = 78;
const SERIF = '"Frank Ruhl Libre", "Times New Roman", serif';
const SANS = 'Heebo, "Assistant", "Arial Hebrew", Arial, sans-serif';

const THEMES = {
  blush: {
    bg1: '#FCF7F3', bg2: '#F7E6E3', blob1: 'rgba(233,170,183,0.35)', blob2: 'rgba(240,205,190,0.45)',
    title: '#8E4A5E', ink: '#3B2A2F', muted: '#9C858B', line: 'rgba(142,74,94,0.13)', card: 'rgba(255,255,255,0.72)', accent: '#C9788A', chip: '#F3D9DE',
  },
  night: {
    bg1: '#241A1D', bg2: '#33232A', blob1: 'rgba(201,120,138,0.28)', blob2: 'rgba(150,110,160,0.22)',
    title: '#F2BFCB', ink: '#F7ECEE', muted: '#BFA6AD', line: 'rgba(242,191,203,0.16)', card: 'rgba(255,255,255,0.07)', accent: '#E79BAE', chip: 'rgba(231,155,174,0.2)',
  },
};

async function ensureFonts() {
  if (!document.fonts) return;
  const specs = [`700 80px ${SERIF}`, `500 40px ${SERIF}`, `400 34px ${SANS}`, `500 34px ${SANS}`, `700 34px ${SANS}`];
  try {
    await Promise.race([Promise.all(specs.map((f) => document.fonts.load(f, 'אבגabc'))), new Promise((r) => setTimeout(r, 2500))]);
  } catch { /* fall back to system fonts */ }
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ctx.measureText(text.slice(0, mid) + '…').width <= max) lo = mid; else hi = mid - 1;
  }
  return text.slice(0, lo) + '…';
}

function wrap(ctx, text, max, maxLines = 3) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width <= max) cur = t;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = fit(ctx, lines[maxLines - 1] + '…', max);
  }
  return lines;
}

function background(ctx, T) {
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, T.bg1);
  g.addColorStop(1, T.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const blob = (x, y, r, c) => {
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, c);
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  blob(W * 0.92, 120, 420, T.blob1);
  blob(60, H - 160, 520, T.blob2);
  blob(80, 520, 260, T.blob1);
  ctx.strokeStyle = T.line;
  ctx.lineWidth = 2;
  rr(ctx, 34, 34, W - 68, H - 68, 44);
  ctx.stroke();
}

function text(ctx, str, x, y, { font, color, align = 'right' }) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(str, x, y);
}

function sparkle(ctx, x, y, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

export async function renderDayImages(s, iso) {
  await ensureFonts();
  const T = THEMES[s.settings.exportTheme] || THEMES.blush;
  const occs = occurrences(s, iso);
  const tasks = tasksFor(s, iso).filter((x) => !x.done && !x.overdue).slice(0, 8);
  const pri = ((s.days[iso] || {}).priorities || []).filter((p) => p && p.trim());
  const dls = upcoming(s, 7, iso).filter((d) => d.daysLeft >= 0 && ['assignment', 'exam'].includes(d.kind)).slice(0, 4);
  const quote = quoteFor(s.settings, iso);
  const isTomorrow = iso === addDays(today(), 1);
  const mctx = document.createElement('canvas').getContext('2d');

  // ---- build content items (each knows its height) ----
  const items = [];
  const section = (title) => items.push({ h: 92, keep: true, draw: (c, y) => {
    text(c, title, W - M, y + 58, { font: `700 40px ${SERIF}`, color: T.title });
    c.font = `700 40px ${SERIF}`;
    const tw = c.measureText(title).width;
    c.strokeStyle = T.line; c.lineWidth = 2;
    c.beginPath(); c.moveTo(W - M - tw - 24, y + 46); c.lineTo(M, y + 46); c.stroke();
  } });

  let rowH = 76;
  const others = (pri.length ? 92 + pri.length * 66 : 0) + (tasks.length ? 92 + tasks.length * 62 : 0) + (dls.length ? 92 + dls.length * 62 : 0);
  mctx.font = `500 36px ${SERIF}`;
  const qLines = wrap(mctx, quote, W - 2 * M - 110, 3);
  const headerH = 352 + 70 + qLines.length * 52 + 20, avail = H - 150 - headerH;
  for (let r = 76; r >= 50; r -= 2) { rowH = r; if (92 + occs.length * r + others <= avail) break; }
  if (92 + occs.length * rowH + others > avail) rowH = 70;

  section('סדר היום');
  if (!occs.length) items.push({ h: 70, draw: (c, y) => text(c, 'יום פנוי – זמן למנוחה ולמה שמשמח אותך', W - M, y + 46, { font: `400 34px ${SANS}`, color: T.muted }) });
  for (const o of occs) {
    const C = cat(s, o.cat);
    items.push({ h: rowH, draw: (c, y) => {
      const mid = y + rowH / 2;
      const big = rowH >= 66;
      text(c, o.start, W - M, mid + (big ? -4 : 10), { font: `700 ${big ? 34 : 30}px ${SANS}`, color: T.ink });
      if (big) text(c, o.end, W - M, mid + 30, { font: `400 25px ${SANS}`, color: T.muted });
      // colored pill
      c.fillStyle = C.color;
      rr(c, W - M - 132, y + 12, 9, rowH - 24, 5);
      c.fill();
      const tx = W - M - 158;
      c.font = `500 ${big ? 35 : 31}px ${SANS}`;
      const meta = `${dur(o.e - o.s)}`;
      c.font = `400 26px ${SANS}`;
      const mw = c.measureText(meta).width;
      text(c, meta, M, mid + 10, { font: `400 26px ${SANS}`, color: T.muted, align: 'left' });
      c.font = `500 ${big ? 35 : 31}px ${SANS}`;
      const title = fit(c, (o.done ? '✓ ' : '') + o.title, tx - M - mw - 30);
      text(c, title, tx, mid + (big ? -2 : 10), { font: `500 ${big ? 35 : 31}px ${SANS}`, color: o.done ? T.muted : T.ink });
      if (big) text(c, fit(c, C.name + (o.fixed ? ' · קבוע' : ''), 420), tx, mid + 30, { font: `400 24px ${SANS}`, color: T.muted });
      c.strokeStyle = T.line; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(tx, y + rowH); c.lineTo(M, y + rowH); c.stroke();
    } });
  }
  if (pri.length) {
    section('העדיפויות שלי');
    pri.forEach((p, i) => items.push({ h: 66, draw: (c, y) => {
      c.fillStyle = T.chip;
      c.beginPath(); c.arc(W - M - 22, y + 33, 22, 0, Math.PI * 2); c.fill();
      text(c, String(i + 1), W - M - 22, y + 44, { font: `700 28px ${SANS}`, color: T.title, align: 'center' });
      c.font = `500 33px ${SANS}`;
      text(c, fit(c, p, W - 2 * M - 70), W - M - 62, y + 44, { font: `500 33px ${SANS}`, color: T.ink });
    } }));
  }
  if (tasks.length) {
    section('משימות חשובות');
    tasks.forEach(({ t }) => items.push({ h: 62, draw: (c, y) => {
      c.strokeStyle = cat(s, t.cat).color; c.lineWidth = 3;
      rr(c, W - M - 38, y + 14, 34, 34, 9); c.stroke();
      c.font = `400 32px ${SANS}`;
      const label = (t.priority === 1 ? '★ ' : '') + t.title;
      text(c, fit(c, label, W - 2 * M - 180), W - M - 60, y + 42, { font: `400 32px ${SANS}`, color: T.ink });
      if (t.estimate) text(c, dur(t.estimate), M, y + 42, { font: `400 25px ${SANS}`, color: T.muted, align: 'left' });
    } }));
  }
  if (dls.length) {
    section('מועדים קרובים');
    dls.forEach((d) => items.push({ h: 62, draw: (c, y) => {
      c.fillStyle = d.color;
      c.beginPath(); c.arc(W - M - 14, y + 31, 9, 0, Math.PI * 2); c.fill();
      c.font = `500 31px ${SANS}`;
      text(c, fit(c, d.title, W - 2 * M - 260), W - M - 40, y + 42, { font: `500 31px ${SANS}`, color: T.ink });
      const lbl = d.daysLeft === 0 ? 'היום!' : d.daysLeft === 1 ? 'מחר' : `בעוד ${d.daysLeft} ימים`;
      text(c, lbl, M, y + 42, { font: `700 27px ${SANS}`, color: d.daysLeft <= 2 ? '#C2575F' : T.accent, align: 'left' });
    } }));
  }

  // ---- paginate ----
  const pages = [];
  let cur = [], y = headerH;
  const bottom = H - 150;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const need = it.keep && items[i + 1] ? it.h + items[i + 1].h : it.h;
    if (y + need > bottom && cur.length) { pages.push(cur); cur = []; y = 300; }
    cur.push({ it, y });
    y += it.h;
  }
  if (cur.length) pages.push(cur);

  const hebrew = hebrewDate(iso);
  const blobs = [];
  for (let p = 0; p < pages.length; p++) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    try { c.direction = 'rtl'; } catch { /* older engines */ }
    c.textBaseline = 'alphabetic';
    background(c, T);
    if (p === 0) {
      text(c, isTomorrow ? 'התוכנית שלי למחר' : 'התוכנית שלי ליום', W - M, 150, { font: `500 32px ${SANS}`, color: T.accent });
      sparkle(c, M + 18, 132, 18, T.accent);
      c.font = `700 70px ${SERIF}`;
      text(c, fit(c, fmtLong(iso), W - 2 * M), W - M, 246, { font: `700 70px ${SERIF}`, color: T.title });
      const sub = [hebrew, DAY_TYPES[dayType(s, iso)]].filter(Boolean).join('  ·  ');
      text(c, sub, W - M, 306, { font: `400 31px ${SANS}`, color: T.muted });
      // quote card
      c.font = `500 36px ${SERIF}`;
      const ql = qLines;
      const qh = 70 + ql.length * 52;
      c.fillStyle = T.card;
      rr(c, M, 352, W - 2 * M, qh, 34); c.fill();
      text(c, '”', W - M - 30, 432, { font: `700 90px ${SERIF}`, color: T.accent });
      ql.forEach((l, i) => text(c, l, W - M - 86, 352 + 62 + i * 52, { font: `500 36px ${SERIF}`, color: T.ink }));
      const shift = 0;
      for (const row of pages[p]) row.it.draw(c, row.y + shift);
    } else {
      text(c, `${fmtLong(iso)} · המשך`, W - M, 150, { font: `500 32px ${SANS}`, color: T.accent });
      text(c, 'המשך התוכנית', W - M, 236, { font: `700 62px ${SERIF}`, color: T.title });
      for (const row of pages[p]) row.it.draw(c, row.y);
    }
    // footer
    text(c, 'צעד אחר צעד – את בונה את החלומות שלך', W / 2, H - 92, { font: `500 28px ${SERIF}`, color: T.muted, align: 'center' });
    if (pages.length > 1) text(c, `עמוד ${p + 1} מתוך ${pages.length}`, M, H - 92, { font: `500 26px ${SANS}`, color: T.muted, align: 'left' });
    blobs.push(await new Promise((r) => cv.toBlob(r, 'image/png')));
  }
  return blobs;
}
