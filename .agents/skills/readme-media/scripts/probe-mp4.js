#!/usr/bin/env node
/**
 * Print ffprobe stream/format info for an MP4 and optionally dump sample frames as PNG.
 *
 * Usage (from repo root):
 *   node .agents/skills/readme-media/scripts/probe-mp4.js docs/tactical-board-demo.mp4 [outDir]
 * When outDir is given, one frame per second is written there as frame_01.png, frame_02.png, ...
 */
const fs = require('fs');
const path = require('path');

const [input, outDir] = process.argv.slice(2);
if (!input) {
  console.error('Usage: probe-mp4.js <file.mp4> [outDir]');
  process.exit(1);
}

global.self = { location: { href: 'file:///ffmpeg' } };
const root = process.cwd();
const createFFmpegCore = require(path.join(root, 'node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.js'));
const wasmBinary = fs.readFileSync(path.join(root, 'node_modules/@ffmpeg/core/dist/umd/ffmpeg-core.wasm'));

createFFmpegCore({ wasmBinary }).then((core) => {
  core.setLogger((m) => { if (m.type === 'stdout') console.log(m.message); });
  core.FS.writeFile('in.mp4', fs.readFileSync(input));
  core.ffprobe('-v', 'error', '-show_entries',
    'stream=codec_name,profile,width,height,pix_fmt,sample_aspect_ratio,r_frame_rate,duration:format=format_name,duration,size:format_tags=major_brand',
    'in.mp4');
  core.reset();
  if (outDir) {
    core.setLogger(() => {});
    core.exec('-i', 'in.mp4', '-vf', 'fps=1', 'frame_%02d.png');
    fs.mkdirSync(outDir, { recursive: true });
    for (let i = 1; i < 100; i++) {
      const name = `frame_${String(i).padStart(2, '0')}.png`;
      if (!core.FS.analyzePath(name).exists) break;
      fs.writeFileSync(path.join(outDir, name), Buffer.from(core.FS.readFile(name)));
    }
    console.log('Frames written to', outDir);
  }
});
