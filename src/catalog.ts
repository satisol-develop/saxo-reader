/**
 * Modelo y decisiones del buscador de partituras.
 *
 * Aquí sólo hay tipos, filtros y las reglas de visor: **ningún dato**. Las
 * piezas ya resueltas viven en `src/catalog-data.ts` (939 KB, se carga en su
 * propio chunk) y la BBDD por fuentes en `src/sources.ts` (210 KB): así la app
 * pinta con lo segundo y el catálogo llega después.
 */

export type Category =
  | "Solo"
  | "Estudio/Método"
  | "Partitura"
  | "Guía/Recurso"
  | "Índice de proyecto";

export type Instrument = "Alto" | "Tenor" | "Bari" | "Soprano";
/** Etiquetas claras para el filtro de tonalidad (lo que ve el saxofonista). */
export const KEY_LABELS: Record<MusicKey, string> = {
  C: "Concierto (C)",
  Bb: "Sib · tenor/soprano",
  Eb: "Mib · alto/barítono",
  F: "Fa",
};
export type MusicKey = "C" | "Bb" | "Eb" | "F";
export type MediaKind = "pdf" | "image" | "video" | "page" | "none";
/** De dónde sale la ficha: rastreada en la página, de tu lista, la página o curada. */
export type Origin = "crawl" | "list" | "page" | "curated";

export interface MediaInfo {
  kind: MediaKind;
  /** Qué abre el visor: fichero, embed de vídeo o página. */
  url: string;
  embedUrl?: string;
  downloadUrl?: string;
  embeddable: boolean;
  /** Cómo se emparejó el fichero con el título (solista+tema, solo tema…). */
  match?: string;
  source?: "db" | "client";
  resolvedAt?: string;
}

export interface CandidateLinks {
  pdfs: { url: string; text: string }[];
  images: { url: string; text: string }[];
  videos: string[];
}

export interface Transcription {
  id: string;
  title: string;
  /** Nombre de la pieza (sin el solista). */
  tune: string | null;
  /** Solista o intérprete. */
  artist: string | null;
  /** Sitio de origen; alimenta el filtro "Proyecto". */
  project: string;
  category: Category;
  instrument: Instrument | null;
  /** Tonalidad del fichero: C, Bb o Eb (marca el instrumento que lo lee). */
  key: MusicKey | null;
  origin: Origin;
  /** La pieza venía en tu lista del markdown. */
  requested?: boolean;
  description: string;
  license: string;
  sourceUrl: string;
  pageUrl: string;
  status: number;
  reached: boolean;
  /** El sitio responde 401/403/429 a los bots aunque abra bien en el navegador. */
  blocked: boolean;
  repaired?: boolean;
  error?: string;
  media: MediaInfo;
  candidates: CandidateLinks;
  checkedAt: string;
}


/** Cobertura del último rastreo: cuántas páginas se revisaron y qué salió. */
export interface DbStats {
  pages: number;
  pagesReached: number;
  pagesRepaired: number;
  pagesBlocked: number;
  pagesDead: number;
  withFile: number;
  pending: number;
  requested: number;
  requestedWithFile: number;
}

/** ¿La ficha abre un fichero directo (PDF, imagen o vídeo) en vez de una página? */
export const hasFile = (item: Transcription): boolean =>
  item.media.kind === "pdf" || item.media.kind === "video" || item.media.kind === "image";

export const CATEGORIES: Category[] = [
  "Solo",
  "Estudio/Método",
  "Partitura",
  "Guía/Recurso",
  "Índice de proyecto",
];

export const INSTRUMENTS: Instrument[] = ["Alto", "Tenor", "Bari", "Soprano"];

export const MUSIC_KEYS: MusicKey[] = ["C", "Bb", "Eb"];

export const MEDIA_KINDS: { kind: MediaKind; label: string }[] = [
  { kind: "pdf", label: "PDF" },
  { kind: "image", label: "Imagen" },
  { kind: "video", label: "Vídeo" },
  { kind: "page", label: "Página" },
];

export interface CatalogFilters {
  query: string;
  project: string | "all";
  /** Página concreta de una fuente (desde la vista de fuentes). */
  page: string | "all";
  /** Título de la página filtrada, para la etiqueta activa. */
  pageTitle?: string;
  category: Category | "all";
  instrument: Instrument | "all";
  kind: MediaKind | "all";
  key: MusicKey | "all";
  /** Solo las piezas que pediste en tu lista. */
  onlyRequested: boolean;
  /** Solo los recursos que siguen sin fichero (para reintentar el scraping). */
  onlyPending: boolean;
  /** Solo los que abren un PDF/imagen/vídeo directo. */
  onlyWithFile: boolean;
  includeDead: boolean;
}

export const EMPTY_FILTERS: CatalogFilters = {
  query: "",
  project: "all",
  page: "all",
  pageTitle: undefined,
  category: "all",
  instrument: "all",
  kind: "all",
  key: "all",
  onlyRequested: false,
  onlyPending: false,
  onlyWithFile: false,
  includeDead: false,
};

/** Atajos de un clic: las combinaciones de filtros que más se usan. */
export interface CatalogPreset {
  id: string;
  label: string;
  icon: string;
  hint: string;
  filters: Partial<CatalogFilters>;
}

export const PRESETS: CatalogPreset[] = [
  {
    id: "all",
    label: "Todo",
    icon: "🎷",
    hint: "Las 900 piezas rastreadas",
    filters: {},
  },
  {
    id: "pdf",
    label: "PDF listos",
    icon: "📄",
    hint: "Con el fichero resuelto, para leerlos aquí mismo",
    filters: { onlyWithFile: true, kind: "pdf" },
  },
  {
    id: "list",
    label: "De tu lista",
    icon: "★",
    hint: "Las piezas del markdown",
    filters: { onlyRequested: true },
  },
  {
    id: "videos",
    label: "Vídeos",
    icon: "🎬",
    hint: "Solos en vídeo para ver y escuchar",
    filters: { kind: "video" },
  },
  {
    id: "studies",
    label: "Estudios",
    icon: "🎼",
    hint: "Métodos, estudios y calentamientos para practicar",
    filters: { category: "Estudio/Método" },
  },
  {
    id: "pending",
    label: "Pendientes",
    icon: "⏳",
    hint: "Aún sin fichero: pulsa «Buscar fichero» en cada una",
    filters: { onlyPending: true },
  },
];

export type SortOrder = "recommended" | "project" | "title" | "artist" | "recent";

export const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "recommended", label: "Recomendado" },
  { value: "project", label: "Proyecto" },
  { value: "title", label: "Título" },
  { value: "artist", label: "Solista" },
  { value: "recent", label: "Última comprobación" },
];

/** Un fichero en Bb lo leen tenor y soprano; uno en Eb, alto y bari. */
export function instrumentMatches(resource: Transcription, instrument: Instrument): boolean {
  if (resource.instrument === instrument) return true;
  if (instrument === "Alto" || instrument === "Bari") return resource.key === "Eb";
  return resource.key === "Bb";
}

export function matchesFilters(resource: Transcription, filters: CatalogFilters): boolean {
  if (!filters.includeDead && !resource.reached && !resource.blocked && resource.origin !== "list") {
    return false;
  }
  if (filters.project !== "all" && resource.project !== filters.project) return false;
  if (filters.page !== "all" && resource.pageUrl !== filters.page && resource.sourceUrl !== filters.page) {
    return false;
  }
  if (filters.category !== "all" && resource.category !== filters.category) return false;
  if (filters.kind !== "all" && resource.media.kind !== filters.kind) return false;
  if (filters.key !== "all" && resource.key !== filters.key) return false;
  if (filters.instrument !== "all" && !instrumentMatches(resource, filters.instrument)) return false;
  if (filters.onlyRequested && !resource.requested) return false;
  if (filters.onlyPending && !(resource.media.kind === "page" || resource.media.kind === "none")) return false;
  if (filters.onlyWithFile && !hasFile(resource)) return false;

  const query = filters.query.trim().toLowerCase();
  if (!query) return true;

  const haystack = [
    resource.title,
    resource.tune ?? "",
    resource.artist ?? "",
    resource.project,
    resource.category,
    resource.instrument ?? "",
    resource.key ?? "",
  ]
    .join(" ")
    .toLowerCase();

  // Todas las palabras de la búsqueda deben aparecer (AND), en cualquier orden.
  return query.split(/\s+/).every((token) => haystack.includes(token));
}

export function sortResources(resources: Transcription[], order: SortOrder): Transcription[] {
  const list = [...resources];
  switch (order) {
    // Lo primero que quieres ver: tus piezas, luego lo que se abre aquí mismo
    // (PDF, vídeo, imagen) y por último el título.
    case "recommended":
      return list.sort(
        (a, b) =>
          Number(Boolean(b.requested)) - Number(Boolean(a.requested)) ||
          Number(hasFile(b)) - Number(hasFile(a)) ||
          a.title.localeCompare(b.title, "es"),
      );
    case "title":
      return list.sort((a, b) => a.title.localeCompare(b.title, "es"));
    case "artist":
      return list.sort(
        (a, b) => (a.artist ?? "zzz").localeCompare(b.artist ?? "zzz", "es") || a.title.localeCompare(b.title, "es"),
      );
    case "recent":
      return list.sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
    default:
      return list.sort(
        (a, b) => a.project.localeCompare(b.project, "es") || a.title.localeCompare(b.title, "es"),
      );
  }
}

/** ¿Se puede abrir este recurso dentro de la app? */
export function isEmbeddable(media: MediaInfo): boolean {
  return media.embeddable && media.kind !== "none" && Boolean(media.url);
}

export function viewerUrl(media: MediaInfo): string {
  if (media.kind === "video") return media.embedUrl || media.url;
  return media.url;
}

export function downloadUrl(media: MediaInfo): string {
  return media.downloadUrl ?? "";
}

const KIND_LABELS: Record<MediaKind, string> = {
  pdf: "PDF",
  image: "Imagen",
  video: "Vídeo",
  page: "Página",
  none: "Externo",
};

export const kindLabel = (kind: MediaKind): string => KIND_LABELS[kind];

export function primaryAction(resource: Transcription, media: MediaInfo): { label: string; icon: string; embedded: boolean } {
  if (!resource.reached && !resource.blocked && resource.origin !== "list") {
    return { label: "Enlace caído", icon: "⛔", embedded: false };
  }
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

/** Estado del enlace según el último scraping. */
export function linkState(resource: Transcription): { label: string; tone: "ok" | "warn" | "bad" | "idle" } {
  if (resource.origin === "list") return { label: "En tu lista", tone: "idle" };
  if (!resource.reached && !resource.blocked) return { label: `Caído (${resource.status || "error"})`, tone: "bad" };
  if (resource.blocked) return { label: "Bloquea bots", tone: "warn" };
  if (resource.repaired) return { label: "Enlace reparado", tone: "warn" };
  return { label: "OK", tone: "ok" };
}

export function sourceUrl(resource: Transcription): string {
  return resource.sourceUrl || resource.pageUrl || "";
}

/** Filtros activos, para mostrarlos como etiquetas quitables. */
export function activeFilterChips(filters: CatalogFilters): { key: keyof CatalogFilters; label: string }[] {
  const chips: { key: keyof CatalogFilters; label: string }[] = [];
  if (filters.page !== "all") {
    chips.push({ key: "page", label: `Página: ${filters.pageTitle ?? filters.page}` });
  }
  if (filters.project !== "all") chips.push({ key: "project", label: `Fuente: ${filters.project}` });
  if (filters.category !== "all") chips.push({ key: "category", label: `Categoría: ${filters.category}` });
  if (filters.instrument !== "all") chips.push({ key: "instrument", label: `Instrumento: ${filters.instrument}` });
  if (filters.kind !== "all") chips.push({ key: "kind", label: `Tipo: ${kindLabel(filters.kind as MediaKind)}` });
  if (filters.key !== "all") chips.push({ key: "key", label: `Tonalidad: ${filters.key}` });
  if (filters.onlyRequested) chips.push({ key: "onlyRequested", label: "Solo mi lista" });
  if (filters.onlyWithFile) chips.push({ key: "onlyWithFile", label: "Con fichero" });
  if (filters.onlyPending) chips.push({ key: "onlyPending", label: "Sin fichero" });
  if (filters.includeDead) chips.push({ key: "includeDead", label: "Incluye caídos" });
  return chips;
}
