export interface SavedCollectionItem {
  id: string;
  title: string;
  category: 'Match Tactic' | 'Set Piece' | 'Training Drill';
  updatedAt: string;
  frameCount: number;
  data: any;
}

const COLLECTIONS_KEY = 'tactical-board:collections:v1';

export function loadCollections(): SavedCollectionItem[] {
  try {
    const raw = localStorage.getItem(COLLECTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveToCollections(
  title: string,
  category: SavedCollectionItem['category'],
  data: any
): SavedCollectionItem[] {
  const list = loadCollections();
  const frameCount = Array.isArray(data?.frames) ? data.frames.length : 1;
  const item: SavedCollectionItem = {
    id: crypto.randomUUID(),
    title: title.trim() || `Tactical Scheme (${new Date().toLocaleTimeString()})`,
    category,
    updatedAt: new Date().toISOString(),
    frameCount,
    data,
  };
  const next = [item, ...list].slice(0, 1000);
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export function deleteFromCollections(id: string): SavedCollectionItem[] {
  const next = loadCollections().filter((i) => i.id !== id);
  try {
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

/** Encodes a board payload into a URL-safe base64 hash string (#scheme=...). */
export function encodeSchemeHash(data: any): string {
  const json = JSON.stringify(data);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `#scheme=${b64}`;
}

/** Decodes a #scheme=... hash string back into a board payload object, or null if invalid. */
export function decodeSchemeHash(hash: string): any | null {
  if (!hash || !hash.startsWith('#scheme=')) return null;
  try {
    const b64 = hash.slice('#scheme='.length).replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}
