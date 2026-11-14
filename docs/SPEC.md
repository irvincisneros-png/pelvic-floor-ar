# Pelvic Floor AR — design spec

Interactive AR explainer used inside a live presentation (Australia) about the pathway from a patient
continence survey to a pelvic health physio referral. Audience scans a QR code on their own phone, points
it at printed A4 sheets, and a 3D pelvic model appears on the paper. It must answer audience questions so
the presenter is not swamped. Audience: adults, mixed clinical / non-clinical. Tone: calm, plain-language,
clinical-diagram respectful. Not medical advice (say so in the About panel).

Planned public URL (not yet published): `https://irvincisneros-png.github.io/pelvic-floor-ar/`

## Stack (decided — do not change)

- Static site, **no build step**, plain ES modules + importmap. Hosted on GitHub Pages later.
- `three@0.160.0` and `mind-ar@1.2.5`, **self-hosted** in `vendor/` (copy from `node_modules`, including the
  whole `mind-ar/dist/` folder so lazy chunks resolve). No CDN at runtime. No bundler (MindAR breaks under esbuild).
- Image tracking: `MindARThree` from `mindar-image-three.prod.js`, one `targets.mind` with 4 targets, `maxTrack: 1`.
- Every dependency and asset relative-pathed so it works under a `/pelvic-floor-ar/` subpath.
- Dev server: `python3 -m http.server` style static serving (add `.claude/launch.json`, name `pelvic-floor-ar`, port 8137).

## Files and ownership

```
index.html            landing: Start AR button, "No camera? Explore in 3D" link, in-app-browser warning   [AR agent]
viewer.html           non-AR orbit viewer with scene picker (also the camera-failure fallback)             [Model agent]
styles.css            shared UI styles                                                                    [Model agent]
src/anatomy/          procedural 3D pelvis model + materials                                              [Model agent]
src/scenes.js         the 4 scenes built on the model (public interface below)                            [Model agent]
src/ui.js             HTML overlay UI: panels, sliders, buttons, labels, FAQ drawer                         [Model agent]
src/viewer.js         orbit-viewer bootstrap                                                              [Model agent]
src/content.js        ALL on-screen copy, numbers and sources                                             [Content agent]
src/ar.js             MindAR bootstrap, anchors, freeze, lost-tracking handling                            [AR agent]
markers/              marker art (SVG source + PNG), targets.mind, printable A4 PDFs, QR                    [AR agent]
tools/                marker generator + target compiler scripts                                           [AR agent]
vendor/               three + mind-ar                                                                      [AR agent installs; Model agent may read]
```

Agents must stay inside their own files. If something outside is needed, report it rather than editing it.

## The four sheets / scenes

Scene ids and target indices are fixed: `0 before`, `1 pregnancy`, `2 birth`, `3 solutions`.

1. **before — "Meet your pelvic floor"**
   Model at baseline. Tappable labels for: pubic bone, sacrum/coccyx, bladder, urethra, uterus, vagina, rectum,
   pelvic floor (three levator ani parts in 3 related colours: pubococcygeus, puborectalis, iliococcygeus), coccygeus,
   perineal body. Toggle: side cutaway / view from above / view from below (shows the three openings).
   **Cough test** button: pressure wave comes down from the abdomen, pelvic floor lifts and squeezes, urethra stays
   closed — "held". This is the reference behaviour for every later scene.
2. **pregnancy — "Nine months of load"**
   Slider: not pregnant → trimester 1 → 2 → 3. Uterus grows, bladder is compressed, pelvic floor sags gradually,
   bladder neck drops slightly. Readout shows share of women who leak at that stage. Cough test now leaks a few drops
   at T3. Short note on hormones softening connective tissue (kept qualitative).
3. **birth — "Birth and after"**
   Step control: before birth → crowning (pelvic floor stretches up to about 3× around a simple head shape; the
   innermost muscle highlights) → after birth (muscle lax, wider opening, optional "muscle torn from bone" toggle
   shown on one side) → recovery timeline scrubber (6 weeks, 3 months, 12 months) with partial recovery.
   Birth-type chips (unassisted / vacuum / forceps / caesarean) change the risk readout only, not graphic detail.
   The baby is a smooth, featureless curled form (no face). No blood.
4. **solutions — "Train it back"**
   Guided trainer: on-screen pacer "squeeze and lift … hold … let go", model contracts in time (lift + openings narrow),
   breathing cue, rep counter (slow holds then quick squeezes). "Common mistakes" toggle shows bearing down (floor
   pushes down — wrong) vs correct lift. **The Knack**: squeeze just before a cough, then cough test → held.
   Strength slider (weeks of training) shows cough test going from leak to held. "When to get help" card with helpline.

Every scene also has: a title, a one-sentence takeaway, an **Ask** drawer (FAQ + myths, searchable list of
short answers), and an About/credits/sources panel. Copy comes only from `src/content.js`.

## Model requirements (visual bar is high)

Owner wants polished, real-looking 3D of molecular-animation quality — organic irregular forms, soft fleshy
materials, never plain primitives or flat toy colours. No AI-generated images.

- Hand-authored geometry, no external model downloads (bones and fetal form baked from signed distance fields by
  `tools/bake-bones.mjs`; organs and muscles procedural in Three.js): bony pelvis (two hip bones, sacrum,
  coccyx, pubic symphysis) with believable female proportions (wide subpubic arch, wide inlet); bladder, urethra,
  uterus, vagina, rectum as soft organic forms; levator ani as a real bowl/sling of fibre-direction muscle sheets
  (three parts, separately meshed and coloured) with the urogenital opening; coccygeus; perineal body; faint
  endopelvic fascia sheet. Fibre striation via procedural normal/colour detail in shaders or generated canvas textures.
- Deformation is parametric, driven by one state object (below): vertex-shader or CPU morphs for sag, stretch,
  lift/squeeze, uterus growth, bladder compression. Smoothly interpolated, never popping.
- Half-transparent bone and a clean sagittal cutaway mode so the muscle is always readable.
- Model root is authored in a unit box: width ≈ 1, sitting on the XZ plane (y up), centred at origin, so the AR
  layer can place it on a sheet whose width = 1 unit.
- Budget (shared GPU with the tracker): ≤ 80k triangles visible, ≤ 30 draw calls, textures ≤ 1024, no shadows maps,
  no transmission, no post-processing, pixel ratio capped at 1.5. Must hold 30 fps on a mid-range phone.
- Asset swap point: bones and organs are created through `src/anatomy/parts.js` factory functions so a real scanned
  mesh can replace a procedural one later without touching scenes.

### Public interface (Model agent implements, AR agent consumes)

```js
// src/scenes.js
export const SCENE_IDS = ['before', 'pregnancy', 'birth', 'solutions'];
export async function createExperience({ uiRoot, camera, domElement }) -> experience
// experience.root        THREE.Group — the model, unit-box convention above. Caller adds it to a scene/anchor.
// experience.setScene(id) switch scene: resets model state and rebuilds the UI for that scene
// experience.update(dt)   call every frame
// experience.lights       THREE.Group of lights the caller should add to its scene
// experience.onPointer(ndcX, ndcY)  optional raycast hook for label taps
// experience.dispose()
```

Model state (internal, but keep it one plain object): `pregnancy 0..1`, `stretch 0..1`, `laxity 0..1`,
`avulsion 0|1`, `contraction -1..1` (negative = bearing down), `pressure 0..1`, `strength 0..1`, `view`.
Leak logic: leak when `pressure` exceeds closure, where closure rises with `contraction` and `strength` and falls
with `pregnancy`, `laxity`, `avulsion`.

UI is plain HTML overlay inside `uiRoot` (works identically in AR and viewer): bottom sheet with large touch
targets (≥ 44 px), readable at 375 px wide, portrait. Labels are HTML elements positioned by projecting 3D points.

## AR layer

- `index.html`: pre-permission screen ("Allow camera when asked"), Start AR button (camera start must be inside the
  tap handler), link to `viewer.html`. Detect in-app browsers by UA
  (`Instagram|FBAN|FBAV|MicroMessenger|Line/|TikTok|musical_ly|BytedanceWebview`) → overlay "Open in Safari/Chrome" + copy link.
- On target found: `experience.setScene(SCENE_IDS[i])`, attach `experience.root` to that anchor's group, laid flat on
  the sheet and standing up from it; scale so the model is about 0.8 of sheet width.
- On target lost: hold last pose ~400 ms, then show "Point at a sheet" hint. Keep UI state.
- **Freeze** button: detach from the anchor and pin the model in front of the camera with drag-to-rotate, so people can
  explore without holding the phone over the paper. Unfreeze returns to tracking.
- Start with `filterMinCF: 0.0005, filterBeta: 500, warmupTolerance: 3, missTolerance: 8`.
- Any failure (permission denied, getUserMedia throws, MindAR error) → redirect to `viewer.html` with a short notice.
- Screen wake lock in try/catch. Portrait only. Service worker precaching the shell + vendor + targets (versioned cache name).

## Markers and print

- 4 marker images, generated by script as SVG → PNG (≥ 1400 px wide, aspect 190:277), **not** AI images: dense,
  asymmetric, high-contrast illustrative patterns reaching the edges, each sheet clearly different in layout and hue,
  no large flat areas, no small text inside the tracked area.
- 4 printable A4 PDFs: the tracked art centred at 190 × 277 mm is too large to leave a margin — use tracked art
  180 × 230 mm, with a white margin holding the sheet number, title ("1 · Meet your pelvic floor"), one line of
  instruction and the QR code (same QR on every sheet, outside the tracked area). Compile targets from exactly the
  art that is printed.
- One slide-ready QR PNG (large, error correction M, quiet zone ≥ 4 modules) for the planned URL above.
- `markers/targets.mind` compiled from the 4 PNGs in scene order.

## Content rules

- Only figures that the content agent has checked against the source go on screen; each has a source URL in
  `content.js`. Where evidence is weak or sources disagree, the copy says "about" / "in one study" or drops the number.
- No overclaiming for exercises: training in pregnancy lowers leaking in late pregnancy and the first 6 months after
  birth; evidence that it cures established postnatal leaking is weaker; in adult women generally it works well.
- Never advise caesarean as prevention. Always "common, not normal, and treatable". Australian spelling.
