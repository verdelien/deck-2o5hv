'use strict';
/* Day Deck UI kit: DOM helper, icons, toast, bottom sheets and small form components. */
(function () {
  const DD = window.DD;

  // h('div', {class: 'x', onClick: fn}, child, [children], 'text')
  DD.h = function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid instanceof Node ? kid : String(kid));
    }
    return el;
  };
  const h = DD.h;

  // Escape text for use inside an SVG/HTML string.
  DD.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  DD.icons = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17" stroke-width="2.4"/><g fill="currentColor" stroke="none"><circle cx="8" cy="13.6" r="1"/><circle cx="12" cy="13.6" r="1"/><circle cx="16" cy="13.6" r="1"/><circle cx="8" cy="17" r="1"/><circle cx="12" cy="17" r="1"/><circle cx="16" cy="17" r="1"/></g></svg>',
  };
  DD.iconEl = (name) => { const s = h('span', { style: 'display:inline-flex' }); s.innerHTML = DD.icons[name]; return s; };

  /* ---------------- Toast ---------------- */
  let toastTimer = null;
  DD.toast = function (text, action) {
    const el = document.getElementById('toast');
    el.replaceChildren(h('span', null, text));
    if (action) el.append(h('button', { type: 'button', onClick: () => { el.classList.remove('show'); action.run(); } }, action.label));
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), action ? 6000 : 2600);
  };

  /* ---------------- Bottom sheet ----------------
     One sheet at a time. Opening pushes a history entry, so the Android back gesture
     (and browser back) closes the sheet instead of leaving the app. */
  let cur = null;
  let ignorePop = false;

  DD.openSheet = function (opts) {
    const layer = document.getElementById('layer');
    const isNew = !cur;
    if (cur) { cur.backdrop.remove(); cur.panel.remove(); }
    const backdrop = h('div', { class: 'backdrop', onClick: () => DD.closeSheet() });
    const saveBtn = opts.onSave ? h('button', { class: 'save-btn', type: 'button', onClick: () => opts.onSave() }, opts.saveLabel || '保存') : h('button', { class: 'txt-btn', type: 'button', onClick: () => DD.closeSheet() }, opts.doneLabel || '完成');
    const head = h('div', { class: 'sheet-head' },
      h('div', { class: 'grabber' }),
      h('div', { class: 'left' }, opts.onSave ? h('button', { class: 'txt-btn', type: 'button', onClick: () => DD.closeSheet() }, '取消') : null),
      h('div', { class: 'sheet-title' }, opts.title || ''),
      h('div', { class: 'right' }, saveBtn));
    const body = h('div', { class: 'sheet-body' });
    const panel = h('div', { class: 'sheet' + (opts.full ? ' full' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': opts.title || '' }, head, body);
    layer.append(backdrop, panel);
    cur = { backdrop, panel, body, head, opts };
    dragToClose(head, panel);
    if (isNew) history.pushState({ ddSheet: true }, '');
    document.body.style.overflow = 'hidden';
    return {
      body,
      setBody(nodes) { const top = body.scrollTop; body.replaceChildren(...[].concat(nodes)); body.scrollTop = top; },
      setTitle(t) { head.querySelector('.sheet-title').textContent = t; },
      panel,
    };
  };

  function removeCurrent() {
    if (!cur) return;
    const { backdrop, panel, opts } = cur;
    cur = null;
    panel.classList.add('closing');
    backdrop.style.transition = 'opacity .2s';
    backdrop.style.opacity = '0';
    setTimeout(() => { backdrop.remove(); panel.remove(); }, 210);
    document.body.style.overflow = '';
    if (opts.onClose) opts.onClose();
  }

  DD.closeSheet = function () {
    if (!cur) return;
    removeCurrent();
    if (history.state && history.state.ddSheet) { ignorePop = true; history.back(); }
  };
  DD.sheetOpen = () => !!cur;

  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop = false; return; }
    if (cur) removeCurrent();
  });

  function dragToClose(handle, panel) {
    let y0 = null, dy = 0;
    handle.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      y0 = e.clientY; dy = 0; panel.style.transition = 'none';
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', (e) => {
      if (y0 == null) return;
      dy = Math.max(0, e.clientY - y0);
      panel.style.transform = `translateY(${dy}px)`;
    });
    const end = () => {
      if (y0 == null) return;
      y0 = null; panel.style.transition = 'transform .2s'; panel.style.transform = '';
      if (dy > 110) DD.closeSheet();
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  /* ---------------- Form components ---------------- */

  // Segmented control. options: [[value, label]]. Tapping the active one again unsets it if allowNone.
  DD.seg = function (options, value, onPick, cls, allowNone) {
    return h('div', { class: 'seg ' + (cls || ''), role: 'tablist' }, options.map(([v, label]) =>
      h('button', { type: 'button', role: 'tab', class: v === value ? 'on' : '', 'aria-selected': String(v === value), onClick: () => onPick(allowNone && v === value ? null : v) }, label)));
  };

  // Chips. multi: value is an array. Tapping a selected single chip unsets it when allowNone.
  DD.chips = function (options, value, onPick, o = {}) {
    return h('div', { class: 'chips' }, options.map((opt) => {
      const [v, label] = Array.isArray(opt) ? opt : [opt, opt];
      const on = o.multi ? (value || []).includes(v) : v === value;
      return h('button', { type: 'button', class: 'chip' + (o.small ? ' sm' : '') + (on ? ' on' : ''), 'aria-pressed': String(on), onClick: () => {
        if (o.multi) onPick(on ? value.filter((x) => x !== v) : (value || []).concat([v]));
        else onPick(on && o.allowNone ? null : v);
      } }, label);
    }));
  };

  DD.field = (label, ...kids) => h('div', { class: 'fld' }, label ? h('label', null, label) : null, ...kids);

  // A text input that updates obj[key] without re-rendering.
  DD.textInput = function (obj, key, attrs = {}) {
    const { multiline, onChange, ...rest } = attrs;
    const el = h(multiline ? 'textarea' : 'input', Object.assign({ class: 'inp', type: multiline ? null : 'text', value: obj[key] == null ? '' : obj[key] }, rest));
    el.addEventListener('input', () => { obj[key] = el.value; if (onChange) onChange(el.value); });
    return el;
  };

  // "YYYY-MM-DDTHH:MM:SS" <-> datetime-local value "YYYY-MM-DDTHH:MM"
  DD.dtValue = (s) => (s || '').slice(0, 16);
  DD.fromDtValue = (v) => (v && v.length >= 16 ? v.slice(0, 16) + ':00' : null);

  DD.ask = (msg) => window.confirm(msg);
})();
