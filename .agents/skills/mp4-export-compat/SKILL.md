---
name: mp4-export-compat
description: Diagnose and fix exported MP4 problems (0 byte file, error 0xc10100be, won't open in Windows Media Player or Movies & TV, odd dimensions). Use when touching exportMp4() or the FFmpeg.wasm encode settings.
---

# MP4 export: how it works and what must hold

`exportMp4()` in `src/app/pitch-board/pitch-board.component.ts`:
1. Loads `@ffmpeg/core` through Angular's bundler: `import('@ffmpeg/core')` plus `new URL('@ffmpeg/core/wasm', import.meta.url)` (no worker, no `/ffmpeg/worker.js`).
2. Renders each video frame from the Konva stage (`stage.draw()` then `toDataURL({ pixelRatio: 1/scale })`) into MEMFS as `f_%04d.png`. 30 fps, 0.4 s hold, `stepDuration` per transition, 0.6 s hold.
3. Encodes with libx264 + silent AAC into `tactical-board.mp4` and downloads a Blob.

## Required encode settings (verified on Windows 11)
```
-vf scale=1280:720:force_original_aspect_ratio=decrease:flags=lanczos,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=#111827,setsar=1,format=yuv420p
-c:v libx264 -preset veryfast -profile:v main -level 3.1 -bf 0 -crf 20 -pix_fmt yuv420p
-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv
+ silent stereo AAC (anullsrc, -t <duration>, -shortest)   -brand mp42  -movflags +faststart
```
Why: macroblock-aligned 1280x720, square SAR, Main profile, colour tags, AAC track and `mp42` brand are what the Windows 11 Media Player / Movies & TV accept. The old Windows Media Player is more tolerant, so "opens in the old player only" means one of these is violated.

## Known failure modes
| Symptom | Cause | Fix |
| :--- | :--- | :--- |
| 0 B file | PNG height odd (e.g. 679) and `libx264` fails with `height not divisible by 2` | Always scale/pad to fixed even size |
| `0xc10100be` in new player, works in old | non-aligned size, `SAR 680:679`, no audio, `isom` brand, untagged colour | settings above |
| `mpeg4` fallback won't play | MPEG-4 Part 2 is not supported by new Windows player | fallback must also be H.264 (baseline 3.0) |
| `Encoded MP4 is empty` | encode failed | check `core.setLogger` stderr; make sure `core.reset()` runs between execs |

## Reproduce and test without the browser
```powershell
node .agents/skills/readme-media/scripts/probe-mp4.js <file.mp4>
powershell -NoProfile -File .agents/skills/readme-media/scripts/check-windows-playback.ps1 -Path <file.mp4>
```
To iterate on flags, copy `make-gif.js`'s core bootstrap, write a few PNGs (`board-timeline.png` works) as `f_0000.png...`, run the exact `exec(...)` args, then play the result with the PowerShell check. Always test odd sizes (`1050x679`) too.
