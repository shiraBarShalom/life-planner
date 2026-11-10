// Date utilities. All calendar dates are wall-clock dates in Israel (Asia/Jerusalem),
// stored as 'YYYY-MM-DD' strings and times as 'HH:MM'. Arithmetic is done on UTC
// midnights, so daylight-saving transitions can never shift a date or a block.
export const TZ = 'Asia/Jerusalem';
export const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
export const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export const pad = (n) => String(n).padStart(2, '0');

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function nowParts() {
  const p = {};
  for (const x of partsFmt.formatToParts(new Date())) p[x.type] = x.value;
  return { date: `${p.year}-${p.month}-${p.day}`, min: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}
export const today = () => nowParts().date;
export const nowMin = () => nowParts().min;
export const tomorrow = () => addDays(today(), 1);

export function toDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function fromDate(dt) {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}
export function addDays(iso, n) {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
}
/** b - a in whole days */
export const diffDays = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
export const weekday = (iso) => toDate(iso).getUTCDay();
export const weekStart = (iso) => addDays(iso, -weekday(iso));
export const isISO = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(toDate(v));

export function monthGrid(y, m) {
  const first = `${y}-${pad(m)}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = `${y}-${pad(m)}-${pad(lastDay)}`;
  const end = addDays(weekStart(last), 6);
  const days = [];
  for (let d = weekStart(first); d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function toMin(t) {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
export function fromMin(n) {
  n = Math.max(0, Math.min(23 * 60 + 59, Math.round(n)));
  return `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
}

export function fmtLong(iso) {
  const d = toDate(iso);
  return `יום ${DAY_NAMES[d.getUTCDay()]}, ${d.getUTCDate()} ב${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function fmtDM(iso) {
  const d = toDate(iso);
  return `${d.getUTCDate()} ב${MONTHS[d.getUTCMonth()]}`;
}
export function fmtShort(iso) {
  const d = toDate(iso);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
}
export function fmtDayShort(iso) {
  return `${DAY_SHORT[weekday(iso)]} ${fmtShort(iso)}`;
}
export const monthLabel = (y, m) => `${MONTHS[m - 1]} ${y}`;

export function gematria(n) {
  n = Number(n) % 1000;
  const H = ['', 'ק', 'ר', 'ש', 'ת'], T = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'], O = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  let s = '';
  let h = Math.floor(n / 100);
  while (h > 4) { s += 'ת'; h -= 4; }
  s += H[h];
  const r = n % 100;
  if (r === 15) s += 'טו';
  else if (r === 16) s += 'טז';
  else s += T[Math.floor(r / 10)] + O[r % 10];
  return s.length === 1 ? s + '׳' : s.slice(0, -1) + '״' + s.slice(-1);
}

let hebFmt;
function hebParts(iso) {
  hebFmt ||= new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' });
  const p = {};
  for (const x of hebFmt.formatToParts(toDate(iso))) p[x.type] = x.value;
  let month = p.month || '';
  if (month.startsWith('ב') && month.length > 3) month = month.slice(1);
  return { day: parseInt(p.day, 10), month, year: parseInt(p.year || p.relatedYear, 10) };
}
export function hebrewDate(iso) {
  try {
    const { day, month, year } = hebParts(iso);
    if (!day || !month) return '';
    return `${gematria(day)} ב${month}${year ? ' ' + gematria(year) : ''}`;
  } catch {
    return '';
  }
}
export function hebrewDay(iso) {
  try {
    const d = hebParts(iso).day;
    return d ? gematria(d) : '';
  } catch {
    return '';
  }
}

export function relDay(iso, base = today()) {
  const n = diffDays(base, iso);
  if (n === 0) return 'היום';
  if (n === 1) return 'מחר';
  if (n === -1) return 'אתמול';
  if (n === 2) return 'מחרתיים';
  if (n > 0) return `בעוד ${n} ימים`;
  return `לפני ${-n} ימים`;
}

export function dur(min) {
  min = Math.round(min);
  if (min < 60) return `${min} ד׳`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}:${pad(m)} ש׳` : `${h} ש׳`;
}
export const hours = (min) => Math.round((min / 60) * 10) / 10;

export function weekLabel(ws) {
  const we = addDays(ws, 6);
  const a = toDate(ws), b = toDate(we);
  if (a.getUTCMonth() === b.getUTCMonth()) return `${a.getUTCDate()}–${b.getUTCDate()} ב${MONTHS[a.getUTCMonth()]} ${a.getUTCFullYear()}`;
  return `${fmtDM(ws)} – ${fmtDM(we)} ${b.getUTCFullYear()}`;
}

export function greeting(min = nowMin()) {
  if (min < 5 * 60) return 'לילה טוב';
  if (min < 12 * 60) return 'בוקר טוב';
  if (min < 17 * 60) return 'צהריים טובים';
  if (min < 21 * 60) return 'ערב טוב';
  return 'לילה טוב';
}
