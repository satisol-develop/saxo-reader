/**
 * Scraper configuration for discovering PDFs and transcriptions on external sites.
 *
 * This module contains the skills needed to:
 * 1. Discover PDF links on web pages
 * 2. Handle cross-origin iframe restrictions (CORS, X-Frame-Options)
 * 3. Extract metadata from MuseScore and other music sites
 * 4. Build a comprehensive catalog of saxophone resources
 */

export type ScraperSkill = {
  /** Name of the skill */
  name: string;
  /** Description of what this skill does */
  description: string;
  /** Pattern to detect PDF links */
  pdfPattern: RegExp;
  /** Pattern to detect sheet music pages (MuseScore, IMSLP, etc.) */
  sheetMusicPattern: RegExp;
  /** Pattern to detect transcription pages */
  transcriptionPattern: RegExp;
  /** Whether this skill requires user agent customization */
  requiresUserAgent: boolean;
  /** Whether this skill needs CORS proxy or server-side fetching */
  needsCORSProxy: boolean;
};

export const SCRAPER_SKILLS: ScraperSkill[] = [
  {
    name: "PDF Discovery",
    description: "Detect PDF files in web pages by analyzing HTML links, content-type headers, and page structure",
    pdfPattern: /\.pdf$/i,
    sheetMusicPattern: /^https?:\/\/(imslp\.org|archive\.org|musescore\.com|free-scores\.com|latouchemusicale\.com|saxophonemusic\.org|tamingthesaxophone\.com)/i,
    transcriptionPattern: /transcription|solo/i,
    requiresUserAgent: false,
    needsCORSProxy: false,
  },
  {
    name: "MuseScore Embed",
    description: "Handle MuseScore iframe embedding with proper sandbox and cross-origin policies",
    pdfPattern: /\.pdf$/i,
    sheetMusicPattern: /musescore\.com\/scores\/[0-9]+/i,
    transcriptionPattern: /transcription|solo/i,
    requiresUserAgent: false,
    needsCORSProxy: true, // MuseScore has strict CORS policies
  },
  {
    name: "MuseScore Direct Download",
    description: "Extract PDF download URLs from MuseScore score pages using network inspection",
    pdfPattern: /\.pdf$/i,
    sheetMusicPattern: /musescore\.com\/scores\/[0-9]+/i,
    transcriptionPattern: /transcription|solo/i,
    requiresUserAgent: true,
    needsCORSProxy: true,
  },
  {
    name: "IMSLP Scanner",
    description: "Scan IMSLP for public domain PDFs and catalog metadata",
    pdfPattern: /\.pdf$/i,
    sheetMusicPattern: /imslp\.org/,
    transcriptionPattern: /method|etude|study/i,
    requiresUserAgent: false,
    needsCORSProxy: false,
  },
  {
    name: "FreeScores Catalog",
    description: "Parse Free-scores.com catalog for saxophone sheet music with difficulty levels",
    pdfPattern: /\.pdf$/i,
    sheetMusicPattern: /free-scores\.com/,
    transcriptionPattern: /method|etude|study/i,
    requiresUserAgent: false,
    needsCORSProxy: false,
  },
];

export const SCRAPER_CONFIG = {
  // Default User-Agent for scraping
  userAgent: "SaxophoneReaderBot/1.0 (https://saxophone-reader.example.com)",

  // Headers to send with requests
  headers: {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
  },

  // Timeout settings (in milliseconds)
  timeout: {
    request: 10000,
    response: 30000,
    crawl: 5000,
  },

  // Maximum pages to crawl per domain
  crawlLimit: {
    perDomain: 100,
    perResource: 5,
  },

  // CORS proxy configuration (optional)
  corsProxy: {
    enabled: false,
    url: "", // e.g., "https://cors-anywhere.herokuapp.com/"
    rateLimit: 10, // requests per minute
  },

  // Allowed domains for scraping
  allowedDomains: [
    "imslp.org",
    "archive.org",
    "musescore.com",
    "free-scores.com",
    "latouchemusicale.com",
    "saxophonemusic.org",
    "tamingthesaxophone.com",
    "scooby-sax.com",
    "saxteacheruk.com",
    "ousaxstudio.weebly.com",
    "randyhunterjazz.com",
    "dansr.com",
    "saxschoolonline.com",
  ],

  // Patterns to exclude from scraping
  excludePatterns: [
    / Ads /,
    / Analytics /,
    / Cookie /,
    / Privacy /,
    / Privacy Policy /,
  ],
};

export function detectPDF(link: string): boolean {
  return SCRAPER_SKILLS[0].pdfPattern.test(link);
}

export function detectSheetMusic(link: string): boolean {
  return SCRAPER_SKILLS[0].sheetMusicPattern.test(link);
}

export function detectTranscription(link: string): boolean {
  return SCRAPER_SKILLS[0].transcriptionPattern.test(link);
}

/**
 * Determine if a resource can be embedded in an iframe
 * Returns the embedding strategy based on the URL
 */
export function getIframeStrategy(viewUrl: string): "same-origin" | "cross-origin-safe" | "cross-origin-proxy" | "no-iframe" {
  try {
    const url = new URL(viewUrl);

    // Same origin - can embed safely
    if (url.hostname === window.location.hostname) {
      return "same-origin";
    }

    // Known safe third-party viewers
    const safeDomains = [
      "imslp.org",
      "archive.org",
      "free-scores.com",
      "latouchemusicale.com",
      "tamingthesaxophone.com",
    ];

    if (safeDomains.some(domain => url.hostname.endsWith(domain))) {
      return "cross-origin-safe";
    }

    // MuseScore and similar - requires proxy
    if (url.hostname.includes("musescore.com")) {
      return "cross-origin-proxy";
    }

    // Default: no iframe, link in new tab
    return "no-iframe";
  } catch {
    return "no-iframe";
  }
}

/**
 * Extract PDF URLs from HTML content
 */
export function extractPDFUrls(html: string, baseUrl: string): string[] {
  const pdfUrls: string[] = [];
  const urlRegex = /href=["']([^"']+\.pdf?)["']/gi;
  let match;

  while ((match = urlRegex.exec(html)) !== null) {
    const url = match[1].startsWith("http") ? match[1] : new URL(match[1], baseUrl).href;
    if (detectPDF(url)) {
      pdfUrls.push(url);
    }
  }

  return pdfUrls;
}

/**
 * Extract sheet music page URLs from HTML content
 */
export function extractSheetMusicUrls(html: string, baseUrl: string): string[] {
  const sheetMusicUrls: string[] = [];
  const urlRegex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = urlRegex.exec(html)) !== null) {
    const url = match[1].startsWith("http") ? match[1] : new URL(match[1], baseUrl).href;
    if (detectSheetMusic(url)) {
      sheetMusicUrls.push(url);
    }
  }

  return sheetMusicUrls;
}

/**
 * Check if a URL requires CORS proxy for embedding
 */
export function requiresCorsProxy(url: string): boolean {
  return SCRAPER_SKILLS.some(skill =>
    skill.sheetMusicPattern.test(url) && skill.needsCORSProxy
  );
}

/**
 * Get CORS proxy URL if available
 */
export function getCorsProxyUrl(url: string): string | null {
  if (!SCRAPER_CONFIG.corsProxy.enabled || !SCRAPER_CONFIG.corsProxy.url) {
    return null;
  }
  return `${SCRAPER_CONFIG.corsProxy.url}?${encodeURIComponent(url)}`;
}
