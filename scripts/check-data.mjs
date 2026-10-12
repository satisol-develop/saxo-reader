/**
 * Valida la BBDD del catálogo antes de compilar/publicar.
 *
 * Comprueba que el JSON existe, que todos los recursos tienen los campos
 * obligatorios y que los medios resueltos son coherentes (un PDF apunta a un
 * fichero, un vídeo tiene URL de embed, cada id es único...).
 *
 *   node scripts/check-data.mjs
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "..", "src", "data");
const DB = path.join(DATA_DIR, "transcriptions.json");
/** BBDD por fuentes: qué ofrece cada web y cada página, y cómo se scrapea. */
const SOURCES_DB = path.join(DATA_DIR, "sources.json");
const KINDS = new Set(["pdf", "image", "video", "page", "none"]);
const ACCESS = new Set(["abierta", "gated", "js", "bots", "caida", "sin-rastrear"]);
const STRATEGIES = new Set(["list", "pieces", "letters", "sitemap", "spa", "hub"]);
const REQUIRED = ["id", "title", "project", "category", "description", "license", "sourceUrl", "status"];

const problems = [];

let db;
try {
  db = JSON.parse(await readFile(DB, "utf8"));
} catch (error) {
  console.error(`No se pudo leer ${DB}: ${error.message}`);
  console.error("Ejecuta `npm run scrape` para generarla.");
  process.exit(1);
}

if (!Array.isArray(db.resources) || db.resources.length === 0) {
  problems.push("La BBDD no contiene recursos.");
}

const ids = new Set();
for (const [index, resource] of (db.resources ?? []).entries()) {
  const where = `resources[${index}] (${resource?.id ?? "sin id"})`;

  for (const field of REQUIRED) {
    if (resource[field] === undefined || resource[field] === null || resource[field] === "") {
      problems.push(`${where}: falta el campo "${field}"`);
    }
  }

  if (ids.has(resource.id)) problems.push(`${where}: id duplicado`);
  ids.add(resource.id);

  const kind = resource.media?.kind;
  if (!KINDS.has(kind)) {
    problems.push(`${where}: tipo de medio desconocido "${kind}"`);
    continue;
  }
  if (kind === "none") continue;

  if (!resource.media.url) problems.push(`${where}: medio "${kind}" sin URL`);
  if (kind === "video" && !resource.media.embedUrl) {
    problems.push(`${where}: vídeo sin URL de embed`);
  }
  if (kind === "pdf" && !/\.pdf(\?|#|$)/i.test(resource.media.url)) {
    problems.push(`${where}: el tipo es pdf pero la URL no es un .pdf (${resource.media.url})`);
  }
  if (kind !== "page" && resource.reached === false && !resource.blocked) {
    problems.push(`${where}: medio resuelto en un enlace caído`);
  }
}

const summary = (db.resources ?? []).reduce((acc, resource) => {
  const kind = resource.media?.kind ?? "?";
  acc[kind] = (acc[kind] ?? 0) + 1;
  return acc;
}, {});

// ------------------------------------------------------ BBDD por fuentes ---

let sourcesDb = null;
try {
  sourcesDb = JSON.parse(await readFile(SOURCES_DB, "utf8"));
} catch (error) {
  problems.push(`No se pudo leer src/data/sources.json: ${error.message}`);
}

if (sourcesDb) {
  if (!Array.isArray(sourcesDb.sources) || sourcesDb.sources.length === 0) {
    problems.push("sources.json no contiene fuentes.");
  }

  const seen = new Set();
  let pages = 0;
  let files = { pdf: 0, image: 0, video: 0 };

  for (const source of sourcesDb.sources ?? []) {
    const where = `fuente ${source?.id ?? "sin id"}`;
    for (const field of ["id", "name", "host", "hub", "kind", "recipe", "totals", "pages"]) {
      if (source[field] === undefined || source[field] === null || source[field] === "") {
        problems.push(`${where}: falta el campo "${field}"`);
      }
    }
    if (seen.has(source.id)) problems.push(`${where}: id duplicado`);
    seen.add(source.id);

    if (!STRATEGIES.has(source.kind)) problems.push(`${where}: receta desconocida "${source.kind}"`);
    if (!Array.isArray(source.recipe?.steps) || source.recipe.steps.length === 0) {
      problems.push(`${where}: la receta no explica cómo scrapearla`);
    }

    let sourceFiles = { pdf: 0, image: 0, video: 0 };
    for (const page of source.pages ?? []) {
      pages += 1;
      if (!page.url) problems.push(`${where}: página sin url`);
      if (!ACCESS.has(page.access)) problems.push(`${where}: acceso desconocido "${page.access}" (${page.url})`);
      for (const [kind, count] of Object.entries(page.files ?? {})) {
        if (kind in sourceFiles) sourceFiles[kind] += count;
      }
    }
    if (source.totals?.pages !== (source.pages ?? []).length) {
      problems.push(`${where}: totals.pages (${source.totals?.pages}) no cuadra con ${(source.pages ?? []).length} páginas`);
    }
    for (const [kind, count] of Object.entries(sourceFiles)) {
      if ((source.totals?.files?.[kind] ?? 0) !== count) {
        problems.push(`${where}: totals.files.${kind} (${source.totals?.files?.[kind]}) no cuadra con las páginas (${count})`);
      }
      files[kind] += count;
    }
  }

  if (sourcesDb.totals?.pages !== pages) {
    problems.push(`sources.json: totals.pages (${sourcesDb.totals?.pages}) no cuadra con ${pages} páginas`);
  }
  for (const [kind, count] of Object.entries(files)) {
    if ((sourcesDb.totals?.files?.[kind] ?? 0) !== count) {
      problems.push(`sources.json: totals.files.${kind} (${sourcesDb.totals?.files?.[kind]}) no cuadra con las fuentes (${count})`);
    }
  }

  // Cada pieza tiene que colgar de una fuente conocida.
  const names = new Set((sourcesDb.sources ?? []).map((source) => source.name));
  const orphans = new Set(
    (db.resources ?? []).map((resource) => resource.project).filter((project) => !names.has(project)),
  );
  if (orphans.size) problems.push(`Piezas de proyectos sin fuente en sources.json: ${[...orphans].join(", ")}`);
}

if (problems.length) {
  console.error(`BBDD inválida: ${problems.length} problema(s)`);
  for (const problem of problems.slice(0, 25)) console.error(` - ${problem}`);
  if (problems.length > 25) console.error(` ... y ${problems.length - 25} más`);
  process.exit(1);
}

console.log(`BBDD válida: ${db.resources.length} recursos ${JSON.stringify(summary)}`);
if (sourcesDb) {
  console.log(
    `Fuentes válidas: ${sourcesDb.sources.length} webs · ${sourcesDb.totals.pages} páginas · accesos ${JSON.stringify(sourcesDb.totals.access ?? {})}`,
  );
}
