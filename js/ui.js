// DOM helpers, icons, sheets/dialogs, toasts and form controls.
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-6h4v6"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
  week: '<rect x="3" y="4.5" width="18" height="16" rx="3"/><path d="M3 9.5h18M9 9.5v11M15 9.5v11"/>',
  day: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
  school: '<path d="M2.5 9 12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v4.5c0 1.5 2.5 3 5.5 3s5.5-1.5 5.5-3V11"/><path d="M21.5 9v5"/>',
  tasks: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="m8 12 3 3 5-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.6 15H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.7 4V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  up: '<path d="m6 15 6-6 6 6"/>',
  download: '<path d="M12 3.5v12M7 11l5 5 5-5"/><path d="M4 20.5h16"/>',
  share: '<path d="M12 15V3.5M8 7.5l4-4 4 4"/><path d="M5 12v6.5A2 2 0 0 0 7 20.5h10a2 2 0 0 0 2-2V12"/>',
  copy: '<rect x="8" y="8" width="12.5" height="12.5" rx="2.5"/><path d="M15.5 8V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2H8"/>',
  trash: '<path d="M4 6.5h16M9.5 6.5V4h5v2.5M6.5 6.5l1 13.5h9l1-13.5"/>',
  edit: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  sparkle: '<path d="M12 3c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7z"/><path d="M19 15.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5z"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  car: '<path d="M5 16.5V12l2-5h10l2 5v4.5"/><path d="M3.5 12h17v4.5h-17z"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/>',
  alert: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  repeat: '<path d="M17 3.5 20.5 7 17 10.5"/><path d="M3.5 12V10a3 3 0 0 1 3-3h14"/><path d="M7 20.5 3.5 17 7 13.5"/><path d="M20.5 12v2a3 3 0 0 1-3 3h-14"/>',
  scissors: '<circle cx="6" cy="6.5" r="2.5"/><circle cx="6" cy="17.5" r="2.5"/><path d="M8 8.2 20 18M8 15.8 20 6"/>',
  merge: '<path d="M7 4v5a5 5 0 0 0 5 5h0a5 5 0 0 1 5 5v1"/><path d="M17 4v5a5 5 0 0 1-5 5"/><path d="m14.5 18 2.5 2.5 2.5-2.5"/>',
  dup: '<rect x="8" y="8" width="12.5" height="12.5" rx="2.5"/><path d="M14.2 11.5v5.5M11.5 14.2H17"/><path d="M15.5 8V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2H8"/>',
  arrow: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  image: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="9" cy="9" r="1.8"/><path d="m20.5 15-4.5-4.5L5 20.5"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 21V5.5M20 18.5V21H6.5"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 15.5 5v2M3 12.5h18"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z"/>',
  run: '<circle cx="14" cy="4.5" r="1.8"/><path d="m7 21 3.5-6 3 2.5V21"/><path d="M6 11.5 9 8.5h4.5l2 3.5 3 1"/><path d="m10.5 15 1.5-5"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H16a3 3 0 0 0 0-6H8a3 3 0 0 1 0-6h7.5"/>',
  users: '<circle cx="9" cy="8" r="3.3"/><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5"/><path d="M16 4.8a3.2 3.2 0 0 1 0 6.3M17.5 14.7c2 .7 3.2 2.5 3.5 5.3"/>',
  coffee: '<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17M8 3.5v2.5M12 3.5v2.5"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
  wand: '<path d="m4 20 11-11M14 4l1 2.5L17.5 7.5 15 8.5 14 11l-1-2.5L10.5 7.5 13 6.5z"/><path d="M19 13.5v3M17.5 15h3"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  upload: '<path d="M12 16V4.5M7 9l5-5 5 5"/><path d="M4 20.5h16"/>',
  grip: '<path d="M8 9h8M8 12h8M8 15h8"/>',
  list: '<path d="M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
};

export function icon(name, size = 20) {
  return `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.dot}</svg>`;
}

/** Hyperscript: h('div.card#id', {onclick, class, style, html}, ...children) */
export function h(tag, attrs, ...children) {
  const [t, ...cls] = tag.split('.');
  let [name, idPart] = t.split('#');
  const el = document.createElement(name || 'div');
  if (idPart) el.id = idPart;
  if (cls.length) el.className = cls.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el && !k.includes('-') && k !== 'list' && k !== 'form') {
        try { el[k] = v; } catch { el.setAttribute(k, v); }
      } else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const ic = (name, size) => h('span.icw', { html: icon(name, size) });
export const btn = (label, onclick, cls = '', iconName = null, attrs = {}) =>
  h('button.btn' + (cls ? '.' + cls.split(' ').join('.') : ''), { type: 'button', onclick, ...attrs }, iconName ? ic(iconName, 18) : null, label ? h('span', label) : null);
export const iconBtn = (iconName, label, onclick, cls = '') =>
  h('button.icon-btn' + (cls ? '.' + cls : ''), { type: 'button', onclick, 'aria-label': label, title: label, html: icon(iconName, 20) });

export function hexA(hex, a) {
  const v = Math.round(a * 255).toString(16).padStart(2, '0');
  return (hex || '#C8B8AE').slice(0, 7) + v;
}

// ---------- Sheets / dialogs ----------
const stack = [];
export function openSheet({ title, body, footer, wide = false, onClose, cls = '' }) {
  const prevFocus = document.activeElement;
  const panel = h('div.sheet' + (wide ? '.wide' : '') + (cls ? '.' + cls : ''), { role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '' });
  const backdrop = h('div.backdrop', { onclick: (e) => { if (e.target === backdrop) close(); } }, panel);
  const head = h('div.sheet-head', h('div.sheet-grab'), h('h2.sheet-title', title || ''), iconBtn('x', 'סגירה', () => close(), 'ghost'));
  const content = h('div.sheet-body');
  const foot = h('div.sheet-foot');
  panel.append(head, content, foot);
  const set = (b, f) => {
    const fb = [].concat(f || []).flat(Infinity).filter(Boolean);
    content.replaceChildren(...[].concat(b || []).flat(Infinity).filter(Boolean));
    foot.replaceChildren(...fb);
    foot.hidden = !fb.length;
  };
  set(body, footer);
  let closed = false;
  function close(result) {
    if (closed) return;
    closed = true;
    backdrop.classList.remove('open');
    backdrop.classList.add('closing');
    setTimeout(() => backdrop.remove(), 180);
    stack.splice(stack.indexOf(api), 1);
    if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
    onClose && onClose(result);
  }
  const api = { close, el: panel, set, content, setTitle: (t) => (head.querySelector('.sheet-title').textContent = t) };
  stack.push(api);
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));
  setTimeout(() => {
    const f = panel.querySelector('[autofocus]') || panel.querySelector('.sheet-body input, .sheet-body button, .sheet-body textarea') || panel.querySelector('button');
    if (f && !matchMedia('(pointer:coarse)').matches) f.focus({ preventScroll: true });
  }, 60);
  return api;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && stack.length) { e.preventDefault(); stack[stack.length - 1].close(); }
});
export const closeAllSheets = () => [...stack].forEach((s) => s.close());

export function confirmDialog(text, { ok = 'אישור', cancel = 'ביטול', danger = false, title = 'רגע לפני…' } = {}) {
  return new Promise((resolve) => {
    let res = false;
    const sh = openSheet({
      title, onClose: () => resolve(res),
      body: h('p.dialog-text', text),
      footer: [
        btn(cancel, () => sh.close(), 'ghost'),
        btn(ok, () => { res = true; sh.close(); }, danger ? 'danger' : 'primary'),
      ],
    });
  });
}

export function choose(title, options, { text } = {}) {
  return new Promise((resolve) => {
    let res = null;
    const sh = openSheet({
      title, onClose: () => resolve(res),
      body: [text ? h('p.dialog-text', text) : null, h('div.choice-list', options.map((o) =>
        h('button.choice', { type: 'button', onclick: () => { res = o.value; sh.close(); } }, o.icon ? ic(o.icon) : null, h('span', h('b', o.label), o.sub ? h('small', o.sub) : null))))],
    });
  });
}

let toastEl;
export function toast(msg, { action, timeout = 3800 } = {}) {
  toastEl?.remove();
  const el = h('div.toast', { role: 'status' }, h('span', msg), action ? h('button.toast-act', { type: 'button', onclick: () => { action.fn(); el.remove(); } }, action.label) : null);
  toastEl = el;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, timeout);
}

// ---------- form helpers ----------
export function field(label, control, hint) {
  return h('label.field', h('span.field-label', label), control, hint ? h('small.field-hint', hint) : null);
}
export function input(type, value, attrs = {}) {
  return h('input.input', { type, value: value ?? '', ...attrs });
}
export function textarea(value, attrs = {}) {
  return h('textarea.input', { rows: 3, ...attrs }, value ?? '');
}
export function select(options, value, attrs = {}) {
  const el = h('select.input', attrs, options.map((o) => h('option', { value: o.value ?? '' }, o.label)));
  el.value = value ?? '';
  return el;
}
export function seg(options, value, onchange) {
  const wrap = h('div.seg', { role: 'radiogroup' });
  const render = (v) => {
    wrap.replaceChildren(...options.map((o) => h('button.seg-btn' + (o.value === v ? '.on' : ''), {
      type: 'button', role: 'radio', 'aria-checked': String(o.value === v),
      onclick: () => { wrap.value = o.value; render(o.value); onchange && onchange(o.value); },
    }, o.label)));
  };
  wrap.value = value;
  render(value);
  return wrap;
}
export function dayPicker(days, onchange, labels = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']) {
  const wrap = h('div.daypick');
  wrap.value = [...days];
  const render = () => wrap.replaceChildren(...labels.map((l, i) => h('button.daypick-btn' + (wrap.value.includes(i) ? '.on' : ''), {
    type: 'button', 'aria-pressed': String(wrap.value.includes(i)),
    onclick: () => {
      wrap.value = wrap.value.includes(i) ? wrap.value.filter((x) => x !== i) : [...wrap.value, i].sort();
      render();
      onchange && onchange(wrap.value);
    },
  }, l)));
  render();
  return wrap;
}
export function check(label, checked, onchange) {
  const cb = h('input', { type: 'checkbox', checked: !!checked, onchange: () => onchange && onchange(cb.checked) });
  return h('label.check', cb, h('span.check-box', { html: icon('check', 14) }), h('span', label));
}

export function ring(pct, size = 64, stroke = 6, color = 'var(--rose)') {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  return h('div.ring', {
    style: { width: size + 'px', height: size + 'px' },
    html: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${size / 2} ${size / 2})" style="transition:stroke-dashoffset .6s ease"/></svg><span class="ring-label">${Math.round(pct)}%</span>`,
  });
}

export function bar(pct, color = 'var(--rose)') {
  return h('div.bar', h('div.bar-fill', { style: { width: Math.max(0, Math.min(100, pct)) + '%', background: color } }));
}

export const empty = (text, iconName = 'sparkle') => h('div.empty', ic(iconName, 26), h('p', text));
