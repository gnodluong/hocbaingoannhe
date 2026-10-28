'use strict';
/** Cac ham dung chung: dung DOM, panel/nut/chip, modal (trong cung cua so), toast. */

function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  if (opts.class) node.className = opts.class;
  if (opts.html !== undefined) node.innerHTML = opts.html;
  if (opts.text !== undefined) node.textContent = opts.text;
  if (opts.attrs) for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, v);
  if (opts.style) Object.assign(node.style, opts.style);
  if (opts.on) for (const [ev, fn] of Object.entries(opts.on)) node.addEventListener(ev, fn);
  for (const child of [].concat(children)) {
    if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function btn(text, onClick, { kind = 'primary', small = false, iconName = null, disabled = false, block = false } = {}) {
  const b = el('button', {
    class: `btn ${kind}${small ? ' small' : ''}${block ? ' block' : ''}`,
    html: (iconName ? icon(iconName, small ? 13 : 14) : '') + `<span>${text}</span>`,
    on: { click: event => { event.stopPropagation(); onClick(event); } },
  });
  if (disabled) b.disabled = true;
  return b;
}

function chipEl(text, { tone = '', onClick = null } = {}) {
  const c = el('span', { class: `chip${tone ? ' ' + tone : ''}${onClick ? ' clickable' : ''}`, text });
  if (onClick) c.addEventListener('click', onClick);
  return c;
}

function panel(children, { classes = '', accent = null, onClick = null } = {}) {
  const p = el('div', { class: `panel ${classes}${accent ? ' accent-left' : ''}${onClick ? ' clickable' : ''}` }, children);
  if (accent) p.style.setProperty('--accent-color', accent);
  if (onClick) p.addEventListener('click', onClick);
  return p;
}

function pageTitle({ eyebrow = '', title, hl = '', subtitle = '' }) {
  const wrap = el('div', { class: 'page-title' });
  if (eyebrow) wrap.appendChild(el('div', { class: 'eyebrow', text: eyebrow }));
  const h = el('h1', {}, [document.createTextNode(title)]);
  if (hl) h.appendChild(el('span', { class: 'hl', text: ' ' + hl }));
  wrap.appendChild(h);
  if (subtitle) wrap.appendChild(el('div', { class: 'page-subtitle', text: subtitle }));
  return wrap;
}

function sectionHead(title, hint = '') {
  return el('div', { class: 'section-head' }, [
    el('div', { class: 'bar-title' }, [el('div', { class: 'bar' }), el('span', { text: title })]),
    hint ? el('div', { class: 'hint', text: hint }) : null,
  ]);
}

function emptyState(glyphIcon, title, desc, action = null) {
  const wrap = el('div', { class: 'panel empty-state' }, [
    el('div', { class: 'glyph', html: icon(glyphIcon, 30) }),
    el('div', { class: 'title', text: title }),
    el('div', { class: 'desc', text: desc }),
  ]);
  if (action) { const a = el('div', { class: 'mt16' }, [action]); wrap.appendChild(a); }
  return wrap;
}

function toggle(value, onChange) {
  const t = el('div', { class: `toggle${value ? ' on' : ''}`, attrs:{role:'switch',tabindex:'0','aria-checked':String(!!value),'aria-label':'Bật hoặc tắt tuỳ chọn'} }, [el('div', { class: 'knob' })]);
  const change = () => {
    const now = !t.classList.contains('on');
    t.classList.toggle('on', now);
    t.setAttribute('aria-checked',String(now));
    onChange(now);
  };
  t.addEventListener('click',change);
  t.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();change();}});
  return t;
}

function switchRow(title, desc, value, onChange) {
  const control = toggle(value,onChange);
  control.setAttribute('aria-label',title);
  return el('div', { class: 'switch-row' }, [
    el('div', {}, [el('div', { class: 'title', text: title }), el('div', { class: 'desc', text: desc })]),
    control,
  ]);
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function fmtDate(ts) {
  const d = new Date(ts);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function subjectIcon(name) {
  const lower = (name || '').toLowerCase();
  if (lower.includes('thuốc') || lower.includes('dược')) return 'notes';
  if (lower.includes('cổ truyền') || lower.includes('đông y')) return 'flag';
  if (lower.includes('điều dưỡng')) return 'stethoscope';
  if (lower.includes('giải phẫu')) return 'target';
  if (lower.includes('cấp cứu')) return 'flag';
  return 'book';
}

// -------------------------------------------------------------------- toast
function toast(message, kind = 'info') {
  const root = document.getElementById('toast-root');
  const node = el('div', { class: `toast ${kind}`, text: message });
  root.appendChild(node);
  setTimeout(() => node.remove(), 3000);
}

// -------------------------------------------------------------------- modal
/**
 * Hop thoai noi TRONG cua so app (chi la 1 lop DOM overlay) — khong bao gio mo
 * them cua so Windows nao ca, vi day la web page duy nhat trong 1 BrowserWindow.
 */
function openModal({ title, subtitle = '', body, footer, width = 460, onClose = null }) {
  const root = document.getElementById('modal-root');
  const backdrop = el('div', { class: 'modal-backdrop' });
  const card = el('div', { class: 'modal-card' });
  card.style.width = width + 'px';
  card.appendChild(el('h2', { text: title }));
  if (subtitle) card.appendChild(el('div', { class: 'modal-sub', text: subtitle }));
  const bodyWrap = el('div', { class: 'modal-body' });
  if (body) bodyWrap.appendChild(body);
  card.appendChild(bodyWrap);
  const footerWrap = el('div', { class: 'modal-footer' });
  card.appendChild(footerWrap);
  backdrop.appendChild(card);
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
  root.appendChild(backdrop);

  function close() {
    root.removeChild(backdrop);
    document.removeEventListener('keydown', onEsc);
    if (onClose) onClose();
  }
  function onEsc(e) { if (e.key === 'Escape') close(); }
  document.addEventListener('keydown', onEsc);

  const api = { close, footer: footerWrap, body: bodyWrap, card };
  if (footer) footer(footerWrap, close);
  return api;
}

function promptName(defaultName = '') {
  return new Promise((resolve) => {
    const input = el('input', { class: 'text-input', attrs: { type: 'text', placeholder: 'VD: Nguyễn Văn A' } });
    input.value = defaultName;
    const label = el('label', { class: 'field-label', text: 'Họ và tên' });
    const body = el('div', {}, [label, input]);
    let done = false;
    const modal = openModal({
      title: 'Trước khi bắt đầu',
      subtitle: 'Nhập họ tên để ghi nhận vào lịch sử làm bài.',
      body,
      footer: (footer, close) => {
        footer.appendChild(btn('Huỷ', () => { done = true; close(); resolve(null); }, { kind: 'ghost' }));
        footer.appendChild(btn('Bắt đầu', () => {
          done = true; close(); resolve(input.value.trim());
        }, { kind: 'primary', iconName: 'arrowRight' }));
      },
      onClose: () => { if (!done) resolve(null); },
    });
    setTimeout(() => { input.focus(); input.select(); }, 30);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { done = true; modal.close(); resolve(input.value.trim()); }
    });
  });
}


function confirmDialog(title, message, { confirmLabel = 'Đồng ý', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const modal = openModal({
      title,
      subtitle: message,
      body: el('div'),
      footer: (footer, close) => {
        footer.appendChild(btn('Huỷ', () => { done = true; close(); resolve(false); }, { kind: 'ghost' }));
        footer.appendChild(btn(confirmLabel, () => { done = true; close(); resolve(true); }, { kind: danger ? 'danger' : 'primary' }));
      },
      onClose: () => { if (!done) resolve(false); },
    });
  });
}
