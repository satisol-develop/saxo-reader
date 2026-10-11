import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIES,
  type Category,
  EMPTY_FILTERS,
  INSTRUMENTS,
  type Instrument,
  type MediaKind,
  MEDIA_KINDS,
  type CatalogFilters,
  kindLabel,
  linkState,
  matchesFilters,
  primaryAction,
  PROJECTS,
  sourceUrl as dbSourceUrl,
  type Transcription,
  TRANSCRIPTIONS,
} from "./catalog";
import { resolveResourceMedia } from "./lib/scrape";
import { setMediaOverride, useResolvedMedia } from "./lib/mediaStore";

const PAGE_SIZE = 24;

interface ResourceCardProps {
  resource: Transcription;
  index: number;
  filters: CatalogFilters;
  onView: (resource: Transcription) => void;
}

interface ResolveState {
  status: "idle" | "loading" | "ok" | "error";
  message?: string;
}

const ResourceCard = memo(function ResourceCard({ resource, index, filters, onView }: ResourceCardProps) {
  const media = useResolvedMedia(resource);
  const [resolve, setResolve] = useState<ResolveState>({ status: "idle" });

  const action = primaryAction(resource, media);
  const state = linkState(resource);
  const download = media.downloadUrl ?? "";
  const externalUrl = dbSourceUrl(resource);

  const handleView = (event: React.MouseEvent) => {
    event.preventDefault();
    onView(resource);
  };

  const handleScrape = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setResolve({ status: "loading" });
    const result = await resolveResourceMedia(resource.title, externalUrl);
    if (result.ok && result.media) {
      setMediaOverride(resource.id, result.media);
      setResolve({
        status: "ok",
        message:
          result.media.kind === "page"
            ? "La página no expone ningún fichero: se abre fuera"
            : `Encontrado ${kindLabel(result.media.kind).toLowerCase()}`,
      });
    } else {
      setResolve({ status: "error", message: result.error ?? "No se pudo leer la página" });
    }
  };

  return (
    <article
      className={`resource-card resource-card--${media.kind}`}
      style={{
        animationDelay: `${Math.min(index, 12) * 35}ms`,
        opacity: 0,
      }}
    >
      <div className="resource-card__top">
        <span className={`badge badge--${media.kind}`}>{kindLabel(media.kind)}</span>
        <span className={`badge badge--state badge--state-${state.tone}`}>{state.label}</span>
      </div>
      <h3 className="resource-card__title">{resource.title}</h3>
      <p className="resource-card__description">{resource.description}</p>
      <div className="resource-card__meta">
        <span className="resource-card__project">{resource.project}</span>
        <span className="resource-card__category">{resource.category}</span>
        {resource.instrument && <span className="resource-card__instrument">{resource.instrument}</span>}
      </div>

      <div className="resource-card__actions">
        {action.embedded ? (
          <button className="resource-card__action is-primary" onClick={handleView}>
            {action.icon} {action.label}
          </button>
        ) : (
          <a
            className="resource-card__action is-primary"
            href={media.url || externalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {action.icon} {action.label}
          </a>
        )}
        {download && (
          <a
            className="resource-card__action"
            href={download}
            target="_blank"
            rel="noopener noreferrer"
            download
          >
            ⬇️ Descargar
          </a>
        )}
        <button
          className="resource-card__action is-ghost"
          onClick={handleScrape}
          disabled={resolve.status === "loading"}
          title="Volver a leer la página de origen y buscar el PDF, imagen o vídeo"
        >
          {resolve.status === "loading" ? "⏳ Buscando…" : media.source === "client" ? "♻️ Reintentar" : "🔎 Buscar fichero"}
        </button>
      </div>

      {resolve.status !== "idle" && resolve.status !== "loading" && (
        <p className={`resource-card__resolve is-${resolve.status}`}>{resolve.message}</p>
      )}

      {filters.kind === "all" && resource.candidates.pdfs.length > 1 && media.kind !== "pdf" && (
        <p className="resource-card__hint">
          {resource.candidates.pdfs.length} PDFs en la página · ninguno coincide con el título
        </p>
      )}
    </article>
  );
});

export function OptimizedCatalogView({ onView }: { onView: (resource: Transcription) => void }) {
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(filters.query);

  const activeFilters = useMemo<CatalogFilters>(
    () => ({ ...filters, query: deferredQuery }),
    [filters, deferredQuery],
  );

  const filtered = useMemo(
    () => TRANSCRIPTIONS.filter((resource) => matchesFilters(resource, activeFilters)),
    [activeFilters],
  );

  const visibleResources = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  const resetAnd = useCallback((patch: Partial<CatalogFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setVisibleCount(PAGE_SIZE);
  }, []);

  const loadMore = useCallback(
    () => setVisibleCount((current) => Math.min(current + PAGE_SIZE, filtered.length)),
    [filtered.length],
  );

  // Carga progresiva sin listener de scroll: sólo se observa el centinela.
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

  const withMedia = filtered.filter((resource) => resource.media.kind !== "page" && resource.media.kind !== "none").length;

  return (
    <div className="catalog">
      <header className="catalog-header">
        <p className="catalog-header__sub">
          {filtered.length === 0
            ? "Sin resultados para esta búsqueda"
            : `${filtered.length} transcripciones · ${withMedia} con fichero directo`}
        </p>
        <div className="catalog-header__search">
          <label htmlFor="search">Buscar</label>
          <input
            id="search"
            className="search-input"
            placeholder="Título, solista, proyecto…"
            value={filters.query}
            onChange={(event) => resetAnd({ query: event.target.value })}
          />
        </div>
      </header>

      <div className="catalog-filters">
        <FilterGroup
          label="Proyecto"
          value={filters.project}
          options={PROJECTS.map((project) => ({ value: project.name, label: `${project.name} (${project.count})` }))}
          onChange={(value) => resetAnd({ project: value })}
        />
        <FilterGroup
          label="Tipo"
          value={filters.kind}
          options={MEDIA_KINDS.map((kind) => ({ value: kind.kind, label: kind.label }))}
          onChange={(value) => resetAnd({ kind: value as MediaKind | "all" })}
        />
        <FilterGroup
          label="Categoría"
          value={filters.category}
          options={CATEGORIES.map((category) => ({ value: category, label: category }))}
          onChange={(value) => resetAnd({ category: value as Category | "all" })}
        />
        <FilterGroup
          label="Instrumento"
          value={filters.instrument}
          options={INSTRUMENTS.map((instrument) => ({ value: instrument, label: instrument }))}
          onChange={(value) => resetAnd({ instrument: value as Instrument | "all" })}
        />
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={filters.includeDead}
            onChange={(event) => resetAnd({ includeDead: event.target.checked })}
          />
          Incluir enlaces caídos
        </label>
      </div>

      {filtered.length === 0 ? (
        <div className="empty">
          <p>No se encontraron recursos para esa búsqueda.</p>
          <button className="pagination-button" onClick={() => resetAnd(EMPTY_FILTERS)}>
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="resource-grid">
          {visibleResources.map((resource, index) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              index={index}
              filters={filters}
              onView={onView}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="catalog-more" ref={sentinelRef}>
          <button className="pagination-button" onClick={loadMore}>
            Cargar más recursos ({filtered.length - visibleCount} restantes)
          </button>
        </div>
      )}
    </div>
  );
}

interface FilterGroupProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

function FilterGroup({ label, value, options, onChange }: FilterGroupProps) {
  return (
    <div className="filter-group">
      <span className="filter-label">{label}</span>
      <div className="filter-chips">
        <button
          className={`filter-chip${value === "all" ? " is-active" : ""}`}
          onClick={() => onChange("all")}
        >
          Todos
        </button>
        {options.map((option) => (
          <button
            key={option.value}
            className={`filter-chip${value === option.value ? " is-active" : ""}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
