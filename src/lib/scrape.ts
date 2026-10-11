/**
 * Scraping en el navegador.
 *
 * El catálogo llega ya resuelto desde `src/data/transcriptions.json` (lo genera
 * `scripts/scrape.mjs`), pero un enlace puede fallar, cambiar o esconder su PDF:
 * aquí se vuelve a leer la página de origen y se busca el fichero al vuelo.
 *
 * Reglas espejadas de `scripts/scrape.mjs` (mantener en sincronía):
 *   - emparejamiento del candidato con el título (no "el primer PDF"),
 *   - sólo se acepta como vídeo una URL que sea un vídeo (no el canal),
 *   - si la página está caída se intenta reparar desde el índice del proyecto.
 *
 * El fetch pasa por un proxy CORS: el navegador no puede leer orígenes ajenos.
 */

export type MediaKind = "pdf" | "image" | "video" | "page" | "none";

export interface MediaCandidate {
  kind: MediaKind;
  /** Lo que abre el visor (fichero, embed de vídeo o página). */
  url: string;
  embedUrl?: string;
  /** Fichero descargable cuando existe. */
  downloadUrl?: string;
  embeddable: boolean;
  source: "db" | "client";
}

export interface CandidateLink {
  url: string;
  text: string;
}

export interface ExtractedLinks {
  pdfs: CandidateLink[];
  images: CandidateLink[];
  videos: { url: string; embedUrl: string; text: string }[];
}

const PDF_EXT = /\.pdf(\?|#|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp)(\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i;
const JUNK_IMAGE = /(logo|icon|sprite|banner|favicon|avatar|badge|button|arrow|payment|flag)/i;
const SHEET_IMAGE_HINT = /(score|sheet|partitur|transcri|music|solo|page[-_]?\d|ejercicio|exercice)/i;

/** Hosts que rechazan el iframe (X-Frame-Options / CSP), verificados por HEAD. */
export const EMBED_BLOCKED_HOSTS = [
  "musescore.com",
  "tamingthesaxophone.com",
  "free-scores.com",
  "latouchemusicale.com",
] as const;

/** Índices de proyecto: se usan para reparar enlaces caídos (igual que el scraper). */
export const PROJECT_INDEXES: Record<string, string> = {
  "saxteacheruk.com": "https://saxteacheruk.com/free-transcriptions.html",
  "scooby-sax.com": "https://scooby-sax.com/Transcriptions.html",
  "tamingthesaxophone.com": "https://tamingthesaxophone.com/saxophone/players/blues-transcriptions",
};

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

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

export const isEmbedBlocked = (url: string): boolean => {
  const host = hostOf(url);
  return EMBED_BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
};

export const decodeEntities = (value: string): string =>
  value
    .replace(/&amp;/gi, "&")
    .replace(/&#0?38;/g, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");

/** URL de embed si el enlace es un vídeo de verdad; "" si es un canal o similar. */
export function videoEmbedUrl(raw: string): string {
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

// ---------------------------------------------------------------- matching ---

const normalize = (value: string) =>
  decodeEntities(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Todas las palabras, sin filtrar por longitud. */
const rawWords = (value: string) => normalize(value).split(/[^a-z0-9]+/).filter(Boolean);

/** Palabras comparables de un texto (se descartan las de 1-2 letras). */
const wordsOf = (value: string) => rawWords(value).filter((word) => word.length >= 3);

export const titleTokens = (title: string, minLength = 3) =>
  rawWords(title).filter((word) => word.length >= minLength && !STOPWORDS.has(word));

const wordMatches = (token: string, word: string): boolean => {
  // En palabras cortas sólo vale la coincidencia exacta: "me" no es "member".
  if (token.length <= 3) return word === token;
  if (word.includes(token) || token.includes(word)) return true;
  if (token.length >= 5 && word.length >= 4 && (token.endsWith(word) || word.endsWith(token))) return true;
  return false;
};

/** Ratio (0..1) de tokens relevantes del título presentes en el candidato. */
export function scoreCandidate(title: string, candidate: CandidateLink, minLength = 3): number {
  const tokens = titleTokens(title, minLength);
  if (!tokens.length) return 0;
  // Las palabras del candidato se filtran con el mismo mínimo que los tokens,
  // para que un tema corto ("All of Me") pueda coincidir entero.
  const words = rawWords(`${candidate.text} ${candidate.url}`).filter((word) => word.length >= minLength);
  let matched = 0;
  for (const token of tokens) {
    if (words.some((word) => wordMatches(token, word))) matched += 1;
  }
  return matched / tokens.length;
}

/** Elige el candidato que corresponde al título, o null si no hay evidencia. */
/**
 * Texto entrecomillado del título: el nombre del tema manda sobre el resto.
 * El apóstrofo no cuenta como comilla ("Blues O'Mighty" es un solo tema).
 */
export function quotedOf(title: string): string {
  const quoted = [...title.matchAll(/["“”«»]([^"“”«»]{2,})["“”«»]/g)].map((match) => match[1]);
  return quoted.join(" " ).trim();
}

/** Tonalidad del instrumento: alto y bari leen Eb; tenor y soprano, Bb. */
const KEY_BY_INSTRUMENT: Record<string, string> = { Alto: "eb", Bari: "eb", Tenor: "bb", Soprano: "bb" };
const keyPattern = (key: string) => new RegExp(`(^|[^a-z])${key}($|[^a-z])`, "i");

/**
 * Elige el candidato que corresponde al título.
 *
 * Si el título cita el tema entre comillas ("Tune Up"), esas palabras son la
 * clave: sin coincidencia de tema no se acepta nada (así no se asigna a
 * "Phil Woods — Solar" el PDF de otro tema del mismo solista). Entre varios
 * candidatos válidos se prefiere el de la tonalidad del instrumento.
 */
export function pickBestCandidate<T extends { url: string; text: string }>(
  title: string,
  candidates: T[],
  options: { instrument?: string | null } = {},
): T | null {
  if (!candidates.length) return null;

  const quoted = quotedOf(title);
  const primary = quoted || title;
  const minLength = quoted ? 2 : 3;

  let pool = candidates.filter((candidate) => scoreCandidate(primary, candidate, minLength) >= 0.6);

  if (!pool.length) {
    const longest = titleTokens(primary, minLength).sort((a, b) => b.length - a.length)[0];
    if (longest && longest.length >= 7) {
      const matches = candidates.filter((candidate) =>
        wordsOf(`${candidate.text} ${candidate.url}`).some((word) => wordMatches(longest, word)),
      );
      if (matches.length === 1) pool = matches;
    }
  }
  if (!pool.length) return null;

  const key = options.instrument ? KEY_BY_INSTRUMENT[options.instrument] : "";
  const scored = pool.map((candidate) => ({
    candidate,
    artist: scoreCandidate(title, candidate),
    keyMatch: key ? (keyPattern(key).test(`${candidate.text} ${candidate.url}`) ? 1 : 0) : 0,
  }));

  scored.sort((a, b) => b.artist - a.artist || b.keyMatch - a.keyMatch);
  return scored[0].candidate;
}

// -------------------------------------------------------------- extraction ---

const resolveUrl = (raw: string, base: string): string => {
  try {
    const url = new URL(decodeEntities(raw).trim(), base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (url.pathname.startsWith("/cdn-cgi/")) return "";
    return url.href;
  } catch {
    return "";
  }
};

/** Enlaces candidatos de un HTML. Necesita DOMParser (navegador). */
export function extractMediaLinks(html: string, baseUrl: string): ExtractedLinks {
  const pdfs: CandidateLink[] = [];
  const images: CandidateLink[] = [];
  const videos: { url: string; embedUrl: string; text: string }[] = [];
  const seen = new Set<string>();

  const doc = new DOMParser().parseFromString(html, "text/html");

  const consider = (raw: string | null, text: string) => {
    if (!raw) return;
    const url = resolveUrl(raw, baseUrl);
    if (!url || seen.has(url)) return;

    if (PDF_EXT.test(url)) {
      seen.add(url);
      pdfs.push({ url, text });
      return;
    }
    const embed = videoEmbedUrl(url);
    if (embed) {
      seen.add(url);
      videos.push({ url, embedUrl: embed, text });
      return;
    }
    if (VIDEO_EXT.test(url)) {
      seen.add(url);
      videos.push({ url, embedUrl: url, text });
      return;
    }
    if (IMAGE_EXT.test(url) && !JUNK_IMAGE.test(url)) {
      seen.add(url);
      images.push({ url, text });
    }
  };

  for (const anchor of doc.querySelectorAll("a[href]")) {
    consider(anchor.getAttribute("href"), (anchor.textContent ?? "").replace(/\s+/g, " ").trim());
  }
  for (const element of doc.querySelectorAll("iframe[src], embed[src], source[src]")) {
    consider(element.getAttribute("src"), "");
  }
  for (const meta of doc.querySelectorAll("meta[property], meta[name]")) {
    const name = (meta.getAttribute("property") ?? meta.getAttribute("name") ?? "").toLowerCase();
    if (!/^(og:video|og:video:url|og:video:secure_url|twitter:player)$/.test(name)) continue;
    consider(meta.getAttribute("content"), "");
  }

  return {
    pdfs,
    images: [...images].sort(
      (a, b) => (SHEET_IMAGE_HINT.test(a.url) ? 0 : 1) - (SHEET_IMAGE_HINT.test(b.url) ? 0 : 1),
    ),
    videos,
  };
}

// ------------------------------------------------------------------ fetching -

/**
 * Proxies CORS públicos en orden de preferencia. `VITE_SCRAPE_PROXY` permite
 * usar uno propio: `VITE_SCRAPE_PROXY="https://mi-proxy/?url={url}"`.
 */
const PROXIES: ((target: string) => string)[] = [
  (target) => `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
  (target) => `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
  (target) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(target)}`,
  (target) => `https://r.jina.ai/${target}`,
];

const customProxy = (import.meta.env.VITE_SCRAPE_PROXY as string | undefined)?.trim();

const proxyChain = (target: string): string[] => {
  const list = customProxy
    ? [
        customProxy.includes("{url}")
          ? customProxy.replace("{url}", encodeURIComponent(target))
          : `${customProxy}${encodeURIComponent(target)}`,
      ]
    : [];
  return [...list, ...PROXIES.map((build) => build(target))];
};

/** allorigins `/get` devuelve `{contents: "<html>"}`; el resto, HTML crudo. */
const unwrap = (body: string): string => {
  const trimmed = body.trim();
  if (!trimmed.startsWith("{")) return body;
  try {
    const parsed = JSON.parse(trimmed) as { contents?: string; body?: string };
    return parsed.contents ?? parsed.body ?? body;
  } catch {
    return body;
  }
};

async function fetchThroughProxy(target: string, timeoutMs: number, signal?: AbortSignal): Promise<string> {
  const errors: string[] = [];
  for (const proxyUrl of proxyChain(target)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);
    try {
      const response = await fetch(proxyUrl, { signal: controller.signal, redirect: "follow" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return unwrap(await response.text());
    } catch (error) {
      errors.push(`${hostOf(proxyUrl)}: ${String((error as Error)?.message ?? error)}`);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
  throw new Error(errors.join(" · ") || "sin proxy disponible");
}

export interface ScrapeResult {
  ok: boolean;
  media?: MediaCandidate;
  /** URL viva cuando el enlace original estaba caído y se reparó. */
  repairedUrl?: string;
  error?: string;
}

/**
 * Resuelve (o vuelve a resolver) el medio de un recurso leyendo su página a
 * través de un proxy. Si la página está caída, intenta repararla desde el
 * índice del proyecto y empareja por título.
 */
export async function resolveResourceMedia(
  title: string,
  sourceUrl: string,
  options: { signal?: AbortSignal; timeoutMs?: number; indexUrl?: string } = {},
): Promise<ScrapeResult> {
  const timeoutMs = options.timeoutMs ?? 12000;

  const fromHtml = (html: string, baseUrl: string, effectiveUrl: string): MediaCandidate => {
    const { pdfs, images, videos } = extractMediaLinks(html, baseUrl);
    // Sólo se acepta un fichero si el título lo respalda (una página puede
    // listar las transcripciones de 200 temas distintos).
    const matchedPdf = pickBestCandidate(title, pdfs);
    if (matchedPdf) {
      return { kind: "pdf", url: matchedPdf.url, downloadUrl: matchedPdf.url, embeddable: true, source: "client" };
    }
    const matchedVideo = pickBestCandidate(title, videos);
    if (matchedVideo) {
      return {
        kind: "video",
        url: matchedVideo.url,
        embedUrl: matchedVideo.embedUrl,
        embeddable: true,
        source: "client",
      };
    }
    const matchedImage = pickBestCandidate(title, images);
    if (matchedImage) {
      return { kind: "image", url: matchedImage.url, embeddable: true, source: "client" };
    }

    // Página dedicada a un único medio.
    const singleCount = pdfs.length + videos.length + images.length;
    if (singleCount === 1) {
      if (pdfs.length) {
        return { kind: "pdf", url: pdfs[0].url, downloadUrl: pdfs[0].url, embeddable: true, source: "client" };
      }
      if (videos.length) {
        return {
          kind: "video",
          url: videos[0].url,
          embedUrl: videos[0].embedUrl,
          embeddable: true,
          source: "client",
        };
      }
      return { kind: "image", url: images[0].url, embeddable: true, source: "client" };
    }

    return {
      kind: "page",
      url: effectiveUrl,
      embeddable: !isEmbedBlocked(effectiveUrl),
      source: "client",
    };
  };

  try {
    const html = await fetchThroughProxy(sourceUrl, timeoutMs, options.signal);
    return { ok: true, media: fromHtml(html, sourceUrl, sourceUrl) };
  } catch (error) {
    const indexUrl = options.indexUrl ?? PROJECT_INDEXES[hostOf(sourceUrl)];
    if (!indexUrl) return { ok: false, error: String((error as Error)?.message ?? error) };

    try {
      const indexHtml = await fetchThroughProxy(indexUrl, timeoutMs, options.signal);
      const anchors = Array.from(new DOMParser().parseFromString(indexHtml, "text/html").querySelectorAll("a[href]"))
        .map((anchor) => ({
          url: resolveUrl(anchor.getAttribute("href") ?? "", indexUrl),
          text: (anchor.textContent ?? "").replace(/\s+/g, " ").trim(),
        }))
        .filter((anchor) => anchor.url);
      const match = pickBestCandidate(title, anchors);
      if (!match) return { ok: false, error: "sin coincidencia en el índice del proyecto" };

      const pageHtml = await fetchThroughProxy(match.url, timeoutMs, options.signal);
      return { ok: true, media: fromHtml(pageHtml, match.url, match.url), repairedUrl: match.url };
    } catch (repairError) {
      return { ok: false, error: String((repairError as Error)?.message ?? repairError) };
    }
  }
}
