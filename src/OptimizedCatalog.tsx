import { useMemo, useState, useCallback, useEffect } from "react";
import { CATEGORIES, type Category, INSTRUMENTS, type Instrument, type SaxophoneResource } from "./catalog";
import { isSameOrigin } from "./urlUtils";

interface ResourceCardProps {
  resource: SaxophoneResource;
  index: number;
  onView: (resource: SaxophoneResource) => void;
}

function ResourceCard({ resource, index, onView }: ResourceCardProps) {
  const [loaded, setLoaded] = useState(false);

  const isExternal = !isSameOrigin(window.location.href, resource.viewUrl);

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
      </div>
      <div className="resource-card__actions">
        <a
          className={`resource-card__action${isExternal ? "" : " is-same-origin"}`}
          href={resource.viewUrl}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (onView) {
              onView(resource);
            }
          }}
          aria-label={`Ver ${resource.title}`}
        >
          👁️ Ver
        </a>
        <a
          className="resource-card__action"
          href={resource.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          download
          aria-label={`Descargar ${resource.title}`}
        >
          ⬇️ Descargar
        </a>
      </div>
    </article>
  );
}

interface OptimizedCatalogViewProps {
  resources: SaxophoneResource[];
  currentPage: number;
  onView: (resource: SaxophoneResource) => void;
  onPageChange: (page: number) => void;
}

export function OptimizedCatalogView({ resources, currentPage, onView, onPageChange }: OptimizedCatalogViewProps) {
  const [category, setCategory] = useState<Category | "all">("all");
  const [query, setQuery] = useState("");
  const [instrument, setInstrument] = useState<Instrument | "all">("all");
  const [loadingMore, setLoadingMore] = useState(false);

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      const matchesCategory =
        category === "all" || r.category === category;
      const matchesInstrument =
        instrument === "all" || r.instrument === instrument;
      const normalized = query.trim().toLowerCase();
      const matchesQuery =
        !normalized ||
        r.title.toLowerCase().includes(normalized) ||
        r.description.toLowerCase().includes(normalized);
      return matchesCategory && matchesInstrument && matchesQuery;
    });
  }, [category, instrument, query]);

  const pageSize = 24;
  const totalPages = Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(currentPage, Math.max(totalPages, 1));
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filtered.length);
  const visibleResources = filtered.slice(startIndex, endIndex);

  const handleScroll = useCallback(() => {
    const scrollPosition = window.innerHeight + window.scrollY;
    const documentHeight = document.documentElement.scrollHeight;

    if (scrollPosition >= documentHeight - 200 && !loadingMore) {
      if (safePage < totalPages) {
        setLoadingMore(true);
        setTimeout(() => {
          setLoadingMore(false);
        }, 500);
      }
    }
  }, [safePage, totalPages, loadingMore]);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div className="catalog">
      <header className="catalog-header">
        <div>
          <h1>Saxophone PDF Reader</h1>
          <p className="catalog-header__sub">
            Recursos PDF y solos transcritos para saxofón: ver y descargar.
          </p>
        </div>
        <div className="catalog-header__search">
          <label htmlFor="search">Buscar</label>
          <input
            id="search"
            className="search-input"
            placeholder="Título, categoría…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </header>

      <div className="catalog-filters">
        <div className="filter-group">
          <span className="filter-label">Categoría</span>
          <div className="filter-chips">
            <button
              className={`filter-chip${category === "all" ? " is-active" : ""}`}
              onClick={() => setCategory("all")}
            >
              Todos
            </button>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                className={`filter-chip${category === c ? " is-active" : ""}`}
                onClick={() => setCategory(c)}
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
                onClick={() => setInstrument("all")}
              >
                Todos
              </button>
              {INSTRUMENTS.map((inst) => (
                <button
                  key={inst}
                  className={`filter-chip${instrument === inst ? " is-active" : ""}`}
                  onClick={() => setInstrument(inst)}
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
              key={resource.viewUrl}
              resource={resource}
              index={i}
              onView={onView}
            />
          ))}
        </div>
      )}

      {loadingMore && (
        <div className="loading-more">
          Cargando más recursos...
        </div>
      )}

      {filtered.length > pageSize && (
        <div className="catalog-pagination">
          <button
            className="pagination-button"
            disabled={safePage <= 1}
            onClick={() => onPageChange(safePage - 1)}
          >
            Anterior
          </button>
          <span className="pagination-label">
            Página {safePage} de {totalPages}
          </span>
          <button
            className="pagination-button"
            disabled={safePage >= totalPages}
            onClick={() => onPageChange(safePage + 1)}
          >
            Siguiente
          </button>
        </div>
      )}

      <p className="catalog-info">
        Mostrando {startIndex + 1} - {endIndex} de {filtered.length} recursos
      </p>
    </div>
  );
}
