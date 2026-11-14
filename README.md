# Pelvic Floor AR

Static AR explainer: scan a QR code, point a phone at one of four printed A4 sheets, and a 3D pelvic floor model appears on the paper.
No build step, no CDN. `three@0.160.0` and `mind-ar@1.2.5` are self-hosted in `vendor/`. See `docs/SPEC.md`.

## Run locally

```
python3 -m http.server 8137        # or: node tools/static-server.mjs 8137
```

Camera access needs HTTPS or `localhost`. Useful query strings on `index.html`:

| Query | Effect |
| --- | --- |
| `?stub=1` | use `tools/stub-experience.js` (labelled placeholder box) instead of `src/scenes.js` |
| `?sw=1` | register the service worker on localhost (it is skipped there by default so dev is never stale) |
| `?inapp=1` | force the in-app-browser warning overlay |
| `?nofallback=1` | on failure, log instead of redirecting to `viewer.html?notice=camera` |

## Regenerate everything (marker art, targets, QR, printable sheets)

```
npm install
npm run build:all
```

Individual steps (run in this order; each reads the output of the one before):

| Command | Writes |
| --- | --- |
| `npm run markers` | `markers/sheet-1..4.png` (1440 x 1840, 8 px/mm) and `markers/src/sheet-*.svg`. Seeded, so output is identical every run. |
| `npm run compile` | `markers/targets.mind` and `markers/feature-report.json` (headless Chrome + MindAR's browser compiler; exits non-zero if a target is feature-poor or clustered) |
| `npm run qr` | `markers/qr-slide.png` (1804 px) and `markers/qr-sheet.png` (small, printed on sheets). Error correction M, quiet zone 4 modules |
| `npm run sheets` | `markers/print/sheet-1..4.pdf` and `markers/print/all-sheets.pdf` (A4, art at exactly 180 x 230 mm) |

**Changing the URL:** edit `QR_URL` in `tools/config.mjs`, then `npm run qr && npm run sheets` (or `npm run build:all`).
Sheet titles and art size are in the same file. Re-running `npm run markers` changes the art, so you must then re-run `compile` and `sheets`, and reprint:
the PDFs embed the identical PNG that was compiled.

Needs Google Chrome at `/Applications/Google Chrome.app` (override with `CHROME_PATH=...`) for `compile` and `sheets`.

## Testing without a phone

```
node tools/make-fake-camera.mjs     # needs ffmpeg; builds MJPEG feeds into tools/.fake-camera/ (git-ignore it, ~250 MB)
node tools/test-ar.mjs              # headless Chrome, fake camera, stub experience; screenshots to docs/shots/ar/
node tools/test-ar.mjs --real       # same against src/scenes.js
```

## Service worker

`sw.js` precaches the shell, the vendor files that are used and `markers/targets.mind`. Vendor and targets are cache-first; the shell
is served from cache and refreshed in the background; everything else is network-first with cache fallback. Bump `CACHE_VERSION` in `sw.js`
on each deploy. All URLs are resolved against the SW scope, so it works under `/pelvic-floor-ar/`.

## Publishing notes

- Host over HTTPS (GitHub Pages is fine); getUserMedia will not work over plain HTTP.
- Print `markers/print/all-sheets.pdf` at 100% / "Actual size" (not "fit to page"). Matte paper tracks better than gloss.
- Real-phone testing (iOS Safari, Android Chrome) is still required before the talk.

## 3D model

The bony pelvis and the fetal form are sculpted as signed distance fields and baked to compact meshes; organs and
muscles are generated at load time (`src/anatomy/`).

```
node tools/bake-bones.mjs          # -> src/anatomy/bones.bin, fetus.bin  (bones | fetus to bake one)
node tools/shots.mjs [filter]      # headless screenshots of every scene state -> docs/shots/
npm run test:ar                    # AR page against a fake camera (run node tools/make-fake-camera.mjs first)
```

In AR the model stands on the sheet when viewed at an angle and lies back on the page when the phone is held
straight above it. Bump `CACHE_VERSION` in `sw.js` on every deploy.
