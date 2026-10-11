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
const DB = path.resolve(__dirname, "..", "src", "data", "transcriptions.json");
const KINDS = new Set(["pdf", "image", "video", "page", "none"]);
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

if (problems.length) {
  console.error(`BBDD inválida: ${problems.length} problema(s)`);
  for (const problem of problems.slice(0, 25)) console.error(` - ${problem}`);
  if (problems.length > 25) console.error(` ... y ${problems.length - 25} más`);
  process.exit(1);
}

console.log(`BBDD válida: ${db.resources.length} recursos ${JSON.stringify(summary)}`);
