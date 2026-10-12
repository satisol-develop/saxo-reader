/**
 * Cosecha y preparación de la biblioteca.
 *
 *   node scripts/build-sources.mjs
 *
 * Genera dos ficheros de entrada para el scraper:
 *   - scripts/sources.json : páginas que se visitan (proyectos + enlaces curados)
 *   - scripts/library.json : las piezas que pediste, leídas del markdown
 *                            (saxophone-transcriptions-resources.md)
 *
 * El markdown es la "lista de la compra": cada fila de sus tablas es una pieza
 * que el buscador debe poder encontrar aunque su página aún no se haya podido
 * rastrear (MuseScore devuelve 403, BopLand carga por JavaScript, etc.).
 */

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MD = path.join(ROOT, "saxophone-transcriptions-resources.md");
const CURATED = path.join(__dirname, "curated.json");
const SOURCES = path.join(__dirname, "sources.json");
const LIBRARY = path.join(__dirname, "library.json");

const slug = (value) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

/** Nombre bonito de cada dominio para el filtro "Proyecto". */
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
  "bopland.org": "BopLand",
  "sharpelevenmusic.com": "Sharp Eleven Music",
  "zdenkoivanusic.com": "Zdenko Ivanusic",
  "jazzsaxophonelessons.com": "Jazz Saxophone Lessons",
};

const hostOf = (url) => new URL(url).hostname.replace(/^www\./, "");
const projectOf = (url) => PROJECTS[hostOf(url)] ?? hostOf(url);

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0 Safari/537.36 SaxoReaderBot/1.0 (+https://github.com/satisol-develop/saxo-reader)";

async function fetchText(url, timeoutMs = 20000) {
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xml,text/xml,*/*;q=0.8" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return "";
    const type = (response.headers.get("content-type") || "").toLowerCase();
    if (!/text|xml|html/.test(type)) return "";
    return await response.text();
  } catch {
    return "";
  }
}

const locsOf = (xml) =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => match[1].trim().replace(/&amp;/g, "&"))
    .filter((value) => /^https?:\/\//i.test(value));

/**
 * Cosecha las páginas de un sitio:
 *  - sitemap.xml (y sus índices hijos) → lista completa de páginas
 *  - /title/a…z/ (saxophonemusic.org) → índice alfabético de piezas
 *  - /database#<colección>/<tema> (BopLand, SPA) → un ancla por lick
 */
async function harvestHost(origin, rule) {
  const pages = new Set();
  const anchors = [];

  if (rule.letters) {
    for (const letter of "abcdefghijklmnopqrstuvwxyz".split("")) {
      const html = await fetchText(new URL(`/title/${letter}/`, origin).href);
      if (!html) continue;
      for (const match of html.matchAll(/href="([^"]+)"/gi)) {
        const href = match[1].replace(/&amp;/g, "&");
        if (!/\/title\/[a-z]\/[^"']+\/$/i.test(href)) continue;
        pages.add(new URL(href, origin).href);
      }
    }
  }

  if (rule.indexPaths) {
    for (const pathname of rule.indexPaths) {
      const html = await fetchText(new URL(pathname, origin).href);
      if (!html) continue;
      for (const match of html.matchAll(/href="([^"]+)"/gi)) {
        const url = new URL(match[1].replace(/&amp;/g, "&"), origin).href;
        if (rule.keep && !rule.keep.test(url)) continue;
        if (JUNK_PAGE.test(url)) continue;
        pages.add(url.split("#")[0]);
      }
    }
  }

  if (rule.anchors) {
    const xml = await fetchText(new URL(rule.sitemap ?? "/sitemap.xml", origin).href);
    for (const loc of locsOf(xml)) {
      const match = decodeURIComponent(loc).match(/#([^#]+)\/([^/]+)$/);
      if (!match) continue;
      const collection = match[1];
      if (!rule.anchors.test(collection)) continue;
      const tune = match[2].replace(/^\+|\+$/g, "").replace(/\+/g, " ");
      if (/key:|name:|collection|^\s*$/i.test(tune)) continue;
      anchors.push({ collection, tune, url: loc });
    }
  }

  const maps = ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml", "/sitemap-index.xml"]
    .filter((pathname) => pathname !== rule.sitemap)
    .map((pathname) => new URL(pathname, origin).href);
  const seenMaps = new Set();

  while (maps.length && seenMaps.size < 16) {
    const mapUrl = maps.shift();
    if (seenMaps.has(mapUrl)) continue;
    seenMaps.add(mapUrl);
    const xml = await fetchText(mapUrl);
    if (!xml || !/<(urlset|sitemapindex)/i.test(xml)) continue;
    const isIndex = /<sitemapindex/i.test(xml);
    for (const loc of locsOf(xml)) {
      if (isIndex && /\.xml/i.test(loc)) maps.push(loc);
      else pages.add(loc);
    }
  }

  const kept = [...pages].filter((url) => {
    if (rule.keep && !rule.keep.test(url)) return false;
    if (JUNK_PAGE.test(url)) return false;
    return true;
  });

  return { pages: kept.slice(0, rule.cap ?? 200), anchors: anchors.slice(0, rule.capAnchors ?? 0) };
}

/** Páginas que nunca son una pieza: etiquetas, paginación, legales, feeds… */
const JUNK_PAGE =
  /(\/tag\/|\/tags\/|\/category\/|\/author\/|\/feed\/?$|\?replytocom|\/comment|wp-json|\/cart|\/checkout|privacy|\/cookie|\/terms|\/contact|\/about|\/login|\/register|\/search|\/page\/\d+|\/amp\/?$|\.(jpg|jpeg|png|gif|webp|svg|css|js|xml)(\?|$))/i;

/** Qué páginas de cada sitio son piezas (o índices de piezas). */
const HOST_RULES = {
  "saxteacheruk.com": { keep: /\/transcriptions?\//i, cap: 400 },
  "zdenkoivanusic.com": {
    keep: /\/sdm_downloads\/[^/]+\/?$/i,
    indexPaths: ["/transcriptions/", "/downloads/"],
    cap: 250,
  },
  "jazzbarisax.com": { keep: /transcription/i, cap: 40 },
  "scooby-sax.com": { keep: /(transcription|tune_up|lesson|method)/i, cap: 40 },
  "ousaxstudio.weebly.com": { keep: /(transcription|repertoire|tunes-to-know|jazz-resources|listenwatch)/i, cap: 30 },
  "saxophonemusic.org": { letters: true, indexPaths: ["/category/"], cap: 400 },
  "bopland.org": { "anchors": /treble-clef-licks/i, sitemap: "/sitemap.xml", capAnchors: 350, cap: 0 },
  "tamingthesaxophone.com": { keep: /(transcription|players)/i, cap: 40 },
  "jazzsaxophonelessons.com": { keep: /(free-downloads|transcription)/i, cap: 60 },
  "sharpelevenmusic.com": { keep: /(saxophone-transcriptions|transcription)/i, cap: 60 },
  "imslp.org": {
    keep: /\/wiki\/(Category:)?(For_saxophone|Scores_featuring|[^/]*(Method|Method_for|Etudes|Etudes_pour|Exercices)[^/]*$)/i,
    cap: 40,
  },
  "archive.org": { keep: /\/details\/(sax|saxophone|saxof|method|klose|universal)/i, cap: 30 },
  "latouchemusicale.com": { keep: /saxophone/i, cap: 60 },
  "free-scores.com": { keep: /(saxophone|partition)/i, cap: 30 },
};

// ------------------------------------------------------------- markdown ------

const markdown = await readFile(MD, "utf8");

/** Divide el markdown en secciones "## N. Nombre" con su URL de acceso. */
function parseSections(source) {
  const sections = [];
  const blocks = source.split(/\n(?=## )/);
  for (const block of blocks) {
    const heading = block.match(/^##\s+(.+)$/m)?.[1] ?? "";
    if (!heading) continue;
    const access = block.match(/\*\*Acceso:\*\*\s*(\S+)/)?.[1];
    if (!access) continue;
    sections.push({
      title: heading.replace(/^[\d.]+\s*/, "").replace(/\s*\(.*\)\s*$/, "").trim(),
      url: access,
      tables: parseTables(block),
    });
  }
  return sections;
}

const splitCells = (line) =>
  line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());

const isSeparator = (cells) => cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s/g, "")));

/** Tablas markdown del bloque → { headers (minúsculas), rows }. */
function parseTables(block) {
  const lines = block.split("\n");
  const tables = [];
  let index = 0;

  while (index < lines.length) {
    if (!/^\s*\|.*\|\s*$/.test(lines[index])) {
      index += 1;
      continue;
    }

    const rows = [];
    while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
      rows.push(splitCells(lines[index]));
      index += 1;
    }

    if (rows.length < 2) continue;
    const headers = rows[0].map((cell) => cell.toLowerCase());
    const body = rows.slice(1).filter((cells) => !isSeparator(cells));
    if (body.length) tables.push({ headers, rows: body });
  }

  return tables;
}

/** Parte "A, B (Master Take, Alt), C" en piezas, respetando paréntesis. */
function splitTunes(value) {
  const parts = [];
  let depth = 0;
  let buffer = "";
  for (const char of value) {
    if (char === "(" || char === "[") depth += 1;
    if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      parts.push(buffer);
      buffer = "";
      continue;
    }
    buffer += char;
  }
  parts.push(buffer);
  return parts.map((part) => part.replace(/\*\*/g, "").trim()).filter(Boolean);
}

const clean = (value) => value.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

/** "https://sitio/transcriptions/blue-bossa/blue-bossa-lead-sheet.html" → "Blue bossa". */
function titleFromUrl(raw) {
  const url = new URL(raw);
  const parts = url.pathname.split("/").filter(Boolean);
  const last = parts.pop() ?? url.hostname;
  const base = last.replace(/\.(html?|php|aspx?)$/i, "");
  const name = base
    .replace(/-(lead-sheet|transcription|sheet-music|free-sheet-music|download|pdf)$/gi, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (name.length >= 3) return name.charAt(0).toUpperCase() + name.slice(1);
  return parts.join(" / ");
}

/** Pistas de que una página es un método/estudio en vez de un solo. */
const CATEGORY_HINTS = /(method|etude|exercic|mechanism|scale|long-?tone|warm-?up|daily|finger)/i;

/** Instrumento explícito en el texto: "(tenor)", "Alto Sax", etc. */
function instrumentFrom(text) {
  const value = text.toLowerCase();
  if (/\bbar[íi]tono|bari\b/.test(value)) return "Bari";
  if (/\bsoprano\b/.test(value)) return "Soprano";
  if (/\balto\b/.test(value)) return "Alto";
  if (/\btenor\b/.test(value)) return "Tenor";
  return null;
}

const library = [];
const sectionUrls = [];

for (const section of parseSections(markdown)) {
  const url = section.url.startsWith("http") ? section.url : `https://${section.url}`;
  sectionUrls.push({ url, project: projectOf(url), title: section.title });

  const sectionInstrument = instrumentFrom(section.title);

  for (const table of section.tables) {
    const tuneIndex = table.headers.findIndex((header) => header.includes("título"));
    const artistIndex = table.headers.findIndex(
      (header) => header.includes("solista") || header.includes("interpretado"),
    );
    if (tuneIndex === -1) continue;

    for (const row of table.rows) {
      const tuneCell = row[tuneIndex];
      if (!tuneCell || /título|solista/i.test(tuneCell)) continue;
      const artistCell = artistIndex === -1 ? "" : clean(row[artistIndex] ?? "");
      const artist = artistCell.replace(/\(.*?\)/g, "").trim();

      for (const tune of splitTunes(tuneCell)) {
        if (tune.length < 2) continue;
        const instrument = instrumentFrom(`${artistCell} ${tune}`) ?? sectionInstrument;
        // "Blue Bossa (*Biting the Apple*)" → tema "Blue Bossa" + contexto del
        // disco. El contexto no se pierde: va en la ficha y ayuda a buscarla.
        const raw = tune.replace(/\*+/g, "").trim();
        const core = raw.replace(/(\s*\([^)]*\)\s*)+$/g, "").trim();
        const context =
          raw
            .slice(core.length)
            .replace(/[()]/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim() || null;
        library.push({
          id: `${slug(projectOf(url))}-${slug(artist || "varios")}-${slug(core || raw)}`,
          project: projectOf(url),
          artist: artist || null,
          tune: core || raw,
          context,
          instrument,
          pageUrl: url,
        });
      }
    }
  }
}

// Secciones sin tabla (p. ej. MuseScore genérico) también son páginas a visitar.
const uniqueLibrary = [...new Map(library.map((item) => [item.id, item])).values()];

// ---------------------------------------------------------------- fuentes ----

let curated = { resources: [] };
try {
  curated = JSON.parse(await readFile(CURATED, "utf8"));
} catch {
  // Primera ejecución: todavía no hay listado curado.
}

const sources = new Map();

// 1) Páginas de tus proyectos (markdown).
for (const section of sectionUrls) {
  if (sources.has(section.url)) continue;
  sources.set(section.url, {
    id: slug(`${projectOf(section.url)}-${section.title}`),
    project: projectOf(section.url),
    title: section.title,
    category: "Índice de proyecto",
    description: `Listado completo de ${section.title}.`,
    license: "Enlaces a terceros (verificar cada pieza)",
    sourceUrl: section.url,
    kind: "index",
  });
}

// 2) Enlaces curados que ya venían del catálogo a mano.
for (const resource of curated.resources ?? []) {
  if (sources.has(resource.sourceUrl)) continue;
  sources.set(resource.sourceUrl, {
    id: resource.id,
    project: resource.project,
    title: resource.title,
    category: resource.category,
    description: resource.description,
    license: resource.license,
    instrument: resource.instrument ?? null,
    sourceUrl: resource.sourceUrl,
    kind: "page",
  });
}

// 3) Cosecha de sitemaps: expande cada proyecto a todas sus páginas de pieza.
//    Esto es lo que hace que el buscador cubra el sitio entero y no solo la
//    portada: SaxTeacher UK pasa de 1 página a ~150, Zdenko a ~60 descargas,
//    Saxophonemusic.org a ~400 temas y BopLand a sus 322 licks en clave de sol.
const harvestOrigins = new Map();
for (const resource of [...sources.values()]) {
  const host = hostOf(resource.sourceUrl);
  const rule = HOST_RULES[host];
  if (!rule) continue;
  const origin = new URL(resource.sourceUrl).origin;
  if (!harvestOrigins.has(origin)) harvestOrigins.set(origin, { host, rule, project: resource.project });
}

let harvestedPages = 0;
let harvestedAnchors = 0;
for (const [origin, { host, rule, project }] of harvestOrigins) {
  const { pages, anchors } = await harvestHost(origin, rule);
  for (const url of pages) {
    if (sources.has(url)) continue;
    const kind = /\/title\//i.test(url) ? "piece" : "piece";
    sources.set(url, {
      id: slug(`${project}-${new URL(url).pathname}`),
      project,
      title: titleFromUrl(url),
      category: CATEGORY_HINTS.test(url) ? "Estudio/Método" : "Solo",
      description: `Página de pieza descubierta en el índice de ${project}.`,
      license: "Enlaces a terceros (verificar cada pieza)",
      sourceUrl: url,
      kind,
    });
    harvestedPages += 1;
  }
  for (const anchor of anchors) {
    if (sources.has(anchor.url)) continue;
    sources.set(anchor.url, {
      id: slug(`${project}-${anchor.collection}-${anchor.tune}`),
      project,
      title: anchor.tune,
      category: "Solo",
      description: `Lick de ${anchor.tune} en el lector de ${project}.`,
      license: "Enlaces a terceros (verificar cada pieza)",
      sourceUrl: anchor.url,
      kind: "anchor",
    });
    harvestedAnchors += 1;
  }
  console.log(`  ${host}: +${pages.length} páginas, +${anchors.length} licks`);
}

const payload = {
  generatedAt: new Date().toISOString(),
  projects: PROJECTS,
  resources: [...sources.values()],
};

await writeFile(SOURCES, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
await writeFile(
  LIBRARY,
  `${JSON.stringify({ generatedAt: payload.generatedAt, total: uniqueLibrary.length, items: uniqueLibrary }, null, 2)}\n`,
  "utf8",
);

const byProject = uniqueLibrary.reduce((acc, item) => {
  acc[item.project] = (acc[item.project] ?? 0) + 1;
  return acc;
}, {});

console.log(`\nPáginas a visitar: ${payload.resources.length} (+${harvestedPages} desde sitemaps, ${harvestedAnchors} licks)`);
console.log(`Piezas en tu lista: ${uniqueLibrary.length}`);
console.log(byProject);
