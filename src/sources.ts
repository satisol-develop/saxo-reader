/**
 * Capa de datos de la **BBDD por fuentes** (`src/data/sources.json`).
 *
 * Aquí no hay partituras: hay webs. Cada fuente declara su **receta** (cómo se
 * scrapea: dónde está el catálogo, qué patrón tienen los ficheros, si el sitio
 * corta a los bots) y cada una de sus **páginas** dice lo que ofrece de verdad
 * (PDF, imágenes, vídeo) y si se puede acceder a ella.
 *
 * El catálogo de piezas ya resueltas vive aparte (`src/catalog.ts`): es la capa
 * "ya disponible" que el buscador usa para enseñar resultados al instante.
 */

import db from "./data/sources.json";

/** Cómo se accede a una página. */
export type SourceAccess = "abierta" | "gated" | "js" | "bots" | "caida" | "sin-rastrear";

/** Receta de scraping declarada por la fuente. */
export type SourceStrategy = "list" | "pieces" | "letters" | "sitemap" | "spa" | "hub";

export interface FileCounts {
  pdf: number;
  image: number;
  video: number;
}

export interface SourcePage {
  url: string;
  title: string;
  /** index | piece | anchor | descubierta | page */
  kind: string;
  status: number;
  access: SourceAccess;
  repaired: boolean;
  items: number;
  files: FileCounts;
}

export interface SourceRecipe {
  strategy: SourceStrategy;
  access: "open" | "bots" | "js" | "gated";
  filePatterns: string[];
  steps: string[];
}

export interface Source {
  id: string;
  name: string;
  host: string;
  hub: string;
  kind: SourceStrategy;
  /** Si el sitio permite mostrarse dentro de la app. */
  embed: boolean;
  license: string;
  recipe: SourceRecipe;
  access: Record<string, number>;
  notes: string;
  totals: {
    pages: number;
    withFiles: number;
    items: number;
    files: FileCounts;
    pagesOnly: number;
  };
  pages: SourcePage[];
}

interface SourcesDb {
  generatedAt: string;
  generator: string;
  note: string;
  totals: {
    sources: number;
    pages: number;
    items: number;
    files: FileCounts;
    pagesOnly: number;
    access: Record<string, number>;
  };
  sources: Source[];
}

const sourcesDb = db as unknown as SourcesDb;

export const SOURCES: Source[] = sourcesDb.sources;
export const SOURCES_GENERATED_AT: string = sourcesDb.generatedAt;
export const SOURCES_TOTALS = sourcesDb.totals;
export const SOURCES_TOTAL_PAGES: number = sourcesDb.totals.pages;

export const ACCESS_INFO: Record<SourceAccess, { label: string; icon: string; hint: string; tone: string }> = {
  abierta: {
    label: "Abierta",
    icon: "✅",
    hint: "Se rastrea sin problemas: los ficheros están en el HTML.",
    tone: "ok",
  },
  gated: {
    label: "Descarga con botón",
    icon: "🔒",
    hint: "La página abre, pero el fichero sale al pulsar su botón (login, pago o reCAPTCHA).",
    tone: "warn",
  },
  js: {
    label: "Solo JavaScript",
    icon: "⚙️",
    hint: "El catálogo se pinta en el navegador (SPA): se enlazan sus anclas.",
    tone: "warn",
  },
  bots: {
    label: "Bloquea bots",
    icon: "🤖",
    hint: "Responde 403/429 a los scrapers; abre bien en el navegador.",
    tone: "bad",
  },
  caida: {
    label: "Caída",
    icon: "⛔",
    hint: "El enlace responde 4xx/5xx: hay que repararlo.",
    tone: "bad",
  },
  "sin-rastrear": {
    label: "Sin rastrear",
    icon: "⏳",
    hint: "Está en tu lista pero aún no se ha visitado.",
    tone: "idle",
  },
};

export const STRATEGY_LABELS: Record<SourceStrategy, string> = {
  list: "Índice de ficheros",
  pieces: "Una página por pieza",
  letters: "Índices alfabéticos",
  sitemap: "Vía sitemap",
  spa: "Aplicación (anclas)",
  hub: "Página de recurso",
};

export const ACCESS_ORDER: SourceAccess[] = ["abierta", "gated", "js", "bots", "caida", "sin-rastrear"];

/** Fuentes ordenadas por ficheros disponibles y luego por nombre. */
export const SOURCES_BY_FILES: Source[] = [...SOURCES].sort(
  (a, b) =>
    fullFiles(b) - fullFiles(a) || a.name.localeCompare(b.name, "es"),
);

export function fullFiles(source: Source): number {
  return source.totals.files.pdf + source.totals.files.image + source.totals.files.video;
}

export function sourceByName(name: string): Source | undefined {
  return SOURCES.find((source) => source.name === name);
}

/** Páginas de una fuente que ofrecen al menos un fichero. */
export function pagesWithFiles(source: Source): SourcePage[] {
  return source.pages.filter(
    (page) => page.files.pdf + page.files.image + page.files.video > 0,
  );
}

/** Resumen legible del acceso de una fuente: "117 abiertas · 3 bloquean bots". */
export function accessSummary(source: Source): string {
  return ACCESS_ORDER.filter((access) => (source.access?.[access] ?? 0) > 0)
    .map((access) => `${source.access[access]} ${ACCESS_INFO[access].label.toLowerCase()}`)
    .join(" · ");
}

/** Etiqueta corta de lo que ofrece una fuente: "233 PDF · 3 páginas". */
export function offersLabel(files: FileCounts, pagesOnly = 0): string {
  const parts: string[] = [];
  if (files.pdf) parts.push(`${files.pdf} PDF`);
  if (files.image) parts.push(`${files.image} imágenes`);
  if (files.video) parts.push(`${files.video} vídeos`);
  if (pagesOnly) parts.push(`${pagesOnly} páginas`);
  return parts.join(" · ") || "sin ficheros directos";
}
