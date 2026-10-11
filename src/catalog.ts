/**
 * Capa de datos del buscador de transcripciones.
 *
 * La BBDD vive en `src/data/transcriptions.json` y la genera el scraper
 * (`npm run scrape`), que visita cada página de origen y guarda:
 *   - el estado HTTP (para detectar enlaces caídos o que bloquean bots),
 *   - el medio resuelto (PDF, imagen, vídeo o página) para el visor,
 *   - todos los candidatos encontrados, por si hay que reintentar en el cliente.
 *
 * Este módulo no hace red: solo tipos, filtros y decisiones de visor.
 */

import db from "./data/transcriptions.json";

export type Category =
  | "PDF"
  | "Solo alto"
  | "Solo tenor"
  | "Solo bari"
  | "Solo soprano"
  | "Etudes/intérêts";

export type Instrument = "Alto" | "Tenor" | "Bari" | "Soprano";

export type MediaKind = "pdf" | "image" | "video" | "page" | "none";

export interface MediaInfo {
  kind: MediaKind;
  /** Qué abre el visor: fichero, embed de vídeo o página. */
  url: string;
  embedUrl?: string;
  downloadUrl?: string;
  embeddable: boolean;
  /** `client` cuando se resolvió en el navegador y no en la BBDD generada. */
  source?: "db" | "client";
  resolvedAt?: string;
}

export interface Transcription {
  id: string;
  title: string;
  /** Sitio o proyecto de origen; alimenta el filtro "Proyecto". */
  project: string;
  category: Category;
  instrument: Instrument | null;
  description: string;
  license: string;
  sourceUrl: string;
  /** Enlace original cuando el scraping lo reparó desde el índice del proyecto. */
  originalSourceUrl?: string;
  repaired?: boolean;
  status: number;
  reached: boolean;
  /** El sitio responde 401/403/429 a los bots aunque abra bien en el navegador. */
  blocked: boolean;
  media: MediaInfo;
  candidates: { pdfs: { url: string; text: string }[]; images: { url: string; text: string }[]; videos: string[] };
  checkedAt: string;
}

export const TRANSCRIPTIONS: Transcription[] = db.resources as Transcription[];
export const DATA_GENERATED_AT: string = db.generatedAt;

export const CATEGORIES: Category[] = [
  "PDF",
  "Solo alto",
  "Solo tenor",
  "Solo bari",
  "Solo soprano",
  "Etudes/intérêts",
];

export const INSTRUMENTS: Instrument[] = ["Alto", "Tenor", "Bari", "Soprano"];

export const MEDIA_KINDS: { kind: MediaKind; label: string }[] = [
  { kind: "pdf", label: "PDF" },
  { kind: "image", label: "Imagen" },
  { kind: "video", label: "Vídeo" },
  { kind: "page", label: "Página" },
];

/** Proyectos presentes en la BBDD, ordenados por número de recursos. */
export const PROJECTS: { name: string; count: number }[] = Object.entries(
  TRANSCRIPTIONS.reduce<Record<string, number>>((acc, item) => {
    acc[item.project] = (acc[item.project] ?? 0) + 1;
    return acc;
  }, {}),
)
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

export interface CatalogFilters {
  query: string;
  project: string | "all";
  category: Category | "all";
  instrument: Instrument | "all";
  kind: MediaKind | "all";
  /** Incluir recursos que responden 404/410 o no son alcanzables. */
  includeDead: boolean;
}

export const EMPTY_FILTERS: CatalogFilters = {
  query: "",
  project: "all",
  category: "all",
  instrument: "all",
  kind: "all",
  includeDead: false,
};

/** ¿Se puede abrir este recurso dentro de la app? */
export function isEmbeddable(media: MediaInfo): boolean {
  return media.embeddable && media.kind !== "none" && Boolean(media.url);
}

/** URL que carga el visor (embed de vídeo, fichero o página). */
export function viewerUrl(media: MediaInfo): string {
  if (media.kind === "video") return media.embedUrl || media.url;
  return media.url;
}

/** Fichero descargable, cuando se conoce uno real. */
export function downloadUrl(media: MediaInfo): string {
  return media.downloadUrl ?? "";
}

/** Texto e icono de la acción principal de una tarjeta. */
export function primaryAction(resource: Transcription, media: MediaInfo): { label: string; icon: string; embedded: boolean } {
  if (!resource.reached && !resource.blocked) return { label: "Enlace caído", icon: "⛔", embedded: false };
  if (!media.url || media.kind === "none") return { label: "Abrir en pestaña", icon: "↗️", embedded: false };

  const embedded = isEmbeddable(media);
  switch (media.kind) {
    case "pdf":
      return { label: "Ver PDF", icon: "📄", embedded };
    case "image":
      return { label: "Ver imagen", icon: "🖼️", embedded };
    case "video":
      return { label: "Ver vídeo", icon: "🎬", embedded };
    default:
      return embedded
        ? { label: "Ver página", icon: "🌐", embedded }
        : { label: "Abrir en pestaña", icon: "↗️", embedded: false };
  }
}

/** Etiqueta legible del tipo de medio. */
const KIND_LABELS: Record<MediaKind, string> = {
  pdf: "PDF",
  image: "Imagen",
  video: "Vídeo",
  page: "Página",
  // Sin fichero resuelto: el recurso se abre en una pestaña nueva.
  none: "Externo",
};

export const kindLabel = (kind: MediaKind): string => KIND_LABELS[kind];

/** Estado del enlace según el último scraping. */
export function linkState(resource: Transcription): { label: string; tone: "ok" | "warn" | "bad" } {
  if (!resource.reached && !resource.blocked) return { label: `Caído (${resource.status || "error"})`, tone: "bad" };
  if (resource.blocked) return { label: "Bloquea bots", tone: "warn" };
  if (resource.repaired || resource.originalSourceUrl) return { label: "Enlace reparado", tone: "warn" };
  return { label: "OK", tone: "ok" };
}

/** URL de la página de origen tal y como está hoy (puede venir reparada). */
export function sourceUrl(resource: Transcription): string {
  return resource.sourceUrl || resource.originalSourceUrl || "";
}

export function matchesFilters(resource: Transcription, filters: CatalogFilters): boolean {
  if (!filters.includeDead && !resource.reached && !resource.blocked) return false;
  if (filters.project !== "all" && resource.project !== filters.project) return false;
  if (filters.category !== "all" && resource.category !== filters.category) return false;
  if (filters.instrument !== "all" && resource.instrument !== filters.instrument) return false;
  if (filters.kind !== "all" && resource.media.kind !== filters.kind) return false;

  const query = filters.query.trim().toLowerCase();
  if (!query) return true;

  return (
    resource.title.toLowerCase().includes(query) ||
    resource.description.toLowerCase().includes(query) ||
    resource.project.toLowerCase().includes(query) ||
    (resource.instrument ?? "").toLowerCase().includes(query) ||
    resource.category.toLowerCase().includes(query)
  );
}
