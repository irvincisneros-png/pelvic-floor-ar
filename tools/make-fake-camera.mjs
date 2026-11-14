// Builds MJPEG fake-camera feeds from the marker PNGs for headless Chrome testing.
// Usage: node tools/make-fake-camera.mjs [outDir]    (needs ffmpeg)
// Chrome flags: --use-fake-device-for-media-stream --use-fake-ui-for-media-stream --use-file-for-fake-video-capture=<outDir>/m1.mjpeg
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from './config.mjs';

const out = path.resolve(process.argv[2] || path.join(ROOT, 'tools', '.fake-camera'));
fs.mkdirSync(out, { recursive: true });
const W = 720, H = 1280, FPS = 15, BG = '0x8d8a84';

function ff(args) { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args]); }

// A portrait phone frame: marker 520 px wide on neutral grey, gently swaying perspective warp (like a hand-held phone).
function segment(file, markerN, seconds, tilt = false) {
  const f = path.join(out, file);
  if (markerN == null) {
    ff(['-f', 'lavfi', '-i', `color=c=${BG}:s=${W}x${H}:r=${FPS}`, '-t', String(seconds), '-c:v', 'mjpeg', '-q:v', '3', '-f', 'mjpeg', f]);
    return f;
  }
  const m = path.join(ROOT, 'markers', `sheet-${markerN}.png`);
  const sw = (a, ph) => `${a}*sin(on/${ph})`;
  // tilt: phone held low over a table, sheet in the upper part of the frame (above the bottom sheet UI), far edge pulled in
  const P = tilt
    ? `x0='190+${sw(6, 9)}':y0='200+${sw(6, 11)}':x1='W-190+${sw(6, 13)}':y1='200+${sw(6, 7)}':x2='70+${sw(6, 10)}':y2='680+${sw(6, 8)}':x3='W-70+${sw(6, 12)}':y3='680+${sw(6, 9)}'`
    : `x0='40+${sw(10, 9)}':y0='110+${sw(8, 11)}':x1='W-50+${sw(10, 13)}':y1='70+${sw(8, 7)}':x2='60+${sw(8, 10)}':y2='H-90+${sw(8, 8)}':x3='W-30+${sw(8, 12)}':y3='H-130+${sw(10, 9)}'`;
  const filter = [
    `[0:v]scale=540:-1[mk]`,
    `[1:v][mk]overlay=(W-w)/2:(H-h)/2[fr]`,
    `[fr]perspective=eval=frame:sense=destination:interpolation=linear:${P}[o]`,
  ].join(';');
  ff(['-loop', '1', '-framerate', String(FPS), '-i', m, '-f', 'lavfi', '-i', `color=c=${BG}:s=${W}x${H}:r=${FPS}`,
    '-filter_complex', filter, '-map', '[o]', '-t', String(seconds), '-c:v', 'mjpeg', '-q:v', '3', '-f', 'mjpeg', f]);
  return f;
}
const cat = (name, parts) => fs.writeFileSync(path.join(out, name), Buffer.concat(parts.map((p) => fs.readFileSync(p))));

const seg = {};
for (const n of [1, 2, 3, 4]) seg[n] = segment(`seg-${n}.mjpeg`, n, 6);
const blank = segment('seg-blank.mjpeg', null, 4);
for (const n of [1, 2, 3, 4]) cat(`m${n - 1}.mjpeg`, [seg[n], seg[n]]);              // marker only, scene index n-1
cat('lost.mjpeg', [seg[2], blank]);                                                     // marker 1 (pregnancy) then nothing, looping
cat('switch.mjpeg', [seg[1], blank, seg[3], blank, seg[2]]);                           // 0 -> lost -> 2 -> lost -> 1
const tiltSeg = segment('seg-tilt.mjpeg', 2, 8, true);
cat('tilt.mjpeg', [tiltSeg, tiltSeg]);                                                   // sheet 2 viewed at a shallow angle
cat('blank.mjpeg', [blank, blank]);
console.log('fake camera feeds in', out, fs.readdirSync(out).filter((f) => f.startsWith('m') || f === 'lost.mjpeg' || f === 'switch.mjpeg' || f === 'blank.mjpeg').join(', '));
