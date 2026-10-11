import { useState } from "react";
import {
  SAXOPHONE_RESOURCES,
  type SaxophoneResource,
  getResourceType,
  getViewerUrl,
  canEmbedResource,
} from "./catalog";
import { OptimizedCatalogView } from "./OptimizedCatalog";

type ViewMode = "catalog" | "view";

interface ViewerViewProps {
  resource: SaxophoneResource;
  onClose: () => void;
}

function ViewerView({ resource, onClose }: ViewerViewProps) {
  const handleClose = () => {
    onClose();
  };

  // Tipo y URL efectivos: si el recurso no declara `type` se infiere de sus URLs.
  const type = getResourceType(resource);
  const viewerUrl = getViewerUrl(resource);
  // Algunos sitios (MuseScore, free-scores…) prohíben el iframe con
  // X-Frame-Options: en ese caso se ofrece abrirlos en una pestaña nueva.
  const embeddable = canEmbedResource(resource);

  return (
    <div className="viewer">
      <header className="viewer-header">
        <div>
          <h1>{resource.title}</h1>
          <p className="viewer-header__description">{resource.description}</p>
        </div>
        <div className="viewer-header__meta">
          <span className="viewer-header__license">{resource.license}</span>
          {resource.instrument && (
            <span className="viewer-header__instrument">
              {resource.instrument}
            </span>
          )}
          <span className="viewer-header__type">{type}</span>
        </div>
      </header>

      <div className="viewer-toolbar">
        <button
          className="toolbar-button is-primary"
          onClick={handleClose}
          aria-label="Cerrar el viewer"
        >
          ✕ Cerrar
        </button>
        <a
          className="toolbar-button"
          href={resource.viewUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          👁️ Ver en el navegador
        </a>
        {type === "pdf" && resource.downloadUrl && (
          <a
            className="toolbar-button"
            href={resource.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            ⬇️ Descargar PDF
          </a>
        )}
      </div>

      <div className="viewer-embed">
        {embeddable && type === "pdf" && viewerUrl && (
          // Sin `sandbox`: Chromium no dibuja su visor de PDF dentro de un
          // iframe sandboxeado, se queda en blanco.
          <iframe
            title={resource.title}
            src={viewerUrl}
            className="viewer-embed__frame"
            allow="fullscreen"
          />
        )}
        {embeddable && type === "video" && viewerUrl && (
          <iframe
            title={resource.title}
            src={viewerUrl}
            className="viewer-embed__frame"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            allow="autoplay; fullscreen; picture-in-picture"
          />
        )}
        {type === "image" && viewerUrl && (
          <div className="image-viewer">
            <img
              src={viewerUrl}
              alt={resource.title}
              className="image-viewer__img"
            />
          </div>
        )}
        {embeddable && type === "page" && viewerUrl && (
          <div className="page-viewer">
            <iframe
              title={resource.title}
              src={viewerUrl}
              className="viewer-embed__frame"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
          </div>
        )}
        {viewerUrl && !embeddable && (
          <div className="embed-blocked">
            <p>
              Este sitio no permite mostrarse dentro de la aplicación.
            </p>
            <a
              className="toolbar-button is-primary"
              href={viewerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Abrir en una pestaña nueva →
            </a>
          </div>
        )}
        {!viewerUrl && (
          <div className="no-resource">
            <p>No hay recurso para mostrar.</p>
          </div>
        )}
      </div>

      <footer className="viewer-footer">
        <p>
          Esta aplicación solo enlaza a recursos de terceros. Cada recurso lleva
          su estado de derechos de autor; revisa las condiciones del sitio
          original antes de usarlo.
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState<ViewMode>("catalog");
  const [selected, setSelected] = useState<SaxophoneResource | null>(null);

  const handleView = (resource: SaxophoneResource) => {
    setSelected(resource);
    setMode("view");
  };

  const handleCloseViewer = () => {
    setMode("catalog");
    setSelected(null);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Saxophone PDF Reader</h1>
          <p className="app-header__tagline">
            Lectura de PDFs y solos transcritos sobre saxofón: revuelve enlaces
            para visualizar y descargar recursos pedagógicos.
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
        <OptimizedCatalogView
          resources={SAXOPHONE_RESOURCES}
          onView={handleView}
        />
      ) : (
        selected && <ViewerView resource={selected} onClose={handleCloseViewer} />
      )}

      <footer className="app-footer">
        <p>
          Construido con Vite + React + TypeScript. Los enlaces apuntan a
          recursos públicos (IMSLP, Internet Archive, fabricantes y proyectos
          comunitarios). Verifica siempre la licencia de cada documento.
        </p>
      </footer>

    </div>
  );
}
