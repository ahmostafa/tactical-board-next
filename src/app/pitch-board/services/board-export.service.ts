import { Injectable, NgZone, inject } from '@angular/core';
import Konva from 'konva';
import {
  Snapshot,
  TacticalEntity,
  TacticalShape,
  TacticalArrow,
  TacticalText,
} from '../models/tactical-board.models';

export interface VideoExportOptions {
  stage: Konva.Stage;
  entityLayer: Konva.Layer;
  drawingLayer: Konva.Layer;
  ghostLayer: Konva.Layer;
  frames: Snapshot[];
  stepDurationMs: number;
  renderFrameState: (opts: {
    entities?: TacticalEntity[];
    shapes: TacticalShape[];
    arrows: TacticalArrow[];
    texts: TacticalText[];
    note: string;
    goalEntities: TacticalEntity[];
    drawingOpacity: number;
  }) => void;
  onProgress: (pct: number) => void;
  onStatus: (msg: string) => void;
}

@Injectable({ providedIn: 'root' })
export class BoardExportService {
  private ngZone = inject(NgZone);
  private ffmpegCore?: any;

  exportPng(
    stage: Konva.Stage,
    prepareForCapture: () => void,
    restoreAfterCapture: () => void,
    onStatus: (msg: string) => void
  ): void {
    prepareForCapture();
    stage.draw();
    const scale = stage.scaleX() || 1;
    const dataUrl = stage.toDataURL({
      pixelRatio: 2 / scale,
      mimeType: 'image/png',
    });
    restoreAfterCapture();

    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'tactical-board.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    onStatus('PNG exported (tactical-board.png)');
  }

  async exportVideoOrGif(kind: 'mp4' | 'gif', opts: VideoExportOptions): Promise<void> {
    const {
      stage,
      entityLayer,
      drawingLayer,
      ghostLayer,
      frames,
      stepDurationMs,
      renderFrameState,
      onProgress,
      onStatus,
    } = opts;

    onStatus('Loading FFmpeg.wasm...');
    const writtenFiles: string[] = [];

    try {
      if (!this.ffmpegCore) {
        // @ts-ignore - @ffmpeg/core does not ship .d.ts files
        const mod: any = await import('@ffmpeg/core');
        const createFFmpegCore = mod.default ?? mod;
        const wasmUrl = new URL('@ffmpeg/core/wasm', import.meta.url).href;
        const wasmBinary = await (await fetch(wasmUrl)).arrayBuffer();
        this.ffmpegCore = await createFFmpegCore({ wasmBinary });
      }
      const core = this.ffmpegCore;

      const fps = kind === 'gif' ? 15 : 30;
      const framesPerStep = Math.max(6, Math.round((stepDurationMs / 1000) * fps));
      const holdStart = Math.round(fps * 0.4);
      const holdEnd = Math.round(fps * 0.6);
      const totalTransitions = frames.length - 1;
      const totalVideoFrames = holdStart + totalTransitions * framesPerStep + holdEnd;

      ghostLayer.destroyChildren();
      ghostLayer.batchDraw();

      const capturePng = (idx: number) => {
        stage.draw();
        const scale = stage.scaleX() || 1;
        const dataUrl = stage.toDataURL({
          pixelRatio: 1 / scale,
          mimeType: 'image/png',
        });
        const base64 = dataUrl.split(',')[1];
        const bin = atob(base64);
        const bytes = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
        const name = `f_${String(idx).padStart(4, '0')}.png`;
        core.FS.writeFile(name, bytes);
        writtenFiles.push(name);
      };

      let frameIdx = 0;

      // 1. Render initial keyframe hold
      renderFrameState({
        entities: frames[0].entities,
        shapes: frames[0].shapes ?? [],
        arrows: frames[0].arrows,
        texts: frames[0].texts ?? [],
        note: frames[0].note ?? '',
        goalEntities: frames[0].entities,
        drawingOpacity: 1,
      });

      for (let h = 0; h < holdStart; h++) {
        capturePng(frameIdx++);
      }
      onProgress(Math.round((frameIdx / totalVideoFrames) * 60));
      onStatus('Rendering tactical animation frames...');
      await new Promise((r) => setTimeout(r, 0));

      // 2. Render interpolated transition steps
      for (let step = 0; step < totalTransitions; step++) {
        const fromFrame = frames[step];
        const toFrame = frames[step + 1];
        const nextMap = new Map(toFrame.entities.map((e) => [e.id, e]));
        const hasFromArrows = fromFrame.arrows.length > 0;
        const hasToArrows = toFrame.arrows.length > 0;
        const stepShapes = toFrame.shapes ?? fromFrame.shapes ?? [];

        for (let f = 1; f <= framesPerStep; f++) {
          const linear = f / framesPerStep;
          const progress = Konva.Easings.EaseInOut(linear, 0, 1, 1);
          fromFrame.entities.forEach((a) => {
            const b = nextMap.get(a.id);
            const node = entityLayer.findOne('#' + a.id);
            if (b && node) {
              node.position({
                x: a.x + (b.x - a.x) * progress,
                y: a.y + (b.y - a.y) * progress,
              });
            }
          });

          const goalEntities = linear >= 0.75 ? toFrame.entities : fromFrame.entities;
          if (hasFromArrows && hasToArrows) {
            if (linear < 0.5) {
              renderFrameState({
                shapes: stepShapes,
                arrows: fromFrame.arrows,
                texts: fromFrame.texts ?? [],
                note: fromFrame.note ?? '',
                goalEntities,
                drawingOpacity: 1 - linear * 0.6,
              });
            } else {
              renderFrameState({
                shapes: stepShapes,
                arrows: toFrame.arrows,
                texts: toFrame.texts ?? [],
                note: toFrame.note ?? '',
                goalEntities,
                drawingOpacity: 0.4 + (linear - 0.5) * 1.2,
              });
            }
          } else if (hasToArrows) {
            renderFrameState({
              shapes: stepShapes,
              arrows: toFrame.arrows,
              texts: toFrame.texts ?? [],
              note: toFrame.note ?? '',
              goalEntities,
              drawingOpacity: progress,
            });
          } else {
            renderFrameState({
              shapes: stepShapes,
              arrows: fromFrame.arrows,
              texts: fromFrame.texts ?? [],
              note: fromFrame.note ?? '',
              goalEntities,
              drawingOpacity: 1,
            });
          }

          capturePng(frameIdx++);
          if (f % 5 === 0) {
            onProgress(Math.round((frameIdx / totalVideoFrames) * 60));
            await new Promise((r) => setTimeout(r, 0));
          }
        }
      }

      // 3. Hold final frame
      drawingLayer.opacity(1);
      for (let h = 0; h < holdEnd; h++) {
        capturePng(frameIdx++);
      }

      // 4. Encode MP4 or GIF in FFmpeg.wasm
      onStatus(kind === 'gif' ? 'Encoding animated GIF...' : 'Encoding MP4 video...');
      onProgress(65);
      await new Promise((r) => setTimeout(r, 20));

      core.setProgress(({ progress }: { progress: number }) => {
        if (Number.isFinite(progress)) {
          this.ngZone.run(() =>
            onProgress(Math.min(99, 65 + Math.round(Math.max(0, Math.min(1, progress)) * 34)))
          );
        }
      });

      const runExec = (args: string[]) => {
        core.setTimeout(-1);
        core.exec(...args);
        const ret = core.ret;
        core.reset();
        return ret;
      };

      const outName = kind === 'gif' ? 'tactical-board.gif' : 'tactical-board.mp4';
      try {
        core.FS.unlink(outName);
      } catch {}

      if (kind === 'gif') {
        runExec([
          '-framerate',
          String(fps),
          '-i',
          'f_%04d.png',
          '-vf',
          `fps=${fps},scale=840:-2:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=256:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`,
          '-loop',
          '0',
          outName,
        ]);
      } else {
        const durationSec = (frameIdx / fps).toFixed(3);
        const vf =
          'scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2:flags=lanczos,' +
          'pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=#111827,' +
          'setsar=1,format=yuv420p';

        const ret = runExec([
          '-framerate',
          String(fps),
          '-i',
          'f_%04d.png',
          '-f',
          'lavfi',
          '-t',
          durationSec,
          '-i',
          'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-vf',
          vf,
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-profile:v',
          'main',
          '-level',
          '3.1',
          '-bf',
          '0',
          '-crf',
          '20',
          '-pix_fmt',
          'yuv420p',
          '-colorspace',
          'bt709',
          '-color_primaries',
          'bt709',
          '-color_trc',
          'bt709',
          '-color_range',
          'tv',
          '-c:a',
          'aac',
          '-b:a',
          '96k',
          '-shortest',
          '-brand',
          'mp42',
          '-movflags',
          '+faststart',
          outName,
        ]);
        if (ret !== 0) {
          try {
            core.FS.unlink(outName);
          } catch {}
          runExec([
            '-framerate',
            String(fps),
            '-i',
            'f_%04d.png',
            '-vf',
            vf,
            '-c:v',
            'libx264',
            '-preset',
            'ultrafast',
            '-profile:v',
            'baseline',
            '-level',
            '3.0',
            '-pix_fmt',
            'yuv420p',
            '-brand',
            'mp42',
            '-movflags',
            '+faststart',
            outName,
          ]);
        }
      }

      const data: Uint8Array = core.FS.readFile(outName, { encoding: 'binary' });
      writtenFiles.push(outName);
      if (!data || data.byteLength < 256) {
        throw new Error(`Encoded ${kind.toUpperCase()} is empty (${data?.byteLength ?? 0} bytes)`);
      }
      const copy = new Uint8Array(data.byteLength);
      copy.set(data);
      const blob = new Blob([copy.buffer], { type: kind === 'gif' ? 'image/gif' : 'video/mp4' });
      this.triggerDownload(blob, outName);

      onProgress(100);
      onStatus(`${kind.toUpperCase()} exported (${outName})`);
    } catch (err) {
      console.error(`${kind.toUpperCase()} export failed:`, err);
      onStatus(`${kind.toUpperCase()} export failed`);
    } finally {
      if (this.ffmpegCore) {
        for (const f of writtenFiles) {
          try {
            this.ffmpegCore.FS.unlink(f);
          } catch {}
        }
      }
    }
  }

  triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}
