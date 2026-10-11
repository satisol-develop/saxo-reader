import { useState } from "react";
import { SAXOPHONE_RESOURCES, type SaxophoneResource } from "./catalog";
import { IframeManager } from "./iframes/IframeManager";
import { OptimizedCatalogView } from "./OptimizedCatalog";

type ViewMode = "catalog" | "view";

interface ViewerViewProps {
  resource: SaxophoneResource;
  onClose: () => void;
}

function ViewerView({ resource, onClose }: ViewerViewProps) {
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
        </div>
      </header>

      <div className="viewer-toolbar">
        <button
          className="toolbar-button is-primary"
          onClick={onClose}
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
        <a
          className="toolbar-button"
          href={resource.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
        >
          ⬇️ Descargar PDF
        </a>
      </div>

      <div className="viewer-embed">
        <IframeManager
          url={resource.viewUrl}
          title={resource.title}
        />
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

      {mode === "catalog" ? (    <OptimizedCatalogView
      resources={SAXOPHONE_RESOURCES}
      currentPage={1}
      onView={handleView}
      onPageChange={() => {}}
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
