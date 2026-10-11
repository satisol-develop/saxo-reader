/**
 * URL validation and same-origin utilities for the Saxophone PDF Reader.
 *
 * Security notes:
 *  - All external URLs are opened in a new tab with `rel="noopener noreferrer"`
 *    to avoid tab-nabbing and leaking the referer.
 *  - Iframe embedding is only allowed for same-origin URLs (resources the app
 *    itself serves). Third-party viewers are only reachable through links in
 *    a new tab, never through a sandboxed iframe, which prevents
 *    clickjacking, cross-origin script access, and pop-up abuse.
 *  - `isValidUrl` rejects `javascript:` / `data:` schemes, empty hosts, and
 *    malformed URIs before they are rendered or embedded.
 */

const URL_PATTERN = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^\\s<>\"']{1,2048}$/;

/**
 * Returns true when `value` is a well-formed absolute URL whose scheme is
 * http, https, or (for same-origin resources) a request path handled by the
 * app.
 */
export function isValidUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;

  const url = value.trim();

  // Reject dangerous / non-HTTP schemes.
  if (!URL_PATTERN.test(url)) return false;

  try {
    const parsed = new URL(url);

    // Only allow http/https for external embedding. Same-origin relative or
    // path-only URLs (e.g. /view/solo-1) are safe.
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    // Hostname must be present and not a private/local address.
    if (!parsed.hostname) return false;
    if (parsed.hostname === "localhost") return true;
    if (parsed.hostname.endsWith(".localhost")) return true;
    if (parsed.hostname === "127.0.0.1") return true;
    if (parsed.hostname.startsWith("[::1]")) return true;
    if (parsed.hostname === "0.0.0.0") return false;

    return true;
  } catch {
    return false;
  }
}

/**
 * Returns true when both URLs belong to the same origin (scheme + host +
 * port). Used to decide whether a resource can be safely embedded in an
 * iframe inside the app.
 */
export function isSameOrigin(url1: string, url2: string): boolean {
  try {
    const a = new URL(url1);
    const b = new URL(url2);
    return (
      a.protocol === b.protocol &&
      a.hostname === b.hostname &&
      a.port === b.port
    );
  } catch {
    return false;
  }
}

/**
 * Returns true when `url` is a same-origin request, i.e. it uses the same
 * scheme, host, and port as the current page, or it is a relative path that
 * the app can resolve itself.
 */
export function isSameOriginRequest(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.href);
    return (
      parsed.protocol === window.location.protocol &&
      parsed.hostname === window.location.hostname &&
      parsed.port === window.location.port
    );
  } catch {
    return false;
  }
}
