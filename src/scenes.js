// The four scenes built on the procedural pelvis model, plus the public experience interface.
import * as THREE from 'three';
import { createPelvisModel } from './anatomy/model.js';
import { PfUI, h } from './ui.js';

export const SCENE_IDS = ['before', 'pregnancy', 'birth', 'solutions'];
const BASE = { pregnancy: 0, stretch: 0, laxity: 0, avulsion: 0, contraction: 0, pressure: 0, strength: 0, head: 0 };
const RATE = { pregnancy: 3.2, stretch: 3.4, laxity: 3, avulsion: 3, contraction: 8, pressure: 40, strength: 6, head: 2.2 };
const PREG_STOPS = [0, 0.22, 0.6, 1];                  // slider stage -> uterine growth
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const ease = (t) => t * t * (3 - 2 * t);
const bump = (t, c, w) => Math.exp(-(((t - c) / w) ** 2));

export async function createExperience({ uiRoot, camera, domElement, startCollapsed = true }) {
  let collapsedPref = startCollapsed !== false;
  let CONTENT = {};
  try { ({ CONTENT } = await import('./content.js')); } catch (e) { console.warn('content.js unavailable', e); }
  const SC = CONTENT.scenes || {};
  const model = await createPelvisModel();
  const experience = { root: model.root, lights: model.lights, model, layout: { bottom: 0, top: 0 }, onLayoutChange: null, onViewPreset: null, sceneId: null };
  const ui = new PfUI(uiRoot, CONTENT, {
    onLayout: (l) => { experience.layout = l; experience.onLayoutChange && experience.onLayoutChange(l); },
    onLabelClose: () => selectLabel(null),
  });

  // ------------------------------------------------------------ state
  const S = { ...BASE }, T = { ...BASE };
  let viewId = '3d', organMode = 'solid';
  let cough = null, lastCough = null, pacer = null, knack = null, sceneId = null;
  let readoutHook = null, labelsOn = true, SCENE_SNAP = false;
  const reset = (over = {}) => { Object.assign(T, BASE, over); Object.assign(S, BASE, over); cough = null; lastCough = null; pacer = null; knack = null; model.leak(0); };

  // ------------------------------------------------------------ cough model
  function coughOutcome(cVol) {
    const pregE = Math.pow(T.pregnancy, 1.5), lax = T.laxity, av = T.avulsion, st = T.strength;
    const reflex = clamp(0.55 + 0.4 * st - 0.35 * pregE - 0.35 * lax - 0.3 * av, 0.08, 1);
    const cPeak = Math.max(cVol, reflex);
    const closure = 0.62 + 0.3 * cPeak + 0.22 * st - 0.34 * pregE - 0.3 * lax - 0.28 * av;
    const margin = 0.7 - closure, leak = margin > 0.04;
    return { reflex, closure, margin, leak, drops: leak ? clamp(Math.round(3 + margin * 4), 3, 5) : 0 };
  }
  experience.coughOutcome = coughOutcome;
  function startCough(cVol = Math.max(T.contraction, 0)) {
    if (cough) return;
    cough = { t: 0, ...coughOutcome(cVol), fired: false, shown: false };
    lastCough = null; if (readoutHook) readoutHook(null);
  }
  function stepCough(dt, st, ex) {
    cough.t += dt; const t = cough.t;
    ex.wave = 17 - 21 * clamp(t / 0.6, 0, 1); ex.waveAmp = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.3);
    st.pressure = 0.7 * bump(t, 0.66, 0.2);
    st.contraction = Math.max(st.contraction, cough.reflex * bump(t, 0.55, 0.3));
    if (cough.leak) ex.uopen = 3.2 * bump(t, 0.85, 0.28);
    if (!cough.fired && t > 0.66) { cough.fired = true; if (cough.leak) model.leak(cough.drops); else if (!selectedLabel) model.setSelected('urethra'); }
    if (!cough.shown && t > 0.9) {
      cough.shown = true; lastCough = cough; if (readoutHook) readoutHook(cough);
      ui.banner(cough.leak ? 'Leak' : 'Held', cough.leak ? 'leak' : 'held', 3000);
    }
    if (cough.fired && !cough.leak && !selectedLabel && t > 1.5) model.setSelected(null);
    if (t > 2.1) { cough = null; if (!selectedLabel) model.setSelected(null); }
  }

  // ------------------------------------------------------------ shared controls
  const coughText = SC.before?.coughTest || {};
  const organsDefault = (v) => (v === '3d' || v === 'above' ? 'ghost' : 'solid');
  function setOrgans(mode) { organMode = mode; model.setOrganMode(mode); experience._orgSeg && experience._orgSeg.set(mode); refreshPins(); }
  function viewControl() {
    const opts = [{ id: '3d', label: '3D' }, { id: 'side', label: 'Side cut' }, { id: 'above', label: 'From above' }, { id: 'below', label: 'From below' }];
    const seg = ui.segmented(opts, viewId, (id) => setView(id)); experience._viewSeg = seg;
    const oseg = ui.segmented([{ id: 'solid', label: 'Solid' }, { id: 'ghost', label: 'Ghost' }, { id: 'hide', label: 'Hide' }], organMode, (m) => setOrgans(m)); experience._orgSeg = oseg;
    return ui.section('View', seg.el, h('div', { class: 'pf-sec-h', style: 'margin-top:10px', text: 'Organs' }), oseg.el);
  }
  function setView(id, keepOrgans) {
    viewId = id; model.setView(id); experience._viewSeg && experience._viewSeg.set(id);
    if (!keepOrgans) setOrgans(organsDefault(id)); else refreshPins();
    experience.onViewPreset && experience.onViewPreset(id);
  }
  function coughControl(label = 'Cough test') {
    const ro = ui.readout(); ro.set();
    readoutHook = (c) => {
      if (!c) { ro.set(); return; }
      ro.set(c.leak ? 'Leak: a few drops' : 'Held', c.leak ? (coughText.leakText || '') : (coughText.heldText || ''), c.leak ? 'leak' : 'held');
    };
    return ui.section('', ui.button(label, () => startCough(), 'primary block'), ro.el);
  }
  const noteList = (notes) => ui.details('More notes', notes);
  // keep the growing uterus in frame: e = 0 (not pregnant) .. 1 (full term)
  function frameFor(p, dy = 0) {
    const e = Math.pow(clamp(p, 0, 1), 1.1);
    model.setFraming({ side: { y: 2.4 + 10.4 * e + dy, z: -1.5 + 4.5 * e, zoom: 1.6 - 0.86 * e }, '3d': { y: 3 + 9 * e, z: -1 + 3 * e, zoom: 0.9 - 0.32 * e },
      above: { y: 4.2 + 6 * e, z: 0, zoom: 1.0 - 0.2 * e }, below: { y: 2.6, z: 0.4, zoom: 1.15 } });
  }

  // ------------------------------------------------------------ labels (pins + chips)
  let labelItems = [], selectedLabel = null;
  function selectLabel(id) {
    selectedLabel = id; ui.selectLabel(id); model.setSelected(id);
    ui.showInfo(labelItems.find((l) => l.id === id) || null);
    if (id) ui.sheetBody.scrollTop = 0;
  }
  function setLabelItems(items) { labelItems = items; selectedLabel = null; ui.setLabels(items, (id) => selectLabel(selectedLabel === id ? null : id)); ui.setLabelsVisible(labelsOn); model.setSelected(null); refreshPins(); }
  function refreshPins() { if (selectedLabel && !model.pinVisible(selectedLabel)) selectLabel(null); }

  // ------------------------------------------------------------ scenes
  const builders = {
    before() {
      const c = SC.before || {};
      reset(); ui.setHeader(c.title); model.setFasciaVisible(false);
      const info = ui.makeInfo(), chips = ui.makeChipRow();
      const lab = c.labels || {};
      const ids = ['pubicBone', 'sacrum', 'coccyx', 'bladder', 'urethra', 'uterus', 'vagina', 'rectum', 'pubococcygeus', 'puborectalis', 'iliococcygeus', 'coccygeus', 'perinealBody', 'fascia'];
      const items = ids.map((id) => ({ id, name: lab[id]?.name || id, term: lab[id]?.term, text: lab[id]?.text }));
      const show = (fascia) => setLabelItems(items.filter((i) => fascia || i.id !== 'fascia'));
      show(false); setView('3d');
      const tLab = ui.toggle('Show pins on the model', true, (v) => { labelsOn = v; ui.setLabelsVisible(v); if (!v) selectLabel(null); });
      const tFas = ui.toggle('Show connective tissue sheet', false, (v) => { model.setFasciaVisible(v); show(v); });
      ui.add(info, chips, ui.takeaway(c.takeaway), coughControl(), viewControl(), ui.section('', tLab.el, tFas.el), noteList(c.notes));
    },

    pregnancy() {
      const c = SC.pregnancy || {}, stages = c.stages || [];
      reset(); ui.setHeader(c.title); frameFor(0);
      model.setFasciaVisible(false); setLabelItems([]); setView('side');
      const stageRo = ui.readout();
      const pos2preg = (p) => { const i = Math.min(Math.floor(p), 2), f = p - i; return PREG_STOPS[i] + (PREG_STOPS[i + 1] - PREG_STOPS[i]) * f; };
      const update = (pos) => {
        T.pregnancy = pos2preg(pos); frameFor(T.pregnancy);
        const s = stages[Math.round(pos)] || {};
        stageRo.set(s.label ? s.label + (s.leakPct != null ? ` · about ${s.leakPct}% leak` : '') : '', s.text || '');
      };
      const sl = ui.slider({ min: 0, max: 3, step: 0.01, value: 0, ticks: stages.length === 4 ? stages.map((s) => s.label) : ['Not pregnant', 'T1', 'T2', 'T3'], aria: 'Stage of pregnancy', onInput: update });
      update(0);
      ui.add(ui.takeaway(c.takeaway), ui.section('Stage of pregnancy', sl.el, stageRo.el), coughControl(), viewControl(), ui.card('Hormones', c.hormones), noteList(c.notes));
    },

    birth() {
      const c = SC.birth || {};
      reset(); ui.setHeader(c.title); model.setFasciaVisible(false); setView('side');
      const steps = c.steps || [], types = c.birthTypes || [], rec = c.recovery || [];
      let step = 'before', recovery = 0, avul = false, type = types[0]?.id, avulShown = null;
      const info = ui.makeInfo();
      const stepRo = ui.readout(), recRo = ui.readout(), typeRo = ui.readout();
      const avBox = h('div', { class: 'pf-sec' }), recBox = h('div', { class: 'pf-sec' });
      const apply = () => {
        const s = steps.find((x) => x.id === step) || {};
        T.head = step === 'before' ? 0 : step === 'crowning' ? 1 : 2;
        T.pregnancy = step === 'before' ? 1 : step === 'crowning' ? 0.92 : 0.3 * (1 - 0.8 * recovery);
        frameFor(step === 'crowning' ? 1 : T.pregnancy, step === 'crowning' ? -4 : 0);
        T.stretch = step === 'crowning' ? 1 : step === 'after' ? 0.14 * (1 - recovery) : 0;
        T.laxity = step === 'after' ? 0.85 * (1 - 0.62 * recovery) : 0;
        T.avulsion = step === 'after' && avul ? 1 : 0;
        stepRo.set(s.label, s.text);
        avBox.style.display = step === 'after' ? '' : 'none'; recBox.style.display = step === 'after' ? '' : 'none';
        const r = recovery > 0.83 ? rec[2] : recovery > 0.5 ? rec[1] : recovery > 0.17 ? rec[0] : null;
        recRo.set(r ? r.label : '', r ? r.text : '');
        const showAv = step === 'after' && avul;   // only rebuild the pin when it appears or goes, so dragging the recovery slider keeps the card open
        if (showAv !== avulShown) {
          avulShown = showAv; selectLabel(null);
          setLabelItems(showAv ? [{ id: 'avulsion', name: 'Gap at the bone', text: c.avulsion?.text, term: c.avulsion?.label }] : []);
          if (showAv) selectLabel('avulsion');
        }
      };
      const stepSeg = ui.segmented(steps.map((s) => ({ id: s.id, label: s.label })), step, (id) => {
        step = id; if (id !== 'after') { recovery = 0; recSl.set(0); }
        setView(id === 'crowning' ? 'below' : 'side', true); setOrgans('solid'); apply();
      });
      const avT = ui.toggle(c.avulsion?.label || 'Muscle torn from bone', false, (v) => { avul = v; apply(); if (v) ui.sayToast('One side only: the muscle edge pulls back from the pubic bone'); });
      const recSl = ui.slider({ min: 0, max: 1, step: 0.01, value: 0, ticks: ['After birth', ...rec.map((r) => r.label)].slice(0, 4), aria: 'Recovery over time', onInput: (v) => { recovery = v; apply(); } });
      avBox.append(avT.el); recBox.append(h('div', { class: 'pf-sec-h', text: 'Recovery over time' }), recSl.el, recRo.el);
      const typeSeg = ui.segmented(types.map((t) => ({ id: t.id, label: t.label.replace(/ \(.*\)/, '').replace('Vaginal birth, no instruments', 'No instruments') })), type, (id) => { const t = types.find((x) => x.id === id); typeRo.set(t?.label, t?.text); }, 'wrap');
      typeRo.set(types[0]?.label, types[0]?.text);
      ui.add(info, ui.takeaway(c.takeaway), ui.section('Step', stepSeg.el, stepRo.el), avBox, recBox, viewControl(), ui.section('Birth type and avulsion risk', typeSeg.el, typeRo.el));
      apply();
    },

    solutions() {
      const c = SC.solutions || {};
      const prog = c.program || { slow: { holdSec: 5, restSec: 4, reps: 8 }, fast: { reps: 5 }, perDay: 3 };
      reset({ laxity: 0.62 }); ui.setHeader(c.title); model.setFraming({ side: { y: 2.0, z: -1.2, zoom: 1.5 } }); model.setFasciaVisible(false); setLabelItems([]); setView('side');
      const cap = () => 0.6 + 0.4 * T.strength;
      const pc = ui.pacer(); experience._pacer = pc;
      const startBtn = ui.button('Start guided session', () => { if (pacer) stopPacer(); else startPacer(); }, 'accent block');
      const cues = c.cues || [];
      function buildPhases() {
        const ph = [], s = prog.slow || {}, f = prog.fast || {};
        for (let r = 1; r <= (s.reps || 8); r++) {
          const n = s.reps || 8;
          ph.push({ k: 'squeeze', dur: 1.3, rep: r, n, type: 'slow' }, { k: 'hold', dur: s.holdSec || 5, rep: r, n, type: 'slow' }, { k: 'release', dur: 1.2, rep: r, n, type: 'slow' }, { k: 'rest', dur: s.restSec || 4, rep: r, n, type: 'slow' });
        }
        for (let r = 1; r <= (f.reps || 5); r++) ph.push({ k: 'quick', dur: 1.0, rep: r, n: f.reps || 5, type: 'fast' });
        return ph;
      }
      function startPacer() { clearDemos(); pacer = { ph: buildPhases(), i: 0, t: 0 }; startBtn.textContent = 'Stop'; startBtn.classList.remove('accent'); }
      function stopPacer() { pacer = null; T.contraction = 0; startBtn.textContent = 'Start guided session'; startBtn.classList.add('accent'); pc.phase.textContent = 'Ready'; pc.sub.textContent = ''; pc.breath.textContent = ''; pc.bar.style.width = '0%'; pc.ring.firstChild.style.transform = 'scale(.35)'; }
      experience._pacerStart = startPacer;
      experience._pacerStep = (dt) => {
        if (!pacer) return;
        pacer.t += dt;
        let p = pacer.ph[pacer.i];
        while (p && pacer.t >= p.dur) { pacer.t -= p.dur; pacer.i++; p = pacer.ph[pacer.i]; }
        if (!p) { stopPacer(); pc.phase.textContent = 'Well done'; pc.sub.textContent = `Up to ${prog.perDay || 3} sessions a day is a common guide`; return; }
        const f = pacer.t / p.dur; let lvl = 0, label = '';
        if (p.k === 'squeeze') { lvl = ease(f); label = 'Squeeze and lift'; }
        else if (p.k === 'hold') { lvl = 1; label = 'Hold'; }
        else if (p.k === 'release') { lvl = 1 - ease(f); label = 'Let go'; }
        else if (p.k === 'rest') { lvl = 0; label = 'Rest'; }
        else { lvl = f < 0.35 ? ease(f / 0.35) : 1 - ease((f - 0.35) / 0.65); label = 'Quick squeeze'; }
        T.contraction = lvl * cap();
        pc.ring.firstChild.style.transform = `scale(${0.35 + 0.65 * lvl})`;
        pc.phase.textContent = label;
        pc.sub.textContent = (p.type === 'slow' ? 'Slow hold ' : 'Quick squeeze ') + `${p.rep} of ${p.n}` + (p.k === 'hold' ? ` · ${Math.ceil(p.dur - pacer.t)}s` : '');
        pc.breath.textContent = p.k === 'hold' || p.k === 'rest' ? (cues[2] || 'Keep breathing normally.') : (p.k === 'release' ? (cues[3] || '') : '');
        const total = pacer.ph.reduce((a, q) => a + q.dur, 0); let done = pacer.t; for (let k = 0; k < pacer.i; k++) done += pacer.ph[k].dur;
        pc.bar.style.width = (100 * done / total).toFixed(1) + '%';
      };
      const clearDemos = () => { mistakeSeg.set(''); if (!pacer) T.contraction = 0; mistBox.style.display = 'none'; mT.set(false); };
      const mistBox = h('div', { class: 'pf-sec', style: 'display:none' });
      const mistakeSeg = ui.segmented([{ id: 'lift', label: 'Correct: lift' }, { id: 'down', label: 'Wrong: bearing down' }], 'down', (id) => { T.contraction = id === 'lift' ? 0.95 * cap() : -1; });
      const mT = ui.toggle('Common mistakes', false, (v) => {
        if (v) { if (pacer) stopPacer(); mistBox.style.display = ''; mistakeSeg.set('down'); T.contraction = -1; }
        else { mistBox.style.display = 'none'; T.contraction = 0; }
      });
      mistBox.append(mistakeSeg.el, h('div', { class: 'pf-mist' }, (c.mistakes || []).map((m) => h('div', {}, h('b', { text: m.label }), m.text))));
      const knackBtn = ui.button(c.knack?.label || 'The Knack', () => { if (cough || knack) return; if (pacer) stopPacer(); knack = { t: 0, started: false }; }, 'primary block');
      const weeks = ui.slider({ min: 0, max: 12, step: 1, value: 0, label: 'Weeks of training: 0', aria: 'Weeks of training', onInput: (w) => { T.strength = w / 12; T.laxity = 0.62 * (1 - 0.6 * T.strength); weeks.label(`Weeks of training: ${w}`); } });
      const hl = CONTENT.meta?.helpline || {};
      const help = h('div', { class: 'pf-card pf-help-card' }, h('div', { class: 'pf-card-t', text: 'When to get help' }),
        h('ul', { class: 'pf-cues' }, (c.getHelp || []).map((t) => h('li', { text: t }))),
        hl.name ? h('div', {}, h('div', { class: 'pf-sub', text: hl.name }), hl.phone ? h('a', { class: 'pf-phone', href: 'tel:' + String(hl.phone).replace(/\s+/g, ''), text: hl.phone }) : null, hl.note ? h('p', { text: hl.note }) : null) : null);
      ui.add(ui.takeaway(c.takeaway),
        ui.section('Guided exercise', c.program?.caution ? h('p', { class: 'pf-note', text: c.program.caution }) : null, pc.el, startBtn),
        viewControl(),
        ui.section('', h('p', { class: 'pf-sub', text: c.program?.text }), h('ul', { class: 'pf-cues' }, cues.map((t) => h('li', { text: t })))),
        ui.section('', mT.el, mistBox),
        ui.section(c.knack?.label || 'The Knack', ui.card('', c.knack?.text), knackBtn),
        ui.section('Train it, then test it', c.trainNote ? h('p', { class: 'pf-note', text: c.trainNote }) : null, weeks.el, coughControl()),
        c.timeline ? ui.card('How long does it take?', c.timeline) : null, help);
    },
  };

  experience.setScene = (id) => {
    if (!builders[id]) id = 'before';
    sceneId = id; experience.sceneId = id; experience._pacerStep = null; experience._pacer = null; experience._pacerStart = null;
    readoutHook = null; labelsOn = true; ui.closeDrawers(); ui.clearSheet(); ui.showInfo(null); ui.infoEl = null; ui.chipRow = null;
    model.setFraming(null); selectedLabel = null; model.setSelected(null); organMode = 'solid';
    builders[id]();
    ui.toggleSheet(collapsedPref);
    model.applyState(S, { wave: -99, waveAmp: 0, hot: 0 }, 1);
    SCENE_SNAP = true;
  };

  // ------------------------------------------------------------ frame update
  const pts = new Map(), _v = new THREE.Vector3();
  experience.update = (dt = 0.016) => {
    dt = clamp(dt, 0.001, 0.1);
    if (knack) {
      knack.t += dt; T.contraction = 0.95 * (0.6 + 0.4 * T.strength);
      if (!knack.started && knack.t > 0.5) { knack.started = true; startCough(T.contraction); }
      if (knack.t > 2.7) { knack = null; T.contraction = 0; }
    }
    experience._pacerStep && experience._pacerStep(dt);
    for (const k of Object.keys(RATE)) S[k] += (T[k] - S[k]) * (SCENE_SNAP ? 1 : 1 - Math.exp(-dt * RATE[k]));
    SCENE_SNAP = false;
    const st = { ...S }; const ex = { wave: -99, waveAmp: 0, hot: sceneId === 'birth' ? clamp(S.stretch, 0, 1) : 0, uopen: 0 };
    if (cough) stepCough(dt, st, ex);
    const hide = S.head > 0.55 && S.head < 1.8;                 // the stretched birth canal is not modelled: hide it while the head passes
    model.meshes.uterus.visible = model.organMode !== 'hide';
    model.meshes.vagina.visible = !hide && model.organMode !== 'hide';
    for (const k of ['uterus', 'vagina']) model.capMeshes[k].visible = model.meshes[k].visible;
    model.applyState(st, ex, dt);
    model.updateDrops(dt);
    updateLabels();
  };

  function updateLabels() {
    if (!labelItems.length) return;
    const r = uiRoot.getBoundingClientRect(); const W = r.width, H = r.height;
    const vis = model.isVisible() && W > 0 && labelsOn;
    camera.updateMatrixWorld();
    pts.clear();
    for (const it of labelItems) {
      const avail = it.id === 'avulsion' || model.pinVisible(it.id);
      const p = vis && avail ? model.projectAnchor(it.id, camera, _v) : null;
      const ok = p && p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.1 && Math.abs(p.y) < 1.1;
      pts.set(it.id, ok ? { x: (p.x * 0.5 + 0.5) * W, y: (-p.y * 0.5 + 0.5) * H, vis: true, avail } : { vis: false, avail });
    }
    ui.updateLabels(pts, W, H, (experience.layout.top || 0) + 6, experience.layout.bottom || 0);
  }

  experience.onPointer = (ndcX, ndcY) => {
    if (!labelItems.length || !labelsOn) return false;
    let best = null, bd = 0.08;
    for (const it of labelItems) { if (it.id !== 'avulsion' && !model.pinVisible(it.id)) continue; const p = model.projectAnchor(it.id, camera, _v); if (!p) continue; const d = Math.hypot(p.x - ndcX, p.y - ndcY); if (d < bd) { bd = d; best = it.id; } }
    if (best) { selectLabel(selectedLabel === best ? null : best); return true; }
    return false;
  };

  /** true = compact sheet (<= 34% of the screen, handle + takeaway + primary control); false = expanded. */
  experience.setSheetCollapsed = (c) => { collapsedPref = !!c; ui.toggleSheet(!!c); };
  experience.dispose = () => { ui.dispose(); model.dispose(); };
  experience.debug = { S, T, startCough, setView, setOrgans, ui, model, selectLabel, get cough() { return cough; }, get lastCough() { return lastCough; }, startPacer: () => experience._pacerStart && experience._pacerStart() };
  experience.setScene('before');
  return experience;
}
