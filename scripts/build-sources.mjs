/**
 * Generates `scripts/sources.json` (curated seed list + project labels) from
 * the hand-written catalog in `src/catalog.ts`.
 *
 * Run once, then edit `scripts/sources.json` by hand:
 *   node scripts/build-sources.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

/** Human-readable project (site) names for the catalog filter. */
const PROJECTS = {
  "scooby-sax.com": "Scooby Sax",
  "saxteacheruk.com": "SaxTeacher UK",
  "ousaxstudio.weebly.com": "Ohio Sax Studio",
  "musescore.com": "MuseScore",
  "imslp.org": "IMSLP",
  "saxophonemusic.org": "Saxophonemusic.org",
  "tamingthesaxophone.com": "Taming the Saxophone",
  "latouchemusicale.com": "La Touche Musicale",
  "archive.org": "Internet Archive",
  "randyhunterjazz.com": "Randy Hunter Jazz",
  "free-scores.com": "Free-scores.com",
  "saxschoolonline.com": "McGill Sax School",
  "dansr.com": "Vandoren / D'Addario",
  "selmer.fr": "Selmer Paris",
  "yamaha.com": "Yamaha",
  "jazzbarisax.com": "JazzBariSax",
  "pepperadams.com": "Pepper Adams",
};

const slug = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const source = await readFile(path.join(ROOT, "src", "catalog.ts"), "utf8");
const arrayStart = source.indexOf("export const SAXOPHONE_RESOURCES");
if (arrayStart === -1) throw new Error("No SAXOPHONE_RESOURCES array found in src/catalog.ts");

const literalStart = source.indexOf("[", arrayStart);
// The array closes with "\n];" at column 0; anything later belongs to other exports.
const literalEnd = source.indexOf("\n];", arrayStart) + 1;
if (literalStart === -1 || literalEnd === 0) throw new Error("Could not slice the catalog array");

// The array is a plain JS literal (no TS syntax inside), so it can be evaluated.
const resources = new Function(`return ${source.slice(literalStart, literalEnd + 1)}`)();

const sources = resources.map((resource) => {
  const host = new URL(resource.viewUrl).hostname.replace(/^www\./, "");
  return {
    id: `${slug(host.split(".")[0])}-${slug(resource.title)}`,
    title: resource.title,
    project: PROJECTS[host] ?? host,
    category: resource.category,
    instrument: resource.instrument ?? null,
    description: resource.description,
    license: resource.license,
    sourceUrl: resource.viewUrl,
  };
});

const ids = new Set();
for (const item of sources) {
  let id = item.id;
  let suffix = 2;
  while (ids.has(id)) id = `${item.id}-${suffix++}`;
  ids.add(id);
  item.id = id;
}

await writeFile(
  path.join(__dirname, "sources.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), resources: sources }, null, 2)}\n`,
  "utf8",
);

console.log(`Wrote scripts/sources.json with ${sources.length} sources`);
