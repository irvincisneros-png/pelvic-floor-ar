// HTML overlay UI. Everything lives inside the uiRoot element handed to createExperience.
// No assumptions about the page, renderer or camera. All top-level containers carry data-ui.
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
  return el;
}
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class PfUI {
  constructor(uiRoot, content, hooks = {}) {
    this.root = uiRoot; this.C = content || {}; this.hooks = hooks;
    this.wrap = h('div', { class: 'pf-ui', 'data-ui': '' });
    uiRoot.appendChild(this.wrap);
    this.meta = this.C.meta || {};
    // top bar
    this.titleEl = h('div', { class: 'pf-title' });
    this.askBtn = h('button', { class: 'pf-pill', type: 'button', 'aria-label': 'Ask a question', onClick: () => this.openDrawer('ask') }, h('span', { class: 'pf-pill-ic', 'aria-hidden': 'true', text: '?' }), 'Ask');
    this.aboutBtn = h('button', { class: 'pf-pill', type: 'button', 'aria-label': 'About and sources', onClick: () => this.openDrawer('about') }, h('span', { class: 'pf-pill-ic', 'aria-hidden': 'true', text: 'i' }), 'About');
    this.top = h('div', { class: 'pf-top', 'data-ui': '' }, this.titleEl, h('div', { class: 'pf-top-btns' }, this.askBtn, this.aboutBtn));
    // labels
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'pf-leaders');
    this.labelLayer = h('div', { class: 'pf-labels' });
    // sheet
    this.handle = h('button', { class: 'pf-handle', type: 'button', 'aria-expanded': 'false', 'aria-label': 'Expand or collapse panel' }, h('span', { class: 'pf-grip' }));
    this._dragInit();
    this.handle.addEventListener('click', (e) => { if (e.detail === 0) this.toggleSheet(); });
    this.sheetBody = h('div', { class: 'pf-sheet-body' });
    this.sheet = h('div', { class: 'pf-sheet sheet collapsed', 'data-ui': '' }, this.handle, this.sheetBody);
    this.toast = h('div', { class: 'pf-toast', role: 'status', 'aria-live': 'polite' });
    this.wrap.append(this.svg, this.labelLayer, this.top, this.sheet, this.toast);
    this.labels = new Map(); this.selected = null;
    this._buildDrawers();
    if (typeof ResizeObserver !== 'undefined') { this._ro = new ResizeObserver(() => this._layout()); this._ro.observe(this.sheet); }
    this._layout();
  }

  // ---------------------------------------------------------------- layout
  _dragInit() {
    let y0 = null, moved = 0;
    this.handle.addEventListener('pointerdown', (e) => { y0 = e.clientY; moved = 0; try { this.handle.setPointerCapture(e.pointerId); } catch (_) {} });
    this.handle.addEventListener('pointermove', (e) => { if (y0 != null) moved = e.clientY - y0; });
    const end = () => { if (y0 == null) return; if (Math.abs(moved) > 22) this.toggleSheet(moved > 0); else this.toggleSheet(); y0 = null; };
    this.handle.addEventListener('pointerup', end); this.handle.addEventListener('pointercancel', () => { y0 = null; });
  }
  /** collapsed = compact sheet (<= 34% of the screen); expanded shows everything. toggleSheet(true) collapses. */
  toggleSheet(collapsed) {
    const c = collapsed ?? !this.sheet.classList.contains('collapsed');
    this.sheet.classList.toggle('collapsed', c); this.sheet.classList.toggle('expanded', !c);
    this.handle.setAttribute('aria-expanded', String(!c));
    if (c) this.sheetBody.scrollTop = 0;
    setTimeout(() => this._layout(), 280); this._layout();
  }
  _layout() {
    const r = this.root.getBoundingClientRect();
    const sr = this.sheet.getBoundingClientRect();
    const bottom = Math.max(0, r.bottom - sr.top);
    if (this.hooks.onLayout) this.hooks.onLayout({ bottom, top: this.top.getBoundingClientRect().height, width: r.width, height: r.height });
  }
  setHeader(title) { this.titleEl.textContent = title || ''; }
  sayToast(msg, ms = 2400) { this.toast.textContent = msg; this.toast.classList.add('on'); clearTimeout(this._tt); this._tt = setTimeout(() => this.toast.classList.remove('on'), ms); }

  // ---------------------------------------------------------------- sheet builders
  clearSheet() { this.sheetBody.replaceChildren(); this.pacerEls = null; }
  add(...nodes) { for (const n of nodes) if (n) this.sheetBody.append(n); return nodes[0]; }
  takeaway(text) { return h('p', { class: 'pf-takeaway', text }); }
  section(title, ...kids) { return h('div', { class: 'pf-sec' }, title ? h('div', { class: 'pf-sec-h', text: title }) : null, ...kids); }
  segmented(options, value, onChange, cls = '') {
    const btns = options.map((o) => h('button', { type: 'button', class: 'pf-seg-b', 'data-id': o.id, 'aria-pressed': 'false', onClick: () => { set(o.id); onChange(o.id); } }, o.label));
    const el = h('div', { class: 'pf-seg ' + cls, role: 'group' }, ...btns);
    const set = (id) => btns.forEach((b) => { const on = b.dataset.id === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    set(value);
    return { el, set };
  }
  slider({ min = 0, max = 1, step = 0.01, value = 0, ticks, label, onInput, aria }) {
    const input = h('input', { type: 'range', min, max, step, value, 'aria-label': aria || label || 'Slider', class: 'pf-range' });
    const out = label ? h('div', { class: 'pf-range-l', text: label }) : null;
    const tk = ticks ? h('div', { class: 'pf-ticks' }, ticks.map((t, i) => h('button', { type: 'button', class: 'pf-tick', text: t, onClick: () => { const v = min + (max - min) * (i / (ticks.length - 1)); input.value = v; input.dispatchEvent(new Event('input')); } }))) : null;
    input.addEventListener('input', () => onInput(+input.value));
    const el = h('div', { class: 'pf-slider' }, out, input, tk);
    return { el, input, set: (v) => { input.value = v; }, label: (t) => { if (out) out.textContent = t; } };
  }
  button(label, onClick, cls = '') { return h('button', { type: 'button', class: 'pf-btn ' + cls, onClick }, label); }
  toggle(label, value, onChange) {
    const b = h('button', { type: 'button', class: 'pf-toggle', role: 'switch', 'aria-checked': String(!!value), onClick: () => { const v = b.getAttribute('aria-checked') !== 'true'; b.setAttribute('aria-checked', String(v)); onChange(v); } }, h('span', { class: 'pf-sw' }), h('span', { class: 'pf-toggle-l', text: label }));
    return { el: b, set: (v) => b.setAttribute('aria-checked', String(!!v)) };
  }
  readout() { const el = h('div', { class: 'pf-readout', 'aria-live': 'polite' }); return { el, set: (title, text, tone) => { el.className = 'pf-readout' + (tone ? ' ' + tone : ''); el.replaceChildren(title ? h('div', { class: 'pf-ro-t', text: title }) : '', text ? h('div', { class: 'pf-ro-x', text }) : ''); el.style.display = (title || text) ? '' : 'none'; } }; }
  details(summary, items) {
    if (!items?.length) return null;
    return h('details', { class: 'pf-details' }, h('summary', { text: summary }), ...items.map((t) => h('p', { text: t })));
  }
  card(title, text, extra) { return h('div', { class: 'pf-card' }, title ? h('div', { class: 'pf-card-t', text: title }) : null, text ? h('p', { text }) : null, extra); }

  // ---------------------------------------------------------------- info card (label text)
  makeInfo() {
    this.infoEl = h('div', { class: 'pf-info', 'data-ui': '', hidden: true });
    return this.infoEl;
  }
  showInfo(item) {
    if (!this.infoEl) return;
    if (!item) { this.infoEl.hidden = true; return; }
    this.infoEl.hidden = false;
    this.infoEl.replaceChildren(
      h('div', { class: 'pf-info-h' }, h('span', { class: 'pf-info-n', text: item.name }), item.term && item.term !== item.name ? h('span', { class: 'pf-info-term', text: '\u00b7 ' + item.term }) : null,
        h('button', { type: 'button', class: 'pf-x', 'aria-label': 'Close', text: '×', onClick: () => this.hooks.onLabelClose && this.hooks.onLabelClose() })),
      h('p', { text: item.text || '' }));
  }

  // ---------------------------------------------------------------- labels: pins on the model + a scrolling chip row in the sheet
  makeChipRow() { this.chipRow = h('div', { class: 'pf-chips', role: 'listbox', 'aria-label': 'Parts' }); return this.chipRow; }
  setLabels(items, onTap) {
    this.labelLayer.replaceChildren(); this.labels.clear(); this.selected = null; this.onLabelTap = onTap;
    if (this.chipRow) this.chipRow.replaceChildren();
    this.callout = h('div', { class: 'pf-callout', hidden: true }); this.labelLayer.append(this.callout);
    for (const it of items) {
      const pin = h('button', { type: 'button', class: 'pf-pin label', 'aria-label': it.name, onClick: () => onTap && onTap(it.id) }, h('i'));
      const chip = h('button', { type: 'button', class: 'pf-pchip', role: 'option', 'data-id': it.id, onClick: () => onTap && onTap(it.id) }, it.name);
      this.labelLayer.append(pin); if (this.chipRow) this.chipRow.append(chip);
      this.labels.set(it.id, { pin, chip, item: it });
    }
    if (this.chipRow) this.chipRow.style.display = items.length ? '' : 'none';
    this.labelLayer.style.display = items.length ? '' : 'none';
  }
  setLabelsVisible(v) { this.labelsOn = v; this.labelLayer.style.visibility = v ? '' : 'hidden'; }
  selectLabel(id) {
    this.selected = id;
    for (const [k, l] of this.labels) { l.pin.classList.toggle('on', k === id); l.chip.classList.toggle('on', k === id); l.chip.setAttribute('aria-selected', String(k === id)); }
    if (this.callout) { this.callout.hidden = !id; if (id) this.callout.textContent = this.labels.get(id)?.item.name || ''; }
    if (id && this.chipRow) { const c = this.labels.get(id)?.chip; c && c.scrollIntoView && c.scrollIntoView({ block: 'nearest', inline: 'center' }); }
  }
  /** pts: Map id -> {x,y,vis} in px relative to uiRoot. Pins are dots on the model; only one callout (the selected part) is ever shown. */
  updateLabels(pts, W, H, topSafe, bottomSafe) {
    if (!this.labels.size) return;
    for (const [id, l] of this.labels) {
      const p = pts.get(id), show = !!(p && p.vis);
      l.pin.style.display = show ? '' : 'none'; l.chip.style.display = show ? '' : 'none';
      if (show) { l.pin.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`; }
    }
    const sel = this.selected && this.labels.get(this.selected), p = sel && pts.get(this.selected);
    if (sel && p && p.vis && this.callout) {
      const c = this.callout; c.hidden = false;
      const cw = c.offsetWidth || 120, ch = c.offsetHeight || 30;
      let x = p.x > W * 0.52 ? p.x - cw - 16 : p.x + 16;
      x = Math.min(W - cw - 6, Math.max(6, x));
      let y = Math.min(H - bottomSafe - ch - 8, Math.max(topSafe + 4, p.y - ch / 2));
      c.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    } else if (this.callout) this.callout.hidden = true;
  }
  banner(text, tone = '', ms = 2800) {
    if (!this.bannerEl) { this.bannerEl = h('div', { class: 'pf-banner', role: 'status', 'aria-live': 'assertive' }); this.wrap.append(this.bannerEl); }
    this.bannerEl.textContent = text; this.bannerEl.className = 'pf-banner on ' + tone;
    clearTimeout(this._bt); this._bt = setTimeout(() => this.bannerEl.classList.remove('on'), ms);
  }

  // ---------------------------------------------------------------- drawers (Ask + About)
  _buildDrawers() {
    const C = this.C, meta = this.meta;
    const faq = C.faq || [], sources = C.sources || [];
    const src = (id) => sources.find((s) => s.id === id);
    // Ask
    this.askList = h('div', { class: 'pf-faq' });
    this.askEmpty = h('p', { class: 'pf-empty', text: 'No matching questions. Try a different word.', hidden: true });
    const items = faq.map((f) => {
      const s = src(f.sourceId);
      const d = h('details', { class: 'pf-q' }, h('summary', { text: f.q }), h('div', { class: 'pf-a' }, h('p', { text: f.a }), s ? h('a', { class: 'pf-src', href: s.url, target: '_blank', rel: 'noopener noreferrer', text: 'Source: ' + s.label }) : null));
      d._text = (f.q + ' ' + f.a).toLowerCase();
      return d;
    });
    this.askList.append(...items);
    const search = h('input', { type: 'search', class: 'pf-search', placeholder: 'Search questions and myths', 'aria-label': 'Search questions', autocomplete: 'off' });
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase(); let shown = 0;
      for (const d of items) { const ok = !q || q.split(/\s+/).every((w) => d._text.includes(w)); d.hidden = !ok; if (ok) shown++; }
      this.askEmpty.hidden = shown > 0;
    });
    this.askDrawer = this._drawer('Ask', h('div', {}, search, this.askList, this.askEmpty), 'ask');
    // About
    const hl = meta.helpline || {};
    const about = h('div', { class: 'pf-about' },
      h('p', { class: 'pf-disc', text: meta.disclaimer || '' }),
      hl.name ? h('div', { class: 'pf-card pf-help' }, h('div', { class: 'pf-card-t', text: hl.name }),
        hl.phone ? h('a', { class: 'pf-phone', href: 'tel:' + String(hl.phone).replace(/\s+/g, ''), text: hl.phone }) : null,
        hl.note ? h('p', { text: hl.note }) : null,
        hl.url ? h('a', { class: 'pf-src', href: hl.url, target: '_blank', rel: 'noopener noreferrer', text: 'Website' }) : null) : null,
      (meta.credits || []).length ? h('div', { class: 'pf-sec-h', text: 'Credits' }) : null,
      h('ul', { class: 'pf-list' }, (meta.credits || []).map((c) => h('li', {}, h('a', { href: c.url, target: '_blank', rel: 'noopener noreferrer', text: c.label })))),
      sources.length ? h('div', { class: 'pf-sec-h', text: 'Sources for the figures' }) : null,
      h('ul', { class: 'pf-list small' }, sources.map((s) => h('li', {}, h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.label })))),
      h('p', { class: 'pf-fine', text: '3D anatomy is a hand-built, simplified illustration, not a scan, and not to scale for any one person.' }));
    this.aboutDrawer = this._drawer('About', about, 'about');
    this.wrap.append(this.askDrawer, this.aboutDrawer);
  }
  _drawer(title, body, id) {
    const close = h('button', { type: 'button', class: 'pf-x big', 'aria-label': 'Close ' + title, text: '×', onClick: () => this.closeDrawers() });
    const d = h('div', { class: 'pf-drawer drawer', 'data-ui': '', 'data-drawer': id, role: 'dialog', 'aria-label': title, 'aria-hidden': 'true' },
      h('div', { class: 'pf-drawer-h' }, h('div', { class: 'pf-drawer-t', text: title }), close), h('div', { class: 'pf-drawer-b' }, body));
    return d;
  }
  openDrawer(id) {
    this.closeDrawers();
    const d = id === 'ask' ? this.askDrawer : this.aboutDrawer;
    d.classList.add('open'); d.setAttribute('aria-hidden', 'false');
    this.wrap.classList.add('drawer-open');
  }
  closeDrawers() {
    for (const d of [this.askDrawer, this.aboutDrawer]) { d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); }
    this.wrap.classList.remove('drawer-open');
  }

  // ---------------------------------------------------------------- pacer widget
  pacer() {
    const ring = h('div', { class: 'pf-ring' }, h('div', { class: 'pf-ring-in' }));
    const phase = h('div', { class: 'pf-phase', text: 'Ready' });
    const sub = h('div', { class: 'pf-sub', text: '' });
    const breath = h('div', { class: 'pf-breath', text: '' });
    const bar = h('div', { class: 'pf-bar' }, h('i'));
    const el = h('div', { class: 'pf-pacer' }, ring, h('div', { class: 'pf-pacer-t' }, phase, sub, breath, bar));
    return { el, ring, phase, sub, breath, bar: bar.firstChild };
  }

  dispose() { this._ro && this._ro.disconnect(); this.wrap.remove(); }
}
