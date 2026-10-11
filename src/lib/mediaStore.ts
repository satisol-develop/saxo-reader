/**
 * Resoluciones hechas en el cliente (scraping al vuelo) guardadas en
 * localStorage y compartidas entre catálogo y visor con `useSyncExternalStore`.
 */

import { useSyncExternalStore } from "react";
import type { MediaInfo, Transcription } from "../catalog";

const STORAGE_KEY = "saxo-reader:media-overrides:v1";

type Overrides = Record<string, MediaInfo>;

function load(): Overrides {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Overrides) : {};
  } catch {
    return {};
  }
}

let state: Overrides = load();
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

const persist = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Sin persistencia (modo privado o cuota llena): la sesión sigue funcionando.
  }
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = (): Overrides => state;

export function setMediaOverride(id: string, media: MediaInfo): void {
  state = {
    ...state,
    [id]: { ...media, source: "client", resolvedAt: new Date().toISOString() },
  };
  persist();
  emit();
}

export function clearMediaOverride(id: string): void {
  if (!(id in state)) return;
  const next = { ...state };
  delete next[id];
  state = next;
  persist();
  emit();
}

export function countOverrides(): number {
  return Object.keys(state).length;
}

/** Medio efectivo de un recurso: el resuelto en el cliente manda sobre la BBDD. */
export function useResolvedMedia(resource: Transcription): MediaInfo {
  const overrides = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return overrides[resource.id] ?? resource.media;
}
