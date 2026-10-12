import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DB_STATS,
  DATA_GENERATED_AT,
  type Transcription,
  TRANSCRIPTIONS,
  downloadUrl,
  hasFile,
  isEmbeddable,
  kindLabel,
  linkState,
  primaryAction,
  sourceUrl as resourceSourceUrl,
  viewerUrl,
} from "./catalog";
import { OptimizedCatalogView } from "./OptimizedCatalog";
import { resolveResourceMedia } from "./lib/scrape";
import { setMediaOverride, useResolvedMedia } from "./lib/mediaStore";

type ViewMode = "catalog" | "view";

/** Fichero de vídeo reproducible con el reproductor nativo del navegador. */
const isVideoFile = (url: string): boolean => /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i.test(url);

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

interface ResolveState {
  status: "idle" | "loading" | "ok" | "error";
  message?: string;
}

/**
 * Pantalla completa en dos niveles, sobre el contenedor del visor:
 *  1. Fullscreen API nativa (la mejor: sin barras del navegador).
 *  2. Si el navegador no la concede (iOS, ventanas embebidas, iframes),
 *     «modo teatro» dentro de la propia app: el recuadro ocupa toda la
 *     ventana. Así el botón nunca se queda sin hacer nada.
 */
function useFullscreen(ref: React.RefObject<HTMLDivElement | null>) {
  const [native, setNative] = useState(false);
  const [theater, setTheater] = useState(false);

  useEffect(() => {
    const sync = () => setNative(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const exit = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* el navegador ya salió por su cuenta */
      }
    }
    setTheater(false);
  }, []);

  const toggle = useCallback(async () => {
    if (native || theater) {
      await exit();
      return true;
    }

    const node = ref.current;
    if (node && document.fullscreenEnabled) {
      const granted = await Promise.race([
        node
          .requestFullscreen()
          .then(() => true)
          .catch(() => false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 700)),
      ]);
      if (granted) return true;
    }

    setTheater(true);
    return false;
  }, [exit, native, ref, theater]);

  return { isFullscreen: native || theater, isTheater: theater, toggle, exit };
}

// El visor de PDF de Chromium lee la página y el zoom del hash (#zoom=150).
function withPdfZoom(url: string, zoom: number): string {
  if (!/\.pdf(\?|#|$)/i.test(url)) return url;
  const [base, hash] = url.split("#");
  const params = new URLSearchParams(hash ?? "");
  params.set("zoom", String(Math.round(zoom * 100)));
  return `${base}#${params.toString()}`;
}

// YouTube/Vimeo: sin recomendaciones del final y con reproducción en línea.
// Los parámetros van en la query (`?rel=0`), no en el hash.
function withEmbedParams(url: string): string {
  if (!/youtu\.be|youtube(-nocookie)?\.com|vimeo\.com/i.test(url)) return url;
  const [base, hash] = url.split("#");
  const [path, query = ""] = base.split("?");
  const params = new URLSearchParams(query);
  if (/youtu\.be|youtube(-nocookie)?\.com/i.test(path)) {
    params.set("rel", "0");
    params.set("playsinline", "1");
  }
  if (/vimeo\.com/i.test(path)) params.set("title", "0");
  const search = params.toString();
  return `${path}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}

function ViewerView({ resource, onClose }: { resource: Transcription; onClose: () => void }) {
  const media = useResolvedMedia(resource);
  const [resolve, setResolve] = useState<ResolveState>({ status: "idle" });
  const [zoom, setZoom] = useState(1);
  const [notice, setNotice] = useState("");
  const stageRef = useRef<HTMLDivElement | null>(null);
  const { isFullscreen, isTheater, toggle: toggleFullscreen, exit: exitFullscreen } =
    useFullscreen(stageRef);

  const rawUrl = viewerUrl(media);
  const url = useMemo(() => {
    if (media.kind === "pdf") return withPdfZoom(rawUrl, zoom);
    if (media.kind === "video") return withEmbedParams(rawUrl);
    return rawUrl;
  }, [media.kind, rawUrl, zoom]);
  const download = downloadUrl(media);
  const embeddable = isEmbeddable(media);
  const state = linkState(resource);
  const source = resourceSourceUrl(resource);
  const action = primaryAction(resource, media);
  const zoomable = media.kind === "image";
  const canZoom = media.kind === "pdf" || zoomable;

  const retry = async () => {
    setResolve({ status: "loading" });
    const result = await resolveResourceMedia(resource.title, source);
    if (result.ok && result.media) {
      setMediaOverride(resource.id, result.media);
      setResolve({
        status: "ok",
        message:
          result.media.kind === "page"
            ? "La página no expone ningún fichero: se abre fuera de la app"
            : `Encontrado ${kindLabel(result.media.kind).toLowerCase()}`,
      });
    } else {
      setResolve({ status: "error", message: result.error ?? "No se pudo leer la página de origen" });
    }
  };

  const zoomBy = useCallback((delta: number) => {
    setZoom((current) => {
      const index = ZOOM_STEPS.indexOf(current);
      const next =
        index === -1
          ? delta > 0
            ? 1.25
            : 0.75
          : ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, index + delta))];
      return next;
    });
  }, []);

  const handleFullscreen = useCallback(async () => {
    const native = await toggleFullscreen();
    setNotice(
      native
        ? ""
        : "Pantalla completa dentro de la app: este navegador no concede el modo nativo. Pulsa de nuevo o Esc para salir.",
    );
  }, [toggleFullscreen]);

  // Atajos: F pantalla completa, +/− zoom, 0 tamaño real, Esc cerrar.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && /input|select|textarea/i.test(target.tagName)) return;

      if (event.key === "Escape") {
        // El navegador gestiona su propia pantalla completa; aquí el teatro.
        if (document.fullscreenElement) return;
        if (isTheater) {
          void exitFullscreen();
          return;
        }
        onClose();
        return;
      }
      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        void handleFullscreen();
        return;
      }
      if (canZoom && (event.key === "+" || event.key === "=")) {
        zoomBy(1);
        return;
      }
      if (canZoom && (event.key === "-" || event.key === "_")) {
        zoomBy(-1);
        return;
      }
      if (canZoom && event.key === "0") setZoom(1);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canZoom, exitFullscreen, handleFullscreen, isTheater, onClose, zoomBy]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  return (
    <div className={`viewer${isFullscreen ? " is-fullscreen" : ""}`}>

      <header className="viewer-header">
        <div className="viewer-header__main">
          <button className="toolbar-button is-primary" onClick={onClose} aria-label="Cerrar el visor">
            ← Volver
          </button>
          <div>
            <h1 className="viewer-header__title">{resource.tune ?? resource.title}</h1>
            <p className="viewer-header__meta">
              {resource.artist ? `${resource.artist} · ` : ""}
              {resource.project} · {resource.category}
              {resource.instrument ? ` · ${resource.instrument}` : ""}
            </p>
          </div>
        </div>
        <div className="viewer-header__badges">
          <span className={`badge badge--${media.kind}`}>{kindLabel(media.kind)}</span>
          {resource.key && <span className="badge badge--key">En {resource.key}</span>}
          <span className={`badge badge--state badge--state-${state.tone}`}>{state.label}</span>
        </div>
      </header>

      <div className="viewer-toolbar">
        <a className="toolbar-button" href={source} target="_blank" rel="noopener noreferrer">
          🌐 Página de origen
        </a>
        {download && (
          <a className="toolbar-button" href={download} target="_blank" rel="noopener noreferrer" download>
            ⬇️ Descargar {kindLabel(media.kind)}
          </a>
        )}
        <a className="toolbar-button" href={rawUrl || source} target="_blank" rel="noopener noreferrer">
          {action.icon} Abrir en pestaña
        </a>
        <button className="toolbar-button" onClick={retry} disabled={resolve.status === "loading"}>
          {resolve.status === "loading" ? "⏳ Buscando…" : "🔄 Buscar el fichero otra vez"}
        </button>
        <span className="viewer-toolbar__keys" aria-hidden="true">
          F pantalla completa · +/− zoom · Esc volver
        </span>
      </div>

      {resolve.status === "ok" || resolve.status === "error" ? (
        <p className={`viewer-notice is-${resolve.status}`}>{resolve.message}</p>
      ) : null}

      <div
        className={`viewer-stage${isTheater ? " is-theater" : ""}${isFullscreen ? " is-fullscreen" : ""}`}
        ref={stageRef}
      >
        <div className="viewer-stage__content">
          {embeddable && media.kind === "pdf" && (
            // Sin `sandbox`: Chromium no dibuja su visor de PDF dentro de un
            // iframe sandboxeado, se queda en blanco.
            <iframe key={url} title={resource.title} src={url} className="viewer-frame" allow="fullscreen" />
          )}
          {embeddable && media.kind === "video" && isVideoFile(rawUrl) && (
            // Un .mp4/.webm se reproduce mejor con el reproductor nativo.
            <video className="viewer-video" src={rawUrl} controls preload="metadata" playsInline />
          )}
          {embeddable && media.kind === "video" && !isVideoFile(rawUrl) && (
            <iframe
              key={url}
              title={resource.title}
              src={url}
              className="viewer-frame"
              allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          )}
          {embeddable && media.kind === "image" && (
            <div className="viewer-image">
              <img
                src={rawUrl}
                alt={resource.title}
                className="viewer-image__img"
                style={{ transform: `scale(${zoom})` }}
              />
            </div>
          )}
          {embeddable && media.kind === "page" && (
            <iframe
              key={url}
              title={resource.title}
              src={url}
              className="viewer-frame"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          )}

          {!embeddable && (
            <div className="embed-blocked">
              <p>
                {resource.blocked
                  ? "El sitio bloquea la lectura automática (403/429), así que se abre en una pestaña nueva."
                  : "Este sitio no permite mostrarse dentro de la aplicación."}
              </p>
              <a
                className="toolbar-button is-primary"
                href={rawUrl || source}
                target="_blank"
                rel="noopener noreferrer"
              >
                Abrir en una pestaña nueva →
              </a>
              <p className="embed-blocked__hint">
                También puedes probar «Buscar el fichero otra vez»: a veces el PDF está enlazado en un
                segundo nivel de la página.
              </p>
            </div>
          )}
        </div>

        {/* Controles flotantes: siguen visibles en pantalla completa. */}
        <div className="viewer-controls" role="group" aria-label="Controles del visor">
          {canZoom && (
            <>
              <button className="viewer-controls__btn" onClick={() => zoomBy(-1)} title="Reducir (−)">
                −
              </button>
              <button
                className="viewer-controls__btn viewer-controls__btn--wide"
                onClick={() => setZoom(1)}
                title="Tamaño real (0)"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button className="viewer-controls__btn" onClick={() => zoomBy(1)} title="Ampliar (+)">
                +
              </button>
            </>
          )}
          {!canZoom && (
            <span className="viewer-controls__label">
              {media.kind === "video" ? "Vídeo" : "Página incrustada"}
            </span>
          )}
          <button
            className="viewer-controls__btn viewer-controls__btn--wide"
            onClick={handleFullscreen}
            title="Pantalla completa (F)"
            aria-pressed={isFullscreen}
          >
            {isFullscreen ? "⤡ Salir" : "⛶ Pantalla completa"}
          </button>
          {isTheater && (
            <button
              className="viewer-controls__btn viewer-controls__btn--wide"
              onClick={onClose}
              title="Cerrar el visor (Esc)"
            >
              ✕ Cerrar
            </button>
          )}
        </div>
      </div>

      {notice && <p className="viewer-notice is-error">{notice}</p>}

      <footer className="viewer-footer">
        <p>
          Fuente: {source} · Estado del scraping: {resource.status} · Última comprobación:{" "}
          {new Date(resource.checkedAt).toLocaleDateString("es-ES")}
        </p>
        <p>
          Esta aplicación solo enlaza a recursos de terceros. Cada recurso lleva su estado de derechos de
          autor; revisa las condiciones del sitio original antes de usarlo.
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<ViewMode>("catalog");
  const [selected, setSelected] = useState<Transcription | null>(null);

  const handleView = (resource: Transcription) => {
    setSelected(resource);
    setMode("view");
  };

  const handleCloseViewer = () => {
    setMode("catalog");
    setSelected(null);
  };

  const withFile = useMemo(() => TRANSCRIPTIONS.filter(hasFile).length, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__brand">
          <h1>
            <span className="app-header__sax" aria-hidden="true">
              🎷
            </span>
            Saxophone Sheet Music Finder
          </h1>
          <p className="app-header__tagline">
            {TRANSCRIPTIONS.length} piezas rastreadas en {DB_STATS.pages} páginas · {withFile} con fichero
            directo para leer aquí · {DB_STATS.requested} de tu lista · {" "}
            {TRANSCRIPTIONS.length - withFile} abren fuera.
          </p>
        </div>
        <nav className="app-header__actions">
          <button
            className={`ghost-button${mode === "catalog" ? " is-active" : ""}`}
            onClick={() => {
              setMode("catalog");
              setSelected(null);
            }}
          >
            🗂️ Catálogo
          </button>
        </nav>
      </header>

      {mode === "catalog" ? (
        <OptimizedCatalogView onView={handleView} />
      ) : (
        selected && <ViewerView resource={selected} onClose={handleCloseViewer} />
      )}

      <footer className="app-footer">
        <p>
          BBDD generada por el scraper el{" "}
          {new Date(DATA_GENERATED_AT).toLocaleDateString("es-ES", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}{" "}
          · {DB_STATS.pages} páginas revisadas, {DB_STATS.pagesRepaired} enlaces reparados ·{" "}
          {DB_STATS.pagesBlocked} bloquean a los bots. Los enlaces apuntan a recursos públicos: verifica
          siempre la licencia de cada documento.
        </p>
      </footer>
    </div>
  );
}
