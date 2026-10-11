import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIES,
  type Category,
  INSTRUMENTS,
  type Instrument,
  type SaxophoneResource,
  getResourceType,
} from "./catalog";
import { isSameOrigin } from "./urlUtils";

interface ResourceCardProps {
  resource: SaxophoneResource;
  index: number;
  onView: (resource: SaxophoneResource) => void;
}

// `memo` evita re-renderizar las tarjetas ya visibles cuando se añade un
// nuevo bloque de recursos o cambia el estado del catálogo.
const ResourceCard = memo(function ResourceCard({ resource, index, onView }: ResourceCardProps) {
  const [loaded, setLoaded] = useState(false);

  const isExternal = !isSameOrigin(window.location.href, resource.viewUrl);
  // Etiqueta efectiva: declarada en el catalogo o inferida desde las URLs.
  const type = getResourceType(resource);

  const handleView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onView) {
      onView(resource);
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === "pdf" && resource.downloadUrl) {
      const link = document.createElement("a");
      link.href = resource.downloadUrl;
      link.download = resource.title.replace(/[^a-z0-9_.-]/gi, "_").slice(0, 100) || "resource.pdf";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getActionIcons = () => {
    switch (type) {
      case "pdf":
        return { view: "👁️", download: "⬇️" };
      case "image":
        return { view: "🖼️", download: "⬇️" };
      case "video":
        return { view: "🎬", download: "⬇️" };
      case "page":
        return { view: "🌐", download: "🔗" };
      default:
        return { view: "👁️", download: "⬇️" };
    }
  };

  const { view, download } = getActionIcons();

  return (
    <article
      className="resource-card"
      style={{
        animationDelay: `${index * 40}ms`,
        opacity: loaded ? 1 : 0,
        transform: loaded ? "translateY(0)" : "translateY(20px)",
      }}
    >
      <div
        className="resource-card__icon"
        aria-hidden="true"
        onAnimationStart={() => setLoaded(true)}
      >
        📄
      </div>
      <h3 className="resource-card__title">{resource.title}</h3>
      <p className="resource-card__description">{resource.description}</p>
      <div className="resource-card__meta">
        <span className="resource-card__license">{resource.license}</span>
        {resource.instrument && (
          <span className="resource-card__instrument">{resource.instrument}</span>
        )}
        <span className="resource-card__type">{type}</span>
      </div>
      <div className="resource-card__actions">
        <a
          className={`resource-card__action${isExternal ? "" : " is-same-origin"}`}
          href={resource.viewUrl}
          onClick={handleView}
          aria-label={`Ver ${resource.title}`}
        >
          {view} Ver
        </a>
        {type === "pdf" && (
          <a
            className="resource-card__action"
            href={resource.downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download
            onClick={handleDownload}
            aria-label={`Descargar ${resource.title}`}
          >
            {download} PDF
          </a>
        )}
      </div>
    </article>
  );
});

interface OptimizedCatalogViewProps {
  resources: SaxophoneResource[];
  onView: (resource: SaxophoneResource) => void;
}

/** Recursos que se muestran inicialmente y en cada carga adicional. */
const PAGE_SIZE = 24;

export function OptimizedCatalogView({ resources, onView }: OptimizedCatalogViewProps) {
  const [category, setCategory] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [instrument, setInstrument] = useState<Instrument | "all">("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // La busqueda usa un valor diferido: el filtrado se recalcula en un render
  // de menor prioridad y el campo de texto responde sin tirones.
  const deferredQuery = useDeferredValue(query);

  const filtered = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    return resources.filter((r) => {
      const matchesCategory = category === "all" || r.category === category;
      const matchesInstrument =
        instrument === "all" || r.instrument === instrument;
      const matchesQuery =
        !normalized ||
        r.title.toLowerCase().includes(normalized) ||
        r.description.toLowerCase().includes(normalized);
      return matchesCategory && matchesInstrument && matchesQuery;
    });
  }, [resources, category, instrument, deferredQuery]);

  // Cada filtro reinicia la carga progresiva desde el primer bloque. Se hace
  // en el propio manejador (y no en un efecto) para evitar renders extra.
  const applyCategory = (next: Category | "all") => {
    setCategory(next);
    setVisibleCount(PAGE_SIZE);
  };
  const applyInstrument = (next: Instrument | "all") => {
    setInstrument(next);
    setVisibleCount(PAGE_SIZE);
  };
  const applyQuery = (next: string) => {
    setQuery(next);
    setVisibleCount(PAGE_SIZE);
  };

  const visibleResources = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const hasMore = visibleCount < filtered.length;

  const loadMore = () =>
    setVisibleCount((current) => Math.min(current + PAGE_SIZE, filtered.length));

  // Carga progresiva con IntersectionObserver: se dispara solo al acercarse al
  // final (600px de margen) y se desconecta al no quedar mas recursos, asi no
  // hay trabajo por frame como con un listener de `scroll`.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) return;

    const total = filtered.length;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((current) => Math.min(current + PAGE_SIZE, total));
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, filtered.length]);

  return (
    <div className="catalog">
      <header className="catalog-header">
        {/* El titulo vive en el header de la app; aqui solo el estado de la lista. */}
        <p className="catalog-header__sub">
          {filtered.length === 0
            ? "Sin resultados para esta búsqueda"
            : `${visibleResources.length} de ${filtered.length} recursos`}
        </p>
        <div className="catalog-header__search">
          <label htmlFor="search">Buscar</label>
          <input
            id="search"
            className="search-input"
            placeholder="Título, categoría…"
            value={query}
            onChange={(e) => applyQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="catalog-filters">
        <div className="filter-group">
          <span className="filter-label">Categoría</span>
          <div className="filter-chips">
            <button
              className={`filter-chip${category === "all" ? " is-active" : ""}`}
              onClick={() => applyCategory("all")}
            >
              Todos
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`filter-chip${category === c ? " is-active" : ""}`}
                onClick={() => applyCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        {(category === "Solo alto" ||
          category === "Solo tenor" ||
          category === "Solo bari" ||
          category === "Solo soprano") && (
          <div className="filter-group">
            <span className="filter-label">Instrumento</span>
            <div className="filter-chips">
              <button
                className={`filter-chip${instrument === "all" ? " is-active" : ""}`}
                onClick={() => applyInstrument("all")}
              >
                Todos
              </button>
              {INSTRUMENTS.map((inst) => (
                <button
                  key={inst}
                  className={`filter-chip${instrument === inst ? " is-active" : ""}`}
                  onClick={() => applyInstrument(inst)}
                >
                  {inst}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <p>No se encontraron recursos para esa búsqueda.</p>
        </div>
      ) : (
        <div className="resource-grid">
          {visibleResources.map((resource, i) => (
            <ResourceCard
              // Varios recursos comparten pagina de origen (p. ej. colecciones
              // de scooby-sax), asi que la clave combina titulo + URL.
              key={`${resource.title}|${resource.viewUrl}`}
              resource={resource}
              index={i}
              onView={onView}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="catalog-more" ref={sentinelRef}>
          <button className="pagination-button" onClick={loadMore}>
            Cargar más recursos
          </button>
        </div>
      )}
    </div>
  );
}
