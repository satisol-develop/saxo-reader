/**
 * Saxo Reader — build-time scraper.
 *
 * Reads the curated seed list (`scripts/sources.json`), visits every source
 * page over real HTTP (no CORS involved) and writes the app database:
 *
 *   src/data/transcriptions.json  -> resources with resolved media + status
 *   src/data/scrape-report.json   -> per-URL diagnostics for the last run
 *
 * Qué hace con cada recurso:
 *   1. Visita la página y guarda el estado HTTP (404 → enlace caído,
 *      403/429 → el sitio bloquea bots pero abre en el navegador).
 *   2. Si está caída, intenta repararla desde el índice del proyecto
 *      (p. ej. SaxTeacher UK cambió de slugs) y empareja por título.
 *   3. Resuelve el medio: PDF, imagen, vídeo (con su URL de embed) o página.
 *      Cuando la página lista muchas partituras (Scooby Sax, 260 PDFs),
 *      elige la que corresponde al título en lugar de la primera.
 *
 * Usage:
 *   node scripts/scrape.mjs                 # full run
 *   node scripts/scrape.mjs --only imslp.org
 *   node scripts/scrape.mjs --limit 5 --delay 0
 *
 * Las reglas de extracción y emparejamiento están espejadas en
 * src/lib/scrape.ts para poder reintentar desde el navegador.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCES = path.join(__dirname, "sources.json");
const OUT_DIR = path.join(ROOT, "src", "data");
const OUT_DB = path.join(OUT_DIR, "transcriptions.json");
const OUT_REPORT = path.join(OUT_DIR, "scrape-report.json");

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/124.0 Safari/537.36 SaxoReaderBot/1.0 (+https://github.com/satisol-develop/saxo-reader)";

/** Hosts que rechazan el iframe (X-Frame-Options / CSP), verificados por HEAD. */
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

const PDF_EXT = /\.pdf(\?|#|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i;
const JUNK_IMAGE = /(logo|icon|sprite|banner|favicon|avatar|badge|button|arrow|payment|flag)/i;
const SHEET_IMAGE_HINT = /(score|sheet|partitur|transcri|music|solo|page[-_]?\d|ejercicio|exercice)/i;

/** Palabras que no discriminan entre partituras. */
const STOPWORDS = new Set([
  "solo", "soli", "the", "and", "for", "with", "from", "version", "versions",
  "transcription", "transcriptions", "sheet", "music", "pdf", "pdfs", "alto",
  "tenor", "bari", "baritone", "soprano", "sax", "saxophone", "blues", "full",
  "book", "method", "collection", "jazz", "free", "online", "part", "score",
  "easy", "download", "downloads", "songs", "song", "print", "printable",
  "sample", "catalogue", "catalog", "arrangement", "theme", "exercises",
  "etudes", "mechanism", "maintain", "maintenance", "care", "chart", "charts",
]);

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
const delayMs = Number(flag("delay", "400"));
const timeoutMs = Number(flag("timeout", "15000"));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const decodeEntities = (value) =>
  value
    .replace(/&amp;/gi, "&")
    .replace(/&#0?38;/g, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");

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

/** Solo enlaces que son un vídeo de verdad (no el canal ni la portada). */
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
      return ""; // canal, playlist o portada: no es un vídeo embebible
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

// ---------------------------------------------------------------- matching ---

const normalize = (value) =>
  decodeEntities(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Todas las palabras, sin filtrar por longitud. */
const rawWords = (value) => normalize(value).split(/[^a-z0-9]+/).filter(Boolean);

/** Palabras comparables de un texto (se descartan las de 1-2 letras). */
export const wordsOf = (value) => rawWords(value).filter((word) => word.length >= 3);

/**
 * Tokens relevantes. En el tema entrecomillado se admiten 2 letras, porque
 * cortar palabras cambiaría el tema ("Tune Up" no es "Bernie's Tune"); en el
 * título completo se piden 3 para no llenarse de ruido.
 */
export const titleTokens = (title, minLength = 3) =>
  rawWords(title).filter((word) => word.length >= minLength && !STOPWORDS.has(word));

const wordMatches = (token, word) => {
  // En palabras cortas sólo vale la coincidencia exacta: "me" no es "member".
  if (token.length <= 3) return word === token;
  if (word.includes(token) || token.includes(word)) return true;
  // Apellidos abreviados ("Trane" por "Coltrane", "Newk" por "Rollins").
  if (token.length >= 5 && word.length >= 4 && (token.endsWith(word) || word.endsWith(token))) return true;
  return false;
};

/**
 * Puntúa un candidato (texto del enlace + URL) contra el título del recurso.
 * Devuelve el ratio de tokens del título encontrados (0..1).
 */
export function scoreCandidate(title, candidate, minLength = 3) {
  const tokens = titleTokens(title, minLength);
  if (!tokens.length) return 0;
  // Las palabras del candidato se filtran con el mismo mínimo que los tokens,
  // para que un tema corto ("All of Me") pueda coincidir entero.
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
 * Texto entrecomillado del título: el nombre del tema, que manda sobre todo.
 * El apóstrofo no cuenta como comilla ("Blues O'Mighty" es un solo tema).
 */
export function quotedOf(title) {
  const quoted = [...String(title).matchAll(/["“”«»]([^"“”«»]{2,})["“”«»]/g)].map((match) => match[1]);
  return quoted.join(" ").trim();
}

/** Tonalidad del instrumento: alto/bari leen Eb, tenor/soprano leen Bb. */
const KEY_BY_INSTRUMENT = { Alto: "eb", Bari: "eb", Tenor: "bb", Soprano: "bb" };
const keyPattern = (key) => new RegExp(`(^|[^a-z])${key}($|[^a-z])`, "i");

/**
 * Elige el candidato que corresponde al título.
 *
 * Si el título lleva el tema entre comillas ("Naima"), esas palabras son la
 * clave: sin coincidencia de tema no se acepta nada, aunque el solista coincida
 * (evita asignar a "Phil Woods — Solar" el PDF de otro tema del mismo solista).
 * Entre varios candidatos válidos se prefiere el de la tonalidad del instrumento.
 */
export function pickBestCandidate(title, candidates, options = {}) {
  if (!candidates.length) return null;

  const quoted = quotedOf(title);
  const primary = quoted || title;

  const minLength = quoted ? 2 : 3;
  let pool = candidates.filter((candidate) => scoreCandidate(primary, candidate, minLength) >= 0.6);

  if (!pool.length) {
    // Un tema poco común citado entero ("Confirmation"): si sólo un candidato
    // contiene la palabra más larga, es ese.
    const longest = titleTokens(primary, minLength).sort((a, b) => b.length - a.length)[0];
    if (longest && longest.length >= 7) {
      const matches = candidates.filter((candidate) =>
        wordsOf(`${candidate.text ?? ""} ${candidate.url ?? ""}`).some((word) => wordMatches(longest, word)),
      );
      if (matches.length === 1) pool = matches;
    }
  }
  if (!pool.length) return null;

  const key = options.instrument ? KEY_BY_INSTRUMENT[options.instrument] : "";
  const scored = pool.map((candidate) => ({
    candidate,
    artist: scoreCandidate(title, candidate),
    keyMatch: key ? (keyPattern(key).test(`${candidate.text ?? ""} ${candidate.url ?? ""}`) ? 1 : 0) : 0,
  }));

  scored.sort((a, b) => b.artist - a.artist || b.keyMatch - a.keyMatch);
  const best = scored[0];

  // Confianza del emparejamiento: sirve para avisar en la ficha cuando el tema
  // coincide pero el solista del PDF es otro.
  const artistPart = String(title).split(/[—–]/)[0].trim();
  const artistScore = scoreCandidate(artistPart, best.candidate, 3);
  const match = artistScore >= 0.6 ? "solista+tema" : quoted ? "solo tema" : "único candidato";

  return { ...best.candidate, match };
}

// -------------------------------------------------------------- extraction ---

/**
 * Extrae los candidatos de una página: PDFs con el texto del enlace, imágenes
 * de partituras y vídeos. Espejado en src/lib/scrape.ts.
 */
export function extractMedia(html, baseUrl) {
  const pdfs = [];
  const images = [];
  const videos = [];
  const seen = new Set();

  const pushOnce = (list, value) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    list.push(value);
  };

  // Enlaces con su texto (<a href="x.pdf">Título</a>).
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = resolveUrl(match[1], baseUrl);
    if (!url) continue;
    const text = decodeEntities(match[2].replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();

    if (PDF_EXT.test(url)) {
      pdfs.push({ url, text });
      seen.add(url);
      continue;
    }
    const embed = videoEmbedUrl(url);
    if (embed) {
      pushOnce(videos, { url, embedUrl: embed, text });
      continue;
    }
    if (isVideoFile(url)) {
      pushOnce(videos, { url, embedUrl: url, text });
      continue;
    }
    if (IMAGE_EXT.test(url) && !JUNK_IMAGE.test(url)) pushOnce(images, { url, text });
  }

  // iframes/embeds sueltos y metaetiquetas de vídeo.
  for (const match of html.matchAll(/<(?:iframe|embed|source)\b[^>]*src\s*=\s*["']([^"']+)["']/gi)) {
    const url = resolveUrl(match[1], baseUrl);
    if (!url || pdfs.some((item) => item.url === url)) continue;
    const embed = videoEmbedUrl(url);
    if (embed) pushOnce(videos, { url, embedUrl: embed, text: "" });
    else if (PDF_EXT.test(url)) pdfs.push({ url, text: "" });
  }
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const name = (tag[0].match(/(?:property|name)\s*=\s*["']([^"']+)["']/i)?.[1] ?? "").toLowerCase();
    if (!/^(og:video|og:video:url|og:video:secure_url|twitter:player)$/.test(name)) continue;
    const content = tag[0].match(/content\s*=\s*["']([^"']+)["']/i)?.[1];
    const url = content ? resolveUrl(content, baseUrl) : "";
    if (url) pushOnce(videos, { url, embedUrl: videoEmbedUrl(url) || url, text: "" });
  }

  return { pdfs, images, videos };
}

const rankImages = (images) =>
  [...images].sort(
    (a, b) => (SHEET_IMAGE_HINT.test(a.url) ? 0 : 1) - (SHEET_IMAGE_HINT.test(b.url) ? 0 : 1),
  );

/** Marca una página como ficha de fichero de IMSLP (su botón real de descarga). */
const imslpFileEntry = (html) => {
  const match = html.match(/Special:ImagefromIndex\/(\d+)/);
  return match ? `https://imslp.org/wiki/Special:ImagefromIndex/${match[1]}` : "";
};

function pickMedia({ title, sourceUrl, contentType, html, finalUrl, blocked, instrument }) {
  const host = hostOf(sourceUrl);

  if (contentType.includes("application/pdf")) {
    return {
      media: { kind: "pdf", url: sourceUrl, downloadUrl: sourceUrl, embeddable: true },
      candidates: { pdfs: [{ url: sourceUrl, text: title }], images: [], videos: [] },
    };
  }
  if (contentType.startsWith("image/")) {
    return {
      media: { kind: "image", url: sourceUrl, embeddable: true },
      candidates: { pdfs: [], images: [{ url: sourceUrl, text: title }], videos: [] },
    };
  }
  if (videoEmbedUrl(sourceUrl) || isVideoFile(sourceUrl)) {
    return {
      media: { kind: "video", url: sourceUrl, embedUrl: videoEmbedUrl(sourceUrl) || sourceUrl, embeddable: true },
      candidates: { pdfs: [], images: [], videos: [{ url: sourceUrl, embedUrl: videoEmbedUrl(sourceUrl), text: title }] },
    };
  }

  const { pdfs, images, videos } = extractMedia(html, finalUrl || sourceUrl);
  const rankedImages = rankImages(images);

  // IMSLP sirve sus escaneos tras un anti-bot: la ficha se incrusta bien y
  // lleva el botón de descarga real, así que esa es la URL del visor.
  if (host === "imslp.org") {
    return {
      media: { kind: "page", url: sourceUrl, downloadUrl: imslpFileEntry(html) || undefined, embeddable: true },
      candidates: { pdfs: pdfs.slice(0, 12), images: rankedImages.slice(0, 6), videos: [] },
    };
  }

  const candidates = {
    pdfs: pdfs.slice(0, 12),
    images: rankedImages.slice(0, 6),
    videos: videos.slice(0, 6).map((video) => video.url),
  };

  // Sólo se elige un fichero si el título lo respalda: en una página con las
  // transcripciones de 200 temas, "el primer PDF" sería el de otro solista.
  const matchedPdf = pickBestCandidate(title, pdfs, { instrument });
  if (matchedPdf) {
    return {
      media: {
        kind: "pdf",
        url: matchedPdf.url,
        downloadUrl: matchedPdf.url,
        embeddable: true,
        match: matchedPdf.match,
      },
      candidates,
    };
  }
  const matchedVideo = pickBestCandidate(title, videos, { instrument });
  if (matchedVideo) {
    return {
      media: {
        kind: "video",
        url: matchedVideo.url,
        embedUrl: matchedVideo.embedUrl || matchedVideo.url,
        embeddable: true,
        match: matchedVideo.match,
      },
      candidates,
    };
  }
  const matchedImage = pickBestCandidate(title, rankedImages, { instrument });
  if (matchedImage) {
    return {
      media: { kind: "image", url: matchedImage.url, embeddable: true, match: matchedImage.match },
      candidates,
    };
  }

  // Página dedicada a un único medio (una partitura, un vídeo, un escaneo).
  const only = [...pdfs, ...videos, ...rankedImages];
  if (only.length === 1) {
    const single = only[0];
    if (pdfs.length) {
      return {
        media: { kind: "pdf", url: single.url, downloadUrl: single.url, embeddable: true, match: "único candidato" },
        candidates,
      };
    }
    if (videos.length) {
      return {
        media: {
          kind: "video",
          url: single.url,
          embedUrl: single.embedUrl || single.url,
          embeddable: true,
          match: "único candidato",
        },
        candidates,
      };
    }
    return { media: { kind: "image", url: single.url, embeddable: true, match: "único candidato" }, candidates };
  }

  // Sin medio identificable: se abre la página de origen en una pestaña nueva.
  return {
    media: { kind: "page", url: sourceUrl, embeddable: !isEmbedBlocked(sourceUrl) && !blocked },
    candidates,
  };
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

/** Índice de cada proyecto: se lee una sola vez por ejecución (menos peticiones). */
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
    anchors.push({ url, text: decodeEntities(match[2].replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim() });
  }

  const entry = { indexUrl, anchors };
  indexCache.set(indexUrl, entry);
  return entry;
}

/** Busca en el índice del proyecto la página viva que corresponde al título. */
async function repairFromIndex(source) {
  const indexUrl = PROJECT_INDEXES[hostOf(source.sourceUrl)];
  if (!indexUrl) return null;

  const index = await loadIndex(indexUrl);
  if (!index.anchors.length) return null;

  const match = pickBestCandidate(source.title, index.anchors, { instrument: source.instrument });
  if (!match) return null;
  return { indexUrl, url: match.url, text: match.text };
}

async function main() {
  const sources = JSON.parse(await readFile(SOURCES, "utf8"));
  let queue = sources.resources;
  if (onlyHost) queue = queue.filter((item) => hostOf(item.sourceUrl).endsWith(onlyHost));
  if (limit) queue = queue.slice(0, limit);

  console.log(`Scraping ${queue.length} sources…`);
  const resources = [];
  const report = [];

  for (const [index, source] of queue.entries()) {
    const label = `[${index + 1}/${queue.length}] ${source.sourceUrl}`;
    const base = {
      id: source.id,
      title: source.title,
      project: source.project,
      category: source.category,
      instrument: source.instrument ?? null,
      description: source.description,
      license: source.license,
      sourceUrl: source.sourceUrl,
    };

    try {
      let { status, contentType, html, finalUrl } = await fetchPage(source.sourceUrl);
      let repaired = null;
      let effectiveUrl = source.sourceUrl;

      if (isDeadStatus(status) && !isBlockedStatus(status)) {
        const fix = await repairFromIndex(source);
        if (fix) {
          repaired = fix;
          effectiveUrl = fix.url;
          ({ status, contentType, html, finalUrl } = await fetchPage(fix.url));
          console.log(`${label}\n   ↻ reparado desde el índice: ${fix.url}`);
        }
      }

      const alive = status >= 200 && status < 400;
      const blocked = isBlockedStatus(status);
      const picked = alive
        ? pickMedia({
            title: source.title,
            instrument: source.instrument,
            sourceUrl: effectiveUrl,
            contentType,
            html,
            finalUrl,
            blocked,
          })
        : { media: { kind: "none", url: "", embeddable: false }, candidates: { pdfs: [], images: [], videos: [] } };

      resources.push({
        ...base,
        sourceUrl: effectiveUrl,
        originalSourceUrl: repaired ? source.sourceUrl : undefined,
        resolvedFrom: finalUrl,
        repaired: Boolean(repaired),
        status,
        reached: alive,
        blocked,
        media: picked.media,
        candidates: picked.candidates,
        checkedAt: new Date().toISOString(),
      });
      report.push({
        url: effectiveUrl,
        originalUrl: repaired ? source.sourceUrl : undefined,
        status,
        kind: picked.media.kind,
        reached: alive,
        blocked,
        repaired: Boolean(repaired),
      });
      console.log(
        `${label}\n   → ${status}${blocked ? " (bloquea bots)" : ""} ${picked.media.kind} ${
          picked.media.url || picked.media.embedUrl || ""
        }`,
      );
    } catch (error) {
      const message = String(error?.message ?? error);
      resources.push({
        ...base,
        resolvedFrom: source.sourceUrl,
        repaired: false,
        status: 0,
        reached: false,
        blocked: false,
        error: message,
        media: { kind: "none", url: "", embeddable: false },
        candidates: { pdfs: [], images: [], videos: [] },
        checkedAt: new Date().toISOString(),
      });
      report.push({ url: source.sourceUrl, status: 0, kind: "error", reached: false, blocked: false, error: message });
      console.log(`${label}\n   → ERROR ${message}`);
    }

    if (delayMs) await sleep(delayMs);
  }

  await mkdir(OUT_DIR, { recursive: true });

  // Una pasada parcial (`--only`, `--limit`) actualiza solo esos recursos y
  // conserva el resto de la BBDD; una pasada completa la reescribe entera.
  const partial = Boolean(onlyHost) || Boolean(limit);
  let merged = resources;
  if (partial) {
    try {
      const previous = JSON.parse(await readFile(OUT_DB, "utf8"));
      const fresh = new Map(resources.map((item) => [item.id, item]));
      merged = (previous.resources ?? []).map((item) => fresh.get(item.id) ?? item);
      for (const item of resources) {
        if (!merged.some((existing) => existing.id === item.id)) merged.push(item);
      }
      console.log(`(pasada parcial: ${resources.length} actualizados sobre ${merged.length})`);
    } catch {
      merged = resources;
    }
  }

  const db = {
    generatedAt: new Date().toISOString(),
    generator: "scripts/scrape.mjs",
    total: merged.length,
    resources: merged,
  };
  await writeFile(OUT_DB, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  await writeFile(
    OUT_REPORT,
    `${JSON.stringify({ generatedAt: db.generatedAt, total: report.length, entries: report }, null, 2)}\n`,
    "utf8",
  );

  const byKind = merged.reduce((acc, item) => {
    acc[item.media.kind] = (acc[item.media.kind] || 0) + 1;
    return acc;
  }, {});
  console.log(`\nWrote ${OUT_DB}`);
  console.log(`Media resuelto: ${JSON.stringify(byKind)}`);
  console.log(
    `Caídos: ${report.filter((e) => !e.reached && !e.blocked).length} · ` +
      `bloquean bots: ${report.filter((e) => e.blocked).length} · ` +
      `reparados: ${report.filter((e) => e.repaired).length}`,
  );
}

// Sólo se ejecuta al llamarlo directamente; así las funciones puras (matching,
// extracción) se pueden importar desde scripts de prueba.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) await main();
