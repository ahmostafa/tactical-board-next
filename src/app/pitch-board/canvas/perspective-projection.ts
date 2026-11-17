/**
 * 3D Perspective / Broadcast Pitch Projection Engine
 *
 * Implements exact homography projection mapping 2D FIFA pitch coordinates
 * (1050m x 680m) to an elevated 3D stadium broadcast perspective, and inverse
 * projection mapping pointer events back to pitch coordinates.
 */

import { BASE_HEIGHT, BASE_WIDTH } from '../models/tactical-board.models';

export interface PerspectivePoint {
  x: number;
  y: number;
  scale: number;
}

export const PERSPECTIVE_CONFIG = {
  // Screen placement inside standard 1122x728 viewport
  xCenter: 525,
  yNear: 636,
  yFar: 110,
  wNear: 860,
  sFar: 0.52, // Scale factor at far goal line relative to near goal line
};

const K = (1 - PERSPECTIVE_CONFIG.sFar) / PERSPECTIVE_CONFIG.sFar;
const Y_V =
  (PERSPECTIVE_CONFIG.yFar - PERSPECTIVE_CONFIG.sFar * PERSPECTIVE_CONFIG.yNear) /
  (1 - PERSPECTIVE_CONFIG.sFar);

/**
 * Projects a 2D pitch coordinate (x in [0, 1050], y in [0, 680])
 * into the 3D perspective screen coordinates.
 *
 * Orientation:
 * - x = 0 (Home/Defending Goal) is at the near bottom.
 * - x = 1050 (Away/Attacking Goal) is at the far top.
 * - y = 0 (Left Touchline) is on the left.
 * - y = 680 (Right Touchline) is on the right.
 */
export function projectPitchPoint(pitchX: number, pitchY: number): PerspectivePoint {
  const ty = Math.max(0, Math.min(1, pitchX / BASE_WIDTH));
  const tx = Math.max(0, Math.min(1, pitchY / BASE_HEIGHT));

  const s = 1 / (1 + K * ty);
  const screenY = Y_V + (PERSPECTIVE_CONFIG.yNear - Y_V) * s;
  const screenX = PERSPECTIVE_CONFIG.xCenter + (tx - 0.5) * PERSPECTIVE_CONFIG.wNear * s;

  // Visual scale for tokens, shapes and text
  const visualScale = s * 1.12;

  return { x: screenX, y: screenY, scale: visualScale };
}

/**
 * Maps screen coordinates from pointer/mouse back into 2D pitch coordinates (0..1050, 0..680).
 */
export function unprojectPitchPoint(screenX: number, screenY: number): { x: number; y: number } {
  const sRaw = (screenY - Y_V) / (PERSPECTIVE_CONFIG.yNear - Y_V);
  const s = Math.max(PERSPECTIVE_CONFIG.sFar * 0.75, Math.min(1.2, sRaw));

  const ty = (1 / s - 1) / K;
  const tx = 0.5 + (screenX - PERSPECTIVE_CONFIG.xCenter) / (PERSPECTIVE_CONFIG.wNear * s);

  const pitchX = Math.round(Math.max(0, Math.min(BASE_WIDTH, ty * BASE_WIDTH)));
  const pitchY = Math.round(Math.max(0, Math.min(BASE_HEIGHT, tx * BASE_HEIGHT)));

  return { x: pitchX, y: pitchY };
}

/**
 * Projects an array of points [x1, y1, x2, y2, ...] from pitch coordinates to screen coordinates.
 */
export function projectPointList(points: number[]): number[] {
  const result: number[] = [];
  for (let i = 0; i < points.length; i += 2) {
    const px = points[i];
    const py = points[i + 1];
    const proj = projectPitchPoint(px, py);
    result.push(proj.x, proj.y);
  }
  return result;
}
