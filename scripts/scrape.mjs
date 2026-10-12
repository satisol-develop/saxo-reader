/**
 * Saxo Reader — scraper de build.
 *
 * Entradas:
 *   scripts/sources.json   páginas que se visitan (proyectos + enlaces curados)
 *   scripts/library.json   las piezas de tu lista (markdown)
 *   scripts/curated.json   fichas curadas a mano (métodos, guías…)
 *
 * Salida:
 *   src/data/transcriptions.json  BBDD con una ficha por PIEZA
 *   src/data/scrape-report.json   diagnóstico de la última pasada
 *
 * No se queda en la página: **rastrea su interior**. De cada página saca todas
 * las piezas (los 260 PDFs de Scooby Sax, los 30 solos de Zdenko, los vídeos de
 * Taming the Saxophone…), cada una con su título, artista, tonalidad y fichero.
 * Si un índice enlaza páginas de piezas (Ohio, Zdenko, Jazz Sax Lessons), entra
 * un nivel más. Y si una página no se puede leer (MuseScore 403, BopLand por
 * JavaScript), las piezas de tu lista siguen en el buscador, apuntando a su
 * página para abrirla o reintentar el scraping.
 *
 * Uso:
 *   node scripts/scrape.mjs
 *   node scripts/scrape.mjs --only saxteacheruk.com --delay 300
 *   node scripts/scrape.mjs --list-only      # sólo la lista, sin salir a la red
 *
 * Las reglas de extracción y emparejamiento están espejadas en src/lib/scrape.ts.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCES = path.join(__dirname, "sources.json");
const LIBRARY = path.join(__dirname, "library.json");
const CURATED = path.join(__dirname, "curated.json");
const OUT_DIR = path.join(ROOT, "src", "data");
const OUT_DB = path.join(OUT_DIR, "transcriptions.json");
const OUT_REPORT = path.join(OUT_DIR, "scrape-report.json");
/** Resultado del último rastreo, para re-emparejar sin volver a bajar 478 páginas. */
const CACHE = path.join(__dirname, "crawl-cache.json");

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0 Safari/537.36 SaxoReaderBot/1.0 (+https://github.com/satisol-develop/saxo-reader)";

const EMBED_BLOCKED_HOSTS = [
  "musescore.com",
  "tamingthesaxophone.com",
  "free-scores.com",
  "latouchemusicale.com",
];

/** Índices de proyecto: se usan para reparar enlaces caídos. */
const PROJECT_INDEXES = {
  "saxteacheruk.com": "https://saxteacheruk.com/free-transcriptions.html",
  "scooby-sax.com": "https://scooby-sax.com/Transcriptions.html",
  "tamingthesaxophone.com": "https://tamingthesaxophone.com/saxophone/players/blues-transcriptions",
};

/** Proyectos que publican transcripciones de solos (el resto son guías/métodos). */
const SOLO_PROJECTS = new Set([
  "Scooby Sax",
  "SaxTeacher UK",
  "Ohio Sax Studio",
  "Sharp Eleven Music",
  "Zdenko Ivanusic",
  "Jazz Saxophone Lessons",
  "BopLand",
]);

const PDF_EXT = /\.pdf(\?|#|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i;
const JUNK_IMAGE = /(logo|icon|sprite|banner|favicon|avatar|badge|button|arrow|payment|flag)/i;
/** Enlaces que no son piezas: navegación, tienda, redes, legales. */
const JUNK_LINK =
  /(facebook|twitter|instagram|youtube\.com\/(channel|c|user)\/|patreon|paypal|amazon\.|privacy|terms|cookie|contact|about|login|signup|cart|checkout|donate|subscribe|newsletter|rss|mailto:|javascript:)/i;
/** Página de una pieza concreta (para el segundo nivel). */
const PIECE_PAGE =
  /(transcription|sheet|music|solo|sax|score|ejercicio|exercice|partition|pdf-download|free-download|licks|sdm_downloads|lead-sheet|\/title\/|\/tunes?\/|\/songs?\/|\/downloads?\/|\/method|\/etudes?\/|repertoire)/i;
/** Descarga directa aunque la URL no acabe en .pdf (WordPress, SDM, foros…). */
const DOWNLOAD_HINT =
  /([?&](download|dl|file|wpdmdl|attachment|force_download)=|sdm_process_download|\/download-file|\/force-download|\.pdf\/|\/pdf\/|format=pdf)/i;

/** Índices, letras sueltas y paginaciones: nunca son una pieza. */
const JUNK_PIECE_URL = /\/title\/[a-z]\/?$|\/category\/?$|\/titles?\/?$|[?&]page=\d|\/page\/\d+|\/(?:tags?|author)\//i;
const isJunkPieceUrl = (url) => JUNK_PIECE_URL.test(url);

/**
 * Nombre real de la página: `og:title` o `<title>`, sin el sufijo del sitio.
 * "Body and Soul transcription - SaxTeacher UK" → "Body and Soul transcription".
 */
export function pageTitleOf(html, host = "") {
  const meta =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i)?.[1] ??
    html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i)?.[1] ??
    "";
  let title = stripTags(meta);
  if (!title) return "";

  // Fuera el sufijo de marca: "… - SaxTeacher UK", "… | Saxophone Sheet Music".
  const parts = title.split(/\s+[|·–—-]\s+/).map((part) => part.trim()).filter(Boolean);
  const hostWord = hostOf(`https://${host}`).split(".")[0];
  const squash = (value) => value.toLowerCase().replace(/[^a-z]/g, "");
  const hostKey = squash(hostWord).slice(0, 8);
  const noise = new RegExp(`(^|\\b)(saxophone|sheet music|home|free|downloads?|blog|${hostWord})`, "i");
  // "… — ZDENKO IVANUSIC ONLINE" también es marca del sitio, aunque no
  // coincida letra a letra con el dominio.
  while (
    parts.length > 1 &&
    (noise.test(parts[parts.length - 1]) ||
      (hostKey.length >= 5 && squash(parts[parts.length - 1]).includes(hostKey)))
  ) {
    parts.pop();
  }
  title = parts.join(" — ").trim();
  return title.length >= 3 && title.length <= 160 ? title : "";
}

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.split("=")[1];
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1] && !args[index + 1].startsWith("--")) return args[index + 1];
  return index !== -1 ? "true" : fallback;
};

const onlyHost = flag("only", null);
const limit = Number(flag("limit", "0")) || 0;
const delayMs = Number(flag("delay", "300"));
const timeoutMs = Number(flag("timeout", "15000"));
const maxSubPages = Number(flag("max-subpages", "80")) || 80;
const listOnly = flag("list-only", false) === "true";
/** Reutiliza el rastreo guardado en scripts/crawl-cache.json en vez de salir a la red. */
const fromCache = flag("from-cache", false) === "true";
/** No guarda la caché del rastreo (útil en CI donde no se quiere ensuciar el repo). */
const skipCache = flag("no-cache", false) === "true";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ------------------------------------------------------------- utilidades ----

const NAMED_ENTITIES = {
  amp: "&",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  flat: "♭",
  sharp: "♯",
  deg: "°",
  eacute: "é",
  egrave: "è",
  aacute: "á",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  ntilde: "ñ",
  uuml: "ü",
  ouml: "ö",
  auml: "ä",
};

export const decodeEntities = (value) =>
  String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try {
        return String.fromCodePoint(Number.parseInt(hex, 16));
      } catch {
        return "";
      }
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCodePoint(Number.parseInt(dec, 10));
      } catch {
        return "";
      }
    })
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);

/** Texto de enlace utilizable como título: sin adornos ni botones. */
export function cleanLabel(raw) {
  return decodeEntities(String(raw ?? ""))
    .replace(/\s+/g, " ")
    .replace(/^[>•·‣→»\-–—\s]+/, "")
    .replace(/\s*[»›→]+\s*$/, "")
    .replace(/\s*[-–—|]?\s*(download|descargar|get|open|view|ver|pdf|free|sheet music|lead sheet|partitura|click here|más info|read more)\s*$/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s:;,.]+|[\s:;,.]+$/g, "")
    .trim();
}

const stripTags = (value) => decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

/** Título legible a partir del nombre del fichero: libros.pdf → "Libros". */
const labelFromUrl = (url) => {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "");
    const base = name
      .replace(/\.(pdf|jpe?g|png|gif|webp|mp4|webm|mov)$/i, "")
      .replace(/[-_+]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    return base.length >= 3 ? base : "";
  } catch {
    return "";
  }
};

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const isEmbedBlocked = (url) => {
  const host = hostOf(url);
  return EMBED_BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
};

const resolveUrl = (raw, base) => {
  try {
    const url = new URL(decodeEntities(raw).trim(), base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.pathname.startsWith("/cdn-cgi/")) return "";
    return url.href;
  } catch {
    return "";
  }
};

export function videoEmbedUrl(raw) {
  try {
    const url = new URL(decodeEntities(raw));
    const host = url.hostname.replace(/^www\./, "");
    const path = url.pathname;

    if (host === "youtu.be") {
      const id = path.slice(1).split("/")[0];
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : "";
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
      const embed = path.match(/^\/embed\/([A-Za-z0-9_-]{6,})/);
      if (embed) return `https://www.youtube-nocookie.com/embed/${embed[1]}`;
      const shorts = path.match(/^\/shorts\/([A-Za-z0-9_-]{6,})/);
      if (shorts) return `https://www.youtube-nocookie.com/embed/${shorts[1]}`;
      return "";
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = path.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
      return id ? `https://player.vimeo.com/video/${id}` : "";
    }
    if (host === "dailymotion.com") {
      const id = path.match(/\/video\/([A-Za-z0-9]+)/)?.[1];
      return id ? `https://www.dailymotion.com/embed/video/${id}` : "";
    }
    return "";
  } catch {
    return "";
  }
}

const isVideoFile = (url) => VIDEO_EXT.test(url);

const slug = (value) =>
  String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

// ---------------------------------------------------------------- matching ---

const STOPWORDS = new Set([
  "solo", "soli", "the", "and", "for", "with", "from", "version", "versions",
  "transcription", "transcriptions", "sheet", "music", "pdf", "pdfs", "alto",
  "tenor", "bari", "baritone", "soprano", "sax", "saxophone", "blues", "full",
  "book", "method", "collection", "jazz", "free", "online", "part", "score",
  "easy", "download", "downloads", "songs", "song", "print", "printable",
  "sample", "catalogue", "catalog", "arrangement", "theme", "exercises",
  "etudes", "mechanism", "maintain", "maintenance", "care", "chart", "charts",
  "master", "take", "alternate", "alternates",
]);

const normalize = (value) =>
  decodeEntities(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const rawWords = (value) => normalize(value).split(/[^a-z0-9]+/).filter(Boolean);

export const wordsOf = (value) => rawWords(value).filter((word) => word.length >= 3);

export const titleTokens = (title, minLength = 3) =>
  rawWords(title).filter((word) => word.length >= minLength && !STOPWORDS.has(word));

const wordMatches = (token, word) => {
  if (token.length <= 3) return word === token;
  if (word.includes(token) || token.includes(word)) return true;
  if (token.length >= 5 && word.length >= 4 && (token.endsWith(word) || word.endsWith(token))) return true;
  return false;
};

export function scoreCandidate(title, candidate, minLength = 3) {
  const tokens = titleTokens(title, minLength);
  if (!tokens.length) return 0;
  const words = rawWords(`${candidate.text ?? ""} ${candidate.url ?? ""}`).filter(
    (word) => word.length >= minLength,
  );
  let matched = 0;
  for (const token of tokens) {
    if (words.some((word) => wordMatches(token, word))) matched += 1;
  }
  return matched / tokens.length;
}

/**
 * Coincidencia por "slug": "Well You Needn't" ↔ "Well You Neednt_Bb.pdf".
 * Es la red que atrapa los temas cuyo nombre el sitio escribe con guiones,
 * espacios o apóstrofos distintos.
 */
export function matchesBySlug(title, ...haystacks) {
  const needle = normalize(title).replace(/[^a-z0-9]+/g, "");
  if (needle.length < 5) return false;
  return haystacks.some((value) => normalize(String(value ?? "")).replace(/[^a-z0-9]+/g, "").includes(needle));
}

const KEY_BY_INSTRUMENT = { Alto: "eb", Bari: "eb", Tenor: "bb", Soprano: "bb" };

/** Tonalidad declarada en el nombre: "Bernie's Tune (Bb Version)" → "Bb". */
export function keyOf(text) {
  const match = String(text).match(/\(?\b(C|Bb|Eb|F)\b\s*(version|part|sax)?\)?/i);
  if (!match) return null;
  const value = match[1].toLowerCase();
  if (value === "bb") return "Bb";
  if (value === "eb") return "Eb";
  if (value === "c") return "C";
  if (value === "f") return "F";
  return null;
}

// -------------------------------------------------------------- extracción ---

/**
 * Saca de una página todas sus piezas: PDFs, vídeos, imágenes y enlaces a
 * páginas de piezas. Espejado (simplificado) en src/lib/scrape.ts.
 */
export function extractPageItems(html, baseUrl) {
  const pdfs = [];
  const videos = [];
  const images = [];
  const subpages = [];
  const seen = new Set();

  const push = (list, item) => {
    const key = item.url;
    if (!key || seen.has(key)) return;
    seen.add(key);
    list.push(item);
  };

  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const raw = decodeEntities(match[1]).trim();
    if (!raw || raw.startsWith("#")) continue;
    const url = resolveUrl(raw, baseUrl);
    if (!url) continue;
    const text = stripTags(match[2]);
    if (text.length < 3 || JUNK_LINK.test(url)) continue;

    if (PDF_EXT.test(url) || DOWNLOAD_HINT.test(url)) {
      push(pdfs, { url, text, direct: PDF_EXT.test(url) });
      continue;
    }
    const embed = videoEmbedUrl(url);
    if (embed) {
      push(videos, { url, embedUrl: embed, text });
      continue;
    }
    if (isVideoFile(url)) {
      push(videos, { url, embedUrl: url, text });
      continue;
    }
    if (IMAGE_EXT.test(url) && !JUNK_IMAGE.test(url)) {
      push(images, { url, text });
      continue;
    }
    if (hostOf(url) === hostOf(baseUrl) && PIECE_PAGE.test(url) && !PIECE_PAGE.test(baseUrl)) {
      push(subpages, { url, text });
    }
  }

  return { pdfs, videos, images, subpages };
}

const imslpFileEntry = (html) => {
  const match = html.match(/Special:ImagefromIndex\/(\d+)/);
  return match ? `https://imslp.org/wiki/Special:ImagefromIndex/${match[1]}` : "";
};

/** Sufijo de tonalidad/versión al final del título: "… - Bb", "… (Eb Version)". */
const KEY_TAIL =
  /(?:\s*[-–—]\s*|\s*[([]\s*)?\b(bb|eb|c|f|b[- ]?flat|e[- ]?flat|concert)\b\s*(version|part|sax|for [a-z &]+)?\s*\)?]?\s*$/i;
/** Palabras que forman una etiqueta de parte ("Bb For Tenor Sax"), no un tema. */
const PART_WORDS =
  /^(?:(?:bb|eb|c|f|b[- ]?flat|e[- ]?flat|concert|alto|tenor|bari|baritone|soprano|sax|saxos?|saxophones?|for|part|parts|score|full|lead|sheet|music|version|download|and|&|\+)\s*)+$/i;
/** Listas de instrumentos que algunos sitios pegan al título ("… Trumpet, clarinet Download"). */
const INSTRUMENT_LIST =
  /\b(saxophones?|trumpets?|clarinets?|flutes?|pianos?|guitars?|trombones?|bass|vocals?)\b\s*,\s*[a-z]/i;

/** Quita la tonalidad y la versión del final: "Tenor Conclave - Bb". */
const stripKeyTail = (value) => {
  let clean = String(value);
  while (KEY_TAIL.test(clean)) clean = clean.replace(KEY_TAIL, "").trim();
  return clean.replace(/[\s([–—-]+$/, "").trim();
};

/** ¿Es una etiqueta genérica y no el nombre de una pieza? */
export function isJunkTitle(value) {
  const raw = String(value ?? "").replace(/\s+/g, " ").trim();
  if (raw.length < 2) return true;
  // `cleanLabel` borra adornos como "free" al final: si deja el título vacío,
  // se conserva el texto original (hay piezas que se llaman "Free").
  const text = stripKeyTail(cleanLabel(raw)) || raw;
  if (text.length < 2 || !/[a-z]{3}/i.test(text)) return true;
  if (PART_WORDS.test(text)) return true;
  if (INSTRUMENT_LIST.test(text)) return true;
  if (
    /^(download|downloads?|download \d+ files?|descargar|pdf|file|archivo|here|aqu[íi]|click|link|ver|view|more|más|full (score|transcription)|transcription|part \d+|score & recording.*)$/i.test(
      text,
    )
  ) {
    return true;
  }
  // Textos de botón de vídeo: no nombran ninguna pieza.
  if (/^(link to the video|watch on youtube|youtube( video)?|video|v[íi]deo|watch|listen|play)$/i.test(text)) {
    return true;
  }
  // Un título larguísimo es un párrafo del sitio, no una pieza.
  return text.length > 90;
}

/** "Johnny Hodges - Blues O Mighty (Bb)" → { artist, tune, key }. */
export function splitTitle(text) {
  const source = cleanLabel(text) || String(text ?? "").replace(/\s+/g, " ").trim();
  const key = keyOf(source);
  let clean = source
    .replace(/\([^)]*(version|part|sax|pdf|download|full|score|chords?)[^)]*\)?/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Tonalidad/versión al final: "Tenor Conclave - Bb", "Tune Up (Eb Version)".
  clean = stripKeyTail(clean);

  const dashed = clean.split(/\s[-–—|]\s/);
  if (dashed.length >= 2) {
    const artist = dashed[0].trim();
    const tune = dashed.slice(1).join(" - ").trim();
    // "Tenor Madness — Form, Changes & How to Play It" es un artículo sobre la
    // pieza, no un tema de otro solista: la derecha describe, no nombra.
    const describes = /^(form|changes?|chords?|how|play ?along|backing|lesson|guide|tutorial|analysis|explained|transcription|overview|breakdown|practice|masterclass|study)\b/i.test(
      tune,
    );
    // "Tune Up Solo — Bb Version": la parte derecha es la tonalidad, no el tema.
    if (
      artist.length >= 3 &&
      tune.length >= 3 &&
      !describes &&
      !PART_WORDS.test(tune) &&
      !PART_WORDS.test(artist)
    ) {
      return { artist, tune, key };
    }
  }
  return { artist: null, tune: clean || source, key };
}

/** Categorías que acepta la app: cualquier otra se reinterpreta. */
export const ALLOWED_CATEGORIES = new Set([
  "Solo",
  "Estudio/Método",
  "Partitura",
  "Guía/Recurso",
  "Índice de proyecto",
]);

/** Categoría legible: arregla las etiquetas heredadas del listado antiguo. */
export function normalizeCategory(category, text, project) {
  const value = String(category ?? "").trim();
  if (ALLOWED_CATEGORIES.has(value)) return value;
  if (/^solo\b/i.test(value)) return "Solo";
  if (/[ée]tude|etude|study|method|m[ée]todo|exercic/i.test(value)) return "Estudio/Método";
  if (/guide|gu[íi]a|resource|recurso|index|[íi]ndice/i.test(value)) return "Guía/Recurso";
  return categoryFor(text, project);
}

const CATEGORY_RULES = [
  [/method|m[ée]todo|exercic|etude|[ée]tude|study|mechanism|mechanisme|scale|long.?tone|warm.?up|daily/i, "Estudio/Método"],
  [/fingering|chart|maintenance|care|guide|how.?to|review|history|repair/i, "Guía/Recurso"],
];

function categoryFor(text, project) {
  const value = `${text}`;
  for (const [pattern, category] of CATEGORY_RULES) {
    if (pattern.test(value)) return category;
  }
  return SOLO_PROJECTS.has(project) ? "Solo" : "Partitura";
}

// ------------------------------------------------------------------ fetching -

async function fetchPage(sourceUrl) {
  const response = await fetch(sourceUrl, {
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,application/pdf,image/*;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,es;q=0.8",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const isText =
    contentType.includes("text") || contentType.includes("html") || contentType.includes("xml");
  const html = response.ok && isText ? await response.text() : "";
  return { status: response.status, contentType, finalUrl: response.url || sourceUrl, html };
}

const isBlockedStatus = (status) => status === 401 || status === 403 || status === 429;
const isDeadStatus = (status) => status === 0 || status === 404 || status === 410;

const indexCache = new Map();
async function loadIndex(indexUrl) {
  if (indexCache.has(indexUrl)) return indexCache.get(indexUrl);
  const index = await fetchPage(indexUrl);
  const anchors = [];
  const seen = new Set();
  for (const match of (index.html || "").matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = resolveUrl(match[1], index.finalUrl);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    anchors.push({ url, text: stripTags(match[2]) });
  }
  const entry = { indexUrl, anchors };
  indexCache.set(indexUrl, entry);
  return entry;
}

async function repairFromIndex(page, title) {
  const indexUrl = PROJECT_INDEXES[hostOf(page.sourceUrl)];
  if (!indexUrl) return null;
  const index = await loadIndex(indexUrl);
  const match = index.anchors.find(
    (anchor) => scoreCandidate(title, anchor) >= 0.6 || slug(anchor.text) === slug(title),
  );
  return match ? { indexUrl, url: match.url, text: match.text } : null;
}

// ------------------------------------------------------------------ fichas ---

const now = () => new Date().toISOString();

function makeItemResource({ page, item, kind, media, tune, artist, sourceUrl, pageUrl, note, status }) {
  const label = tune || item.text;
  const project = page.project;
  const keySuffix = media.key ? ` (${media.key})` : "";
  return {
    id: slug(`${project}-${artist ?? ""}-${label}-${media.key ?? kind}`),
    title: artist && label ? `${artist} — ${label}${keySuffix}` : `${label}${keySuffix}`,
    tune: label || null,
    artist: artist ?? null,
    project,
    category: categoryFor(`${label} ${sourceUrl}`, project),
    instrument: null,
    key: media.key ?? null,
    origin: "crawl",
    description: note ?? `Encontrado en ${project}.`,
    license: page.license ?? "Enlaces a terceros (verificar cada pieza)",
    sourceUrl,
    pageUrl: pageUrl ?? page.sourceUrl,
    // `page` es la fuente del listado (sin HTTP): el estado real lo trae quien
    // acaba de visitarla.
    status: status ?? page.status ?? 200,
    reached: true,
    blocked: false,
    repaired: false,
    media: {
      kind,
      url: media.url,
      embedUrl: media.embedUrl,
      downloadUrl: media.downloadUrl,
      embeddable: media.embeddable ?? true,
      match: media.match,
    },
    candidates: { pdfs: [], images: [], videos: [] },
    checkedAt: now(),
  };
}

/**
 * Fusiona fichas con el mismo id (mismo fichero visto en dos páginas): se
 * conservan los datos ya conocidos y se rellenan los huecos con la otra copia.
 */
function mergeById(list) {
  const map = new Map();
  for (const item of list) {
    const prev = map.get(item.id);
    if (!prev) {
      map.set(item.id, item);
      continue;
    }
    const richer = prev.media?.kind && prev.media.kind !== "page" ? prev : item;
    map.set(item.id, {
      ...prev,
      ...richer,
      id: prev.id,
      tune: prev.tune ?? item.tune,
      artist: prev.artist ?? item.artist,
      instrument: prev.instrument ?? item.instrument,
      key: prev.key ?? item.key,
      title: prev.tune || prev.artist ? prev.title : item.title || prev.title,
    });
  }
  return [...map.values()];
}

/** Convierte los ficheros de una página (y sus subpáginas) en fichas. */
function itemsFromPage(page, html, finalUrl, titleHint = "", status = 200) {
  const resources = [];
  const subpages = [];

  // Texto genérico de botón: no sirve como título de pieza.
  const GENERIC_TEXT = /^(pdf|download|downloads|descargar|bb|eb|c|f|b-flat|e-flat|tenor|alto|bari|soprano|lead sheet|sheet music|partitura|score|music|aquí|here|click|ver|view|free|get|más|more)$/i;

  const bestLabel = (item) => {
    const raw = stripTags(item.text || "");
    const short = raw.length <= 70 ? raw : raw.slice(0, 70).replace(/[\s,;:.-]+[^\s]*$/, "");
    const paragraph = raw.length > 70 ? cleanLabel(short) : "";
    const candidates = [
      cleanLabel(raw),
      paragraph,
      cleanLabel(titleHint),
      labelFromUrl(item.url ?? ""),
    ].filter((value) => value && value.length >= 3 && !GENERIC_TEXT.test(value));

    // Un texto de párrafo entero no es un título: si el ancla se enrolla y hay
    // título de página, se prefiere el más corto y concreto.
    if (titleHint && raw.length > 70) {
      const pageLabel = cleanLabel(titleHint);
      if (pageLabel.length >= 3) return pageLabel;
    }
    return candidates[0] ?? "";
  };

  const splitFor = (item) => {
    const label = bestLabel(item);
    const { artist, tune, key } = splitTitle(label);
    const keyFromFile = keyOf(`${item.text ?? ""} ${item.url ?? ""}`);
    return { artist, tune: tune || label, key: keyFromFile || key, label };
  };

  const handle = (sourceUrl, items, pageUrl) => {
    for (const pdf of items.pdfs) {
      const { artist, tune, key } = splitFor(pdf);
      resources.push(
        makeItemResource({
          page,
          item: pdf,
          kind: "pdf",
          sourceUrl,
          pageUrl,
          status,
          tune,
          artist,
          media: { url: pdf.url, downloadUrl: pdf.direct === false ? undefined : pdf.url, key, embeddable: true },
        }),
      );
    }
    for (const video of items.videos) {
      const { artist, tune, key } = splitFor(video);
      resources.push(
        makeItemResource({
          page,
          item: video,
          kind: "video",
          sourceUrl,
          pageUrl,
          status,
          tune,
          artist,
          media: { url: video.url, embedUrl: video.embedUrl, key, embeddable: true },
        }),
      );
    }
    for (const image of items.images) {
      const { artist, tune, key } = splitFor(image);
      resources.push(
        makeItemResource({
          page,
          item: image,
          kind: "image",
          sourceUrl,
          pageUrl,
          status,
          tune,
          artist,
          media: { url: image.url, key, embeddable: true },
        }),
      );
    }
  };

  const items = extractPageItems(html, finalUrl);
  handle(finalUrl, items, finalUrl);
  subpages.push(...items.subpages);
  return { resources, subpages };
}

/** Ficha de la propia página (métodos, guías, índices). */
function pageResource(page, { status, blocked, html, finalUrl }) {
  const host = hostOf(finalUrl);
  const items = extractPageItems(html, finalUrl);
  const title = page.title;
  const firstPdf = items.pdfs[0];
  const isPdfPage = !items.pdfs.length && /\.pdf(\?|#|$)/i.test(finalUrl);

  let media = { kind: "page", url: page.sourceUrl, embeddable: !isEmbedBlocked(page.sourceUrl) && !blocked };

  if (isPdfPage) {
    media = { kind: "pdf", url: finalUrl, downloadUrl: finalUrl, embeddable: true };
  } else if (host === "imslp.org") {
    media = {
      kind: "page",
      url: page.sourceUrl,
      downloadUrl: imslpFileEntry(html) || undefined,
      embeddable: true,
    };
  } else if (firstPdf && items.pdfs.length === 1) {
    media = { kind: "pdf", url: firstPdf.url, downloadUrl: firstPdf.url, embeddable: true };
  } else if (items.videos.length === 1 && !items.pdfs.length) {
    media = {
      kind: "video",
      url: items.videos[0].url,
      embedUrl: items.videos[0].embedUrl,
      embeddable: true,
    };
  }

  return {
    id: page.id,
    title,
    tune: null,
    artist: null,
    project: page.project,
    category: page.category ?? categoryFor(`${title} ${page.sourceUrl}`, page.project),
    instrument: page.instrument ?? null,
    key: null,
    origin: "page",
    description: page.description ?? `Página de ${page.project}.`,
    license: page.license ?? "Enlaces a terceros (verificar cada pieza)",
    sourceUrl: page.sourceUrl,
    pageUrl: page.sourceUrl,
    status,
    reached: status >= 200 && status < 400,
    blocked,
    repaired: false,
    media,
    candidates: {
      pdfs: items.pdfs.slice(0, 12).map((item) => ({ url: item.url, text: item.text })),
      images: items.images.slice(0, 6).map((item) => ({ url: item.url, text: item.text })),
      videos: items.videos.slice(0, 6).map((item) => item.url),
    },
    checkedAt: now(),
  };
}

// -------------------------------------------------------------------- main ---

async function main() {
  const sources = JSON.parse(await readFile(SOURCES, "utf8"));
  const library = JSON.parse(await readFile(LIBRARY, "utf8"));
  const curated = JSON.parse(await readFile(CURATED, "utf8"));

  let pages = sources.resources;
  if (onlyHost) pages = pages.filter((page) => hostOf(page.sourceUrl).endsWith(onlyHost));
  if (limit) pages = pages.slice(0, limit);

  console.log(`Visitando ${pages.length} páginas…`);
  let resources = [];
  let report = [];

  // El rastreo es lo lento (minutos): se guarda en caché para poder repetir
  // sólo el emparejamiento con tu lista (`--from-cache`) en segundos.
  if (fromCache) {
    try {
      const cached = JSON.parse(await readFile(CACHE, "utf8"));
      // Una caché vieja puede venir sin `status`: se rellena para no romper la BBDD.
      resources = (cached.resources ?? []).map((resource) => ({ status: 200, ...resource }));
      report = cached.report ?? [];
      console.log(`Caché: ${resources.length} fichas de ${report.length} páginas (${cached.generatedAt})`);
    } catch {
      console.warn("No hay caché de rastreo: se rastrea de nuevo.");
    }
  }

  if (!listOnly && !resources.length) {
    // Anclas de aplicaciones SPA (BopLand): no se pueden rastrear, pero son
    // piezas reales a las que se puede enlazar directamente.
    const anchors = pages.filter((page) => page.kind === "anchor");
    const fetchable = pages.filter((page) => page.kind !== "anchor");
    for (const page of anchors) {
      resources.push({
        id: page.id,
        title: page.title,
        tune: page.title,
        artist: null,
        project: page.project,
        category: page.category ?? "Solo",
        instrument: null,
        key: keyOf(page.title),
        origin: "crawl",
        description: page.description ?? `Lick de ${page.title} en ${page.project}.`,
        license: page.license,
        sourceUrl: page.sourceUrl,
        pageUrl: page.sourceUrl,
        status: 200,
        reached: true,
        blocked: false,
        repaired: false,
        media: { kind: "page", url: page.sourceUrl, embeddable: !isEmbedBlocked(page.sourceUrl) },
        candidates: { pdfs: [], images: [], videos: [] },
        checkedAt: now(),
      });
    }

    const visitPage = async (page, label) => {
      try {
        let fetched = await fetchPage(page.sourceUrl);
        let repaired = false;

        if (isDeadStatus(fetched.status) && !isBlockedStatus(fetched.status)) {
          const fix = await repairFromIndex(page, page.title);
          if (fix) {
            repaired = true;
            fetched = await fetchPage(fix.url);
            console.log(`${label}\n   ↻ reparado: ${fix.url}`);
          }
        }

        const { status, html, finalUrl } = fetched;
        const blocked = isBlockedStatus(status);
        const alive = status >= 200 && status < 400;

        if (!alive) {
          resources.push({
            ...pageResource(page, { status, blocked, html: "", finalUrl: page.sourceUrl }),
            reached: false,
            blocked,
          });
          report.push({ url: page.sourceUrl, status, items: 0, blocked, repaired });
          console.log(`${label}\n   → ${status}${blocked ? " (bloquea bots)" : ""}`);
          if (delayMs) await sleep(delayMs);
          return;
        }

        // Una página de pieza se representa por su ficha de pieza (abajo), no
        // como "página de proyecto".
        if (page.kind !== "piece") {
          const own = pageResource(page, { status, blocked, html, finalUrl });
          if (repaired) own.repaired = true;
          resources.push(own);
        }

        // En una página de pieza, el título real de la página manda sobre el
        // texto del enlace ("Descargar", "Bb"…).
        const titleHint = page.kind === "piece" ? pageTitleOf(html, hostOf(finalUrl)) : "";
        const { resources: pageItems, subpages } = itemsFromPage(page, html, finalUrl, titleHint, status);

        // Página de pieza sin fichero enlazado (descarga por JavaScript, muro
        // de reCAPTCHA, reproductor propio…): la ficha apunta a la página, que
        // es desde donde se abre o se descarga.
        if (page.kind === "piece" && pageItems.length === 0) {
          // El título ya viene limpio de la página: no se reparte en
          // "solista — tema" porque cada sitio lo ordena a su manera.
          const tune = titleHint || page.title;
          const key = keyOf(`${tune} ${finalUrl}`);
          const sdm = /sdm_downloads|\/(downloads?)\//i.test(finalUrl);
          pageItems.push(
            makeItemResource({
              page,
              item: { text: page.title, url: finalUrl },
              kind: "page",
              sourceUrl: finalUrl,
              pageUrl: finalUrl,
              status,
              tune,
              artist: null,
              note: sdm
                ? "La descarga pasa por un botón con reCAPTCHA en el sitio: se abre ahí para bajar el PDF."
                : undefined,
              media: { url: finalUrl, key, embeddable: !isEmbedBlocked(finalUrl) },
            }),
          );
        }

        // Segundo nivel: páginas de piezas enlazadas desde un índice.
        const crawlSub = subpages.slice(0, maxSubPages);
        for (const subpage of crawlSub) {
          try {
            const sub = await fetchPage(subpage.url);
            if (sub.status < 200 || sub.status >= 400 || !sub.html) continue;
            const subTitle = pageTitleOf(sub.html, hostOf(sub.finalUrl));
            const { resources: subItems } = itemsFromPage(page, sub.html, sub.finalUrl, subTitle, sub.status);
            if (subItems.length) pageItems.push(...subItems);
            else if (isJunkPieceUrl(subpage.url) || /^["“]?[A-Z]["”]? titles|^index|^browse|^page \d/i.test(subTitle)) {
              // Índices alfabéticos y paginaciones: no son piezas.
            } else {
              const { artist, tune, key } = splitTitle(cleanLabel(subpage.text) || subTitle || "Pieza");
              pageItems.push(
                makeItemResource({
                  page,
                  item: subpage,
                  kind: "page",
                  sourceUrl: subpage.url,
                  pageUrl: subpage.url,
                  tune: tune || subTitle || subpage.text,
                  artist,
                  note: /sdm_downloads|\/(downloads?)\//i.test(subpage.url)
                    ? "Descarga protegida con reCAPTCHA en el sitio original: se abre ahí para bajar el PDF."
                    : undefined,
                  media: { url: subpage.url, key, embeddable: !isEmbedBlocked(subpage.url) },
                }),
              );
            }
          } catch {
            // Subpágina que no responde: se ignora, la página madre ya está fichada.
          }
          if (delayMs) await sleep(delayMs);
        }

        resources.push(...pageItems);
        report.push({ url: page.sourceUrl, status, items: pageItems.length, blocked, repaired });
        console.log(`${label}\n   → ${status} ${pageItems.length} piezas (+${crawlSub.length} subpáginas)`);
      } catch (error) {
        const message = String(error?.message ?? error);
        resources.push({
          ...pageResource(page, { status: 0, blocked: false, html: "", finalUrl: page.sourceUrl }),
          reached: false,
          error: message,
        });
        report.push({ url: page.sourceUrl, status: 0, items: 0, error: message });
        console.log(`${label}\n   → ERROR ${message}`);
      }

      if (delayMs) await sleep(delayMs);
    };

    const workers = Math.max(1, Math.min(8, Number(flag("concurrency", "5")) || 5));
    let cursor = 0;
    const totalPages = fetchable.length;
    console.log(`Rastreando ${totalPages - anchors.length} páginas con ${workers} workers…`);
    const runWorker = async () => {
      while (cursor < totalPages) {
        const page = fetchable[cursor];
        const position = cursor + 1;
        cursor += 1;
        await visitPage(page, `[${position}/${totalPages}] ${page.sourceUrl}`);
      }
    };
    await Promise.all(Array.from({ length: workers }, runWorker));

    if (!skipCache) {
      await writeFile(
        CACHE,
        `${JSON.stringify({ generatedAt: now(), resources, report }, null, 0)}\n`,
        "utf8",
      );
    }
  }

  // ------------------------------------------------- piezas de tu lista -------
  // Un mismo fichero sale a veces en el índice y en la página de la pieza: se
  // fusiona en una sola ficha ANTES de emparejar. Si no, la marca "pedida" cae
  // sobre la copia que se descarta y la pieza de tu lista se pierde.
  resources = mergeById(resources);
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const crawledByProject = new Map();
  for (const resource of resources) {
    if (resource.origin !== "crawl") continue;
    const list = crawledByProject.get(resource.project) ?? [];
    list.push(resource);
    crawledByProject.set(resource.project, list);
  }

  let matchedItems = 0;
  /** Recuento por rama: así se ve qué hace el emparejamiento con tu lista. */
  const tally = { matched: 0, cloned: 0, cloneSkipped: 0, listed: 0, listSkipped: 0 };
  /** Ficheros ya adjudicados a una pieza de tu lista. */
  const claimed = new Map();

  for (const entry of library.items) {
    const candidates = crawledByProject.get(entry.project) ?? [];

    // El tema manda; el solista solo desempata (y la tonalidad, si el
    // instrumento que pediste necesita Bb o Eb).
    const scored = candidates
      .map((resource) => {
        const haystack = `${resource.tune ?? ""} ${resource.title}`;
        const tuneScore = scoreCandidate(entry.tune, { url: resource.media.url, text: haystack });
        const artistScore = entry.artist
          ? scoreCandidate(entry.artist, { url: "", text: `${resource.artist ?? ""} ${haystack}` })
          : 0;
        const key = (resource.key ?? "").toLowerCase();
        const keyBonus = entry.instrument && key
          ? (KEY_BY_INSTRUMENT[entry.instrument] === key ? 0.08 : -0.04)
          : 0;
        const fileBonus = resource.media.kind === "pdf" ? 0.05 : 0;
        // El fichero suele llevar el tema en el nombre: "AFoggyDay_Cuber_Bb.pdf".
        const slugHit = matchesBySlug(entry.tune, haystack, resource.media.url ?? "") ? 0.4 : 0;
        return {
          resource,
          tuneScore,
          artistScore,
          slugHit,
          score: tuneScore + slugHit + artistScore * 0.15 + keyBonus + fileBonus,
        };
      })
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const isMatch =
      best &&
      (best.slugHit > 0 || best.tuneScore >= 0.7 || (best.tuneScore >= 0.5 && best.artistScore >= 0.6));

    if (isMatch) {
      const target = best.resource;
      const fileKey = target.media.url || target.id;
      const owner = claimed.get(fileKey);

      if (!owner) {
        claimed.set(fileKey, entry.id);
        if (!target.artist && entry.artist) target.artist = entry.artist;
        if (!target.tune) target.tune = entry.tune;
        if (entry.context && !target.description.includes(entry.context)) {
          target.description = `${target.description} ${entry.context}.`.trim();
        }
        if (entry.instrument && !target.instrument) target.instrument = entry.instrument;
        target.requested = true;
        target.title =
          target.artist && target.tune ? `${target.artist} — ${target.tune}${target.key ? ` (${target.key})` : ""}` : target.title;
        target.category = categoryFor(`${target.tune} ${target.media.url}`, target.project);
        matchedItems += 1;
        tally.matched += 1;
        continue;
      }

      // Otra pieza de tu lista usa ese mismo fichero (dos solistas sobre el
      // mismo tema): se duplica la ficha con el solista que pediste.
      const cloneId = `${slug(entry.project)}-${slug(entry.artist ?? "varios")}-${slug(entry.tune)}-${slug(entry.instrument ?? "")}`;
      if (!byId.has(cloneId)) {
        byId.set(cloneId, {
          ...target,
          id: cloneId,
          title: entry.artist
            ? `${entry.artist} — ${entry.tune}${target.key ? ` (${target.key})` : ""}`
            : target.title,
          tune: entry.tune,
          artist: entry.artist,
          instrument: entry.instrument ?? target.instrument ?? null,
          requested: true,
          checkedAt: now(),
        });
        tally.cloned += 1;
      } else {
        tally.cloneSkipped += 1;
      }
      matchedItems += 1;
      continue;
    }

    // Pieza pedida que su página aún no expone (403, JavaScript…): sigue en el
    // buscador apuntando a la página, lista para reintentar el scraping.
    const id = `${slug(entry.project)}-${slug(entry.artist ?? "varios")}-${slug(entry.tune)}`;
    if (byId.has(id)) {
      tally.listSkipped += 1;
      continue;
    }
    tally.listed += 1;
    byId.set(id, {
      id,
      title: entry.artist ? `${entry.artist} — ${entry.tune}` : entry.tune,
      tune: entry.tune,
      artist: entry.artist,
      project: entry.project,
      category: categoryFor(`${entry.tune}`, entry.project),
      instrument: entry.instrument ?? null,
      key: null,
      origin: "list",
      requested: true,
      description: entry.context
        ? `Pedida en tu lista (${entry.context}); se abre en ${entry.project}.`
        : `Pedida en tu lista; se abre en ${entry.project}.`,
      license: "Enlaces a terceros (verificar cada pieza)",
      sourceUrl: entry.pageUrl,
      pageUrl: entry.pageUrl,
      status: 0,
      reached: false,
      blocked: false,
      repaired: false,
      media: { kind: "page", url: entry.pageUrl, embeddable: !isEmbedBlocked(entry.pageUrl) },
      candidates: { pdfs: [], images: [], videos: [] },
      checkedAt: now(),
    });
  }

  // ----------------------------------------------------- fichas curadas ------
  const curatedByUrl = new Map();
  for (const entry of curated.resources ?? []) {
    const list = curatedByUrl.get(entry.sourceUrl) ?? [];
    list.push(entry);
    curatedByUrl.set(entry.sourceUrl, list);
  }
  for (const [url, entries] of curatedByUrl) {
    if (entries.length !== 1) continue; // páginas compartidas: mandan las piezas rastreadas
    const entry = entries[0];
    const existing = [...byId.values()].find((resource) => resource.sourceUrl === url);
    if (existing) {
      existing.origin = "curated";
      existing.title = entry.title;
      existing.description = entry.description;
      existing.license = entry.license;
      existing.category = entry.category ?? existing.category;
      existing.instrument = existing.instrument ?? entry.instrument ?? null;
      continue;
    }
    byId.set(entry.id, {
      id: entry.id,
      title: entry.title,
      tune: null,
      artist: null,
      project: entry.project,
      category: entry.category ?? categoryFor(entry.title, entry.project),
      instrument: entry.instrument ?? null,
      key: null,
      origin: "curated",
      description: entry.description,
      license: entry.license,
      sourceUrl: url,
      pageUrl: url,
      status: 0,
      reached: false,
      blocked: false,
      repaired: false,
      media: { kind: "page", url, embeddable: !isEmbedBlocked(url) },
      candidates: { pdfs: [], images: [], videos: [] },
      checkedAt: now(),
    });
  }

  // Un mismo PDF puede aparecer enlazado desde dos páginas distintas (o desde
  // el mismo sitio en http y https): se queda una ficha por fichero, conservando
  // las que llevan solista distinto (dos artistas sobre el mismo tema).
  const fileArtist = new Map();
  const all = [...byId.values()]
    .filter((resource) => resource.tune || resource.origin !== "crawl")
    .filter((resource) => resource.origin !== "crawl" || !isJunkTitle(resource.tune))
    // Anclas de sección de las apps SPA ("#bass-clef-licks/"): no son piezas.
    .filter((resource) => !/#[^#]*\/$/.test(resource.sourceUrl ?? ""))
    // Primero las que llevan tu solista y las que ya tienen fichero resuelto:
    // son las que ganan cuando dos fichas comparten el mismo PDF.
    .sort(
      (a, b) =>
        (b.requested ? 1 : 0) - (a.requested ? 1 : 0) ||
        (b.artist ? 1 : 0) - (a.artist ? 1 : 0) ||
        (b.media.kind === "pdf" ? 1 : 0) - (a.media.kind === "pdf" ? 1 : 0),
    )
    .filter((resource) => {
      const url = resource.media.url ?? "";
      if (!url || !/^(pdf|video|image)$/.test(resource.media.kind)) return true;
      const artist = (resource.artist ?? "").toLowerCase();
      if (!fileArtist.has(url)) {
        fileArtist.set(url, artist);
        return true;
      }
      const known = fileArtist.get(url);
      // Dos solistas declarados sobre el mismo fichero: son dos piezas distintas.
      return Boolean(known && artist && known !== artist);
    });
  // Categorías heredadas del listado antiguo ("PDF", "Solo alto"…) se
  // reinterpretan para que los filtros de la app sólo muestren las válidas.
  for (const resource of all) {
    const fixed = normalizeCategory(
      resource.category,
      `${resource.tune ?? ""} ${resource.title} ${resource.media.url ?? ""}`,
      resource.project,
    );
    resource.category = fixed;
    if (fixed === "Solo" && !resource.instrument) {
      const instrument = /bari|bar[íi]tono/i.test(resource.title)
        ? "Bari"
        : /soprano/i.test(resource.title)
          ? "Soprano"
          : /alto/i.test(resource.title)
            ? "Alto"
            : /tenor/i.test(resource.title)
              ? "Tenor"
              : null;
      if (instrument) resource.instrument = instrument;
    }
  }
  all.sort((a, b) => a.project.localeCompare(b.project) || a.title.localeCompare(b.title));

  await mkdir(OUT_DIR, { recursive: true });
  const stats = {
    pages: report.length,
    pagesReached: report.filter((entry) => entry.status >= 200 && entry.status < 400).length,
    pagesRepaired: report.filter((entry) => entry.repaired).length,
    pagesBlocked: report.filter((entry) => entry.blocked).length,
    pagesDead: report.filter((entry) => !entry.repaired && entry.status >= 400 && !entry.blocked).length,
    withFile: all.filter((resource) => /^(pdf|video|image)$/.test(resource.media.kind)).length,
    pending: all.filter((resource) => resource.media.kind === "page").length,
    requested: all.filter((resource) => resource.requested).length,
    requestedWithFile: all.filter((resource) => resource.requested && /^(pdf|video|image)$/.test(resource.media.kind)).length,
  };
  const db = {
    generatedAt: now(),
    generator: "scripts/scrape.mjs",
    total: all.length,
    stats,
    projects: Object.keys(
      all.reduce((acc, resource) => {
        acc[resource.project] = true;
        return acc;
      }, {}),
    ).length,
    resources: all,
  };
  await writeFile(OUT_DB, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  await writeFile(
    OUT_REPORT,
    `${JSON.stringify({ generatedAt: db.generatedAt, pages: report.length, matchedItems, entries: report }, null, 2)}\n`,
    "utf8",
  );

  const byKind = all.reduce((acc, resource) => {
    acc[resource.media.kind] = (acc[resource.media.kind] ?? 0) + 1;
    return acc;
  }, {});
  const byProject = all.reduce((acc, resource) => {
    acc[resource.project] = (acc[resource.project] ?? 0) + 1;
    return acc;
  }, {});

  console.log(`\nBBDD: ${all.length} fichas · ${db.projects} proyectos · ${stats.withFile} con fichero`);
  console.log(
    `Páginas: ${stats.pages} rastreadas (${stats.pagesReached} ok, ${stats.pagesBlocked} bloquean bots, ${stats.pagesDead} caídas, ${stats.pagesRepaired} reparadas)`,
  );
  console.log(
    `Tu lista: ${library.items.length} piezas · ${stats.requested} en la BBDD · ${stats.requestedWithFile} con fichero directo (${matchedItems} emparejadas en el rastreo)`,
    `Emparejamiento: ${JSON.stringify(tally)}`,
  );
  console.log(`Tipos: ${JSON.stringify(byKind)}`);
  console.log(`Por proyecto: ${JSON.stringify(byProject, null, 0)}`);
  console.log(`Páginas caídas: ${report.filter((r) => !r.repaired && r.status >= 400 && !r.blocked).length}`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) await main();
