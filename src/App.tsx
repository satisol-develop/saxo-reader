import { useState } from "react";
import {
  DATA_GENERATED_AT,
  type Transcription,
  TRANSCRIPTIONS,
  downloadUrl,
  isEmbeddable,
  kindLabel,
  linkState,
  primaryAction,
  sourceUrl,
  viewerUrl,
} from "./catalog";
import { OptimizedCatalogView } from "./OptimizedCatalog";
import { resolveResourceMedia } from "./lib/scrape";
import { setMediaOverride, useResolvedMedia } from "./lib/mediaStore";

type ViewMode = "catalog" | "view";

/** Fichero de vídeo reproducible con el reproductor nativo del navegador. */
const isVideoFile = (url: string): boolean => /\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i.test(url);

interface ResolveState {
  status: "idle" | "loading" | "ok" | "error";
  message?: string;
}

function ViewerView({ resource, onClose }: { resource: Transcription; onClose: () => void }) {
  const media = useResolvedMedia(resource);
  const [resolve, setResolve] = useState<ResolveState>({ status: "idle" });

  const url = viewerUrl(media);
  const download = downloadUrl(media);
  const embeddable = isEmbeddable(media);
  const state = linkState(resource);
  const source = sourceUrl(resource);
  const action = primaryAction(resource, media);

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

  return (
    <div className="viewer">
      <header className="viewer-header">
        <div>
          <h1>{resource.title}</h1>
          <p className="viewer-header__description">{resource.description}</p>
        </div>
        <div className="viewer-header__meta">
          <span className={`badge badge--${media.kind}`}>{kindLabel(media.kind)}</span>
          <span className="viewer-header__license">{resource.license}</span>
          {resource.instrument && (
            <span className="viewer-header__instrument">{resource.instrument}</span>
          )}
          <span className={`badge badge--state badge--state-${state.tone}`}>{state.label}</span>
        </div>
      </header>

      <div className="viewer-toolbar">
        <button className="toolbar-button is-primary" onClick={onClose} aria-label="Cerrar el visor">
          ✕ Cerrar
        </button>
        <a className="toolbar-button" href={source} target="_blank" rel="noopener noreferrer">
          🌐 Ver la fuente
        </a>
        {download && (
          <a className="toolbar-button" href={download} target="_blank" rel="noopener noreferrer" download>
            ⬇️ Descargar {kindLabel(media.kind)}
          </a>
        )}
        {!embeddable && (
          <a className="toolbar-button" href={url || source} target="_blank" rel="noopener noreferrer">
            {action.icon} Abrir en pestaña nueva
          </a>
        )}
        <button className="toolbar-button" onClick={retry} disabled={resolve.status === "loading"}>
          {resolve.status === "loading" ? "⏳ Buscando…" : "🔄 Volver a buscar el fichero"}
        </button>
      </div>

      {resolve.status === "ok" || resolve.status === "error" ? (
        <p className={`viewer-notice is-${resolve.status}`}>{resolve.message}</p>
      ) : null}

      <div className="viewer-embed">
        {embeddable && media.kind === "pdf" && (
          // Sin `sandbox`: Chromium no dibuja su visor de PDF dentro de un
          // iframe sandboxeado, se queda en blanco.
          <iframe title={resource.title} src={url} className="viewer-embed__frame" allow="fullscreen" />
        )}
        {embeddable && media.kind === "video" && isVideoFile(url) && (
          // Un .mp4/.webm se reproduce mejor con el reproductor nativo que
          // dentro de un iframe.
          <div className="video-viewer">
            <video className="video-viewer__player" src={url} controls preload="metadata" playsInline />
          </div>
        )}
        {embeddable && media.kind === "video" && !isVideoFile(url) && (
          <iframe
            title={resource.title}
            src={url}
            className="viewer-embed__frame"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allow="autoplay; fullscreen; picture-in-picture"
          />
        )}
        {embeddable && media.kind === "image" && (
          <div className="image-viewer">
            <img src={url} alt={resource.title} className="image-viewer__img" />
          </div>
        )}
        {embeddable && media.kind === "page" && (
          <iframe
            title={resource.title}
            src={url}
            className="viewer-embed__frame"
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
              href={url || source}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir en una pestaña nueva →
            </a>
            <p className="embed-blocked__hint">
              También puedes probar «Volver a buscar el fichero»: a veces el PDF está enlazado en un
              segundo nivel de la página.
            </p>
          </div>
        )}
      </div>

      <footer className="viewer-footer">
        <p>
          Fuente: {source} · Proyecto {resource.project} · Estado del scraping: {resource.status} ·{" "}
          Última comprobación: {new Date(resource.checkedAt).toLocaleDateString("es-ES")}
        </p>
        <p>
          Esta aplicación solo enlaza a recursos de terceros. Cada recurso lleva su estado de derechos
          de autor; revisa las condiciones del sitio original antes de usarlo.
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

  const pdfs = TRANSCRIPTIONS.filter((resource) => resource.media.kind === "pdf").length;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Saxophone PDF Reader</h1>
          <p className="app-header__tagline">
            Buscador de transcripciones y métodos de saxofón: {TRANSCRIPTIONS.length} recursos de{" "}
            {new Set(TRANSCRIPTIONS.map((resource) => resource.project)).size} proyectos, con PDF,
            imagen o vídeo listos para ver y descargar.
          </p>
        </div>
        <nav className="app-header__actions">
          <button
            className="ghost-button"
            onClick={() => {
              setMode("catalog");
              setSelected(null);
            }}
          >
            Catálogo
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
          ({pdfs} PDFs con enlace directo). Los enlaces apuntan a recursos públicos: verifica siempre la
          licencia de cada documento.
        </p>
      </footer>
    </div>
  );
}
