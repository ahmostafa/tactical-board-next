#!/usr/bin/env node
/**
 * Convert an MP4 (or a numbered PNG sequence) into a palette-optimised looping GIF
 * using the project's own @ffmpeg/core (no system ffmpeg needed).
 *
 * Usage (run from the repo root):
 *   node .agents/skills/readme-media/scripts/make-gif.js <input.mp4> <output.gif> [fps=20] [width=840]
 *   node .agents/skills/readme-media/scripts/make-gif.js "docs/frames/f_%04d.png" docs/out.gif 10 840
 */
const fs = require('fs');
const path = require('path');

const [input, output, fpsArg, widthArg] = process.argv.slice(2);
if (!input || !output) {
  console.error('Usage: make-gif.js <input.mp4|pattern.png> <output.gif> [fps] [width]');
  process.exit(1);
}
const fps = Number(fpsArg || 20);
const width = Number(widthArg || 840);

// ffmpeg-core's UMD build expects a worker-like global
global.self = { location: { href: 'file:///ffmpeg' } };
const root = process.cwd();
const createFFmpegCore = require(path.join(root, 'node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js'));
const wasmBinary = fs.readFileSync(path.join(root, 'node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm'));

createFFmpegCore({ wasmBinary }).then((core) => {
  const isSequence = input.includes('%');
  let inName;
  let rate = [];
  if (isSequence) {
    const dir = path.dirname(input);
    const re = new RegExp('^' + path.basename(input).replace('%04d', '\\d{4}').replace('.', '\\.') + '$');
    fs.readdirSync(dir).filter((f) => re.test(f)).forEach((f) => core.FS.writeFile(f, fs.readFileSync(path.join(dir, f))));
    inName = path.basename(input);
    rate = ['-framerate', String(fps)];
  } else {
    inName = 'in.mp4';
    core.FS.writeFile(inName, fs.readFileSync(input));
  }
  const vf =
    `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];` +
    '[s0]palettegen=max_colors=256:stats_mode=diff[p];' +
    '[s1][p]paletteuse=dither=bayer:bayer_scale=5';
  core.exec(...rate, '-i', inName, '-vf', vf, '-loop', '0', 'out.gif');
  if (core.ret !== 0) {
    console.error('ffmpeg failed, ret =', core.ret);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, Buffer.from(core.FS.readFile('out.gif')));
  console.log(`Wrote ${output} (${fs.statSync(output).size} bytes)`);
});
