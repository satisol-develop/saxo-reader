/**
 * Piezas **ya resueltas**: la capa "ya disponible" de la app.
 *
 * `src/data/transcriptions.json` (939 KB, ~51 KB gzip) lo genera `npm run
 * scrape` con una ficha por pieza: artista, tonalidad, tipo de fichero, estado
 * y candidatos. Se mantiene aparte de `src/catalog.ts` (tipos y filtros) para
 * que el paquete inicial sólo cargue la BBDD por fuentes y el catálogo llegue
 * después, en su propio chunk.
 */

import db from "./data/transcriptions.json";
import { type DbStats, type Transcription, hasFile } from "./catalog";

export const TRANSCRIPTIONS: Transcription[] = db.resources as Transcription[];
export const DATA_GENERATED_AT: string = db.generatedAt;

const RAW_STATS = (db as { stats?: Partial<DbStats> }).stats ?? {};

/** Cobertura del último rastreo. */
export const DB_STATS: DbStats = {
  pages: RAW_STATS.pages ?? 0,
  pagesReached: RAW_STATS.pagesReached ?? 0,
  pagesRepaired: RAW_STATS.pagesRepaired ?? 0,
  pagesBlocked: RAW_STATS.pagesBlocked ?? 0,
  pagesDead: RAW_STATS.pagesDead ?? 0,
  withFile: RAW_STATS.withFile ?? TRANSCRIPTIONS.filter(hasFile).length,
  pending: RAW_STATS.pending ?? TRANSCRIPTIONS.filter((item) => !hasFile(item)).length,
  requested: RAW_STATS.requested ?? TRANSCRIPTIONS.filter((item) => item.requested).length,
  requestedWithFile:
    RAW_STATS.requestedWithFile ??
    TRANSCRIPTIONS.filter((item) => item.requested && hasFile(item)).length,
};

/** Piezas de tu lista que aún no tienen fichero directo. */
export const PENDING_ITEMS: Transcription[] = TRANSCRIPTIONS.filter(
  (item) => item.requested && !hasFile(item),
);

const countBy = (values: string[]): Map<string, number> =>
  values.reduce((acc, value) => acc.set(value, (acc.get(value) ?? 0) + 1), new Map<string, number>());

export const PROJECT_COUNTS: Map<string, number> = countBy(TRANSCRIPTIONS.map((item) => item.project));

/** Fuentes presentes en la BBDD, ordenadas por número de piezas. */
export const PROJECTS: { name: string; count: number }[] = [...PROJECT_COUNTS.entries()]
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

export const CATEGORY_COUNTS: Map<string, number> = countBy(TRANSCRIPTIONS.map((item) => item.category));
export const KIND_COUNTS: Map<string, number> = countBy(TRANSCRIPTIONS.map((item) => item.media.kind));

/** Piezas de tu lista que aún no tienen fichero resuelto. */
export const PENDING_COUNT: number = TRANSCRIPTIONS.filter(
  (item) => item.requested && item.media.kind === "page",
).length;
