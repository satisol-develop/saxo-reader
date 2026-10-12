import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIES,
  type Category,
  type CatalogFilters,
  EMPTY_FILTERS,
  INSTRUMENTS,
  type Instrument,
  KEY_LABELS,
  MUSIC_KEYS,
  type MusicKey,
  MEDIA_KINDS,
  type MediaKind,
  PRESETS,
  activeFilterChips,
  hasFile,
  kindLabel,
  linkState,
  matchesFilters,
  primaryAction,
  sortResources,
  SORT_OPTIONS,
  type SortOrder,
  sourceUrl as resourceSourceUrl,
  type Transcription,
} from "./catalog";
import {
  CATEGORY_COUNTS,
  DATA_GENERATED_AT,
  KIND_COUNTS,
  PENDING_COUNT,
  PROJECTS,
  TRANSCRIPTIONS,
} from "./catalog-data";
import { SOURCES } from "./sources";
import { resolveResourceMedia } from "./lib/scrape";
import { setMediaOverride, useResolvedMedia } from "./lib/mediaStore";

const PAGE_SIZE = 24;

interface ResolveState {
  status: "idle" | "loading" | "ok" | "error";
  message?: string;
}

/** Estado del enlace, en una sola línea de la tarjeta. */
function StateBadge({ resource }: { resource: Transcription }) {
  const state = linkState(resource);
  if (state.tone === "ok") return null;
  return <span className={`badge badge--state badge--state-${state.tone}`}>{state.label}</span>;
}

const ResourceCard = memo(function ResourceCard({
  resource,
  index,
  onView,
}: {
  resource: Transcription;
  index: number;
  onView: (resource: Transcription) => void;
}) {
  const media = useResolvedMedia(resource);
  const [resolve, setResolve] = useState<ResolveState>({ status: "idle" });

  const action = primaryAction(resource, media);
  const download = media.downloadUrl ?? "";
  const externalUrl = resourceSourceUrl(resource);
  const title = resource.tune ?? resource.title;

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
            ? "Sin fichero en la página: se abre fuera"
            : `Encontrado ${kindLabel(result.media.kind).toLowerCase()}`,
      });
    } else {
      setResolve({ status: "error", message: result.error ?? "No se pudo leer la página" });
    }
  };

  return (
    <article
      className={`card card--${media.kind}`}
      style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}
    >
      <header className="card__top">
        <div className="card__labels">
          <span className={`badge badge--${media.kind}`}>{kindLabel(media.kind)}</span>
          {resource.key && <span className="badge badge--key">En {resource.key}</span>}
          {resource.instrument && <span className="badge badge--ghost">{resource.instrument}</span>}
          {resource.media.source === "client" && <span className="badge badge--fresh">Recién leído</span>}
          <StateBadge resource={resource} />
        </div>
        {resource.requested && (
          <span className="card__requested" title="Estaba en tu lista del markdown">
            ★
          </span>
        )}
      </header>

      <h3 className="card__title" title={title}>
        {title}
      </h3>
      {resource.artist && <p className="card__artist">{resource.artist}</p>}

      <p className="card__meta">
        <span>{resource.project}</span>
        <span aria-hidden="true">·</span>
        <span>{resource.category}</span>
      </p>

      <footer className="card__actions">
        {action.embedded ? (
          <button className="btn btn--primary" onClick={() => onView(resource)}>
            {action.icon} {action.label}
          </button>
        ) : (
          <a
            className="btn btn--primary"
            href={media.url || externalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {action.icon} {action.label}
          </a>
        )}
        {download && (
          <a
            className="btn btn--icon"
            href={download}
            target="_blank"
            rel="noopener noreferrer"
            download
            title="Descargar el fichero"
            aria-label="Descargar el fichero"
          >
            ⬇️
          </a>
        )}
        <button
          className="btn btn--icon"
          onClick={handleScrape}
          disabled={resolve.status === "loading"}
          title="Releer la página de origen y buscar el PDF, imagen o vídeo"
          aria-label="Buscar fichero en la página de origen"
        >
          {resolve.status === "loading" ? "⏳" : "🔎"}
        </button>
      </footer>

      {resolve.status === "ok" || resolve.status === "error" ? (
        <p className={`card__note is-${resolve.status}`}>{resolve.message}</p>
      ) : null}
    </article>
  );
});

function Chip({
  active,
  count,
  title,
  children,
  onClick,
}: {
  active: boolean;
  count?: number;
  title?: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={`chip${active ? " is-active" : ""}`}
      onClick={onClick}
      aria-pressed={active}
      title={title}
      type="button"
    >
      {children}
      {typeof count === "number" && <span className="chip__count">{count}</span>}
    </button>
  );
}

/** Contenido: traduce un único `<select>` compacto a los filtros de tipo. */
const CONTENT_OPTIONS: { value: string; label: string; kind?: MediaKind; onlyWithFile?: boolean }[] = [
  { value: "all", label: "Cualquier contenido" },
  { value: "files", label: "Con fichero directo", onlyWithFile: true },
  ...[...MEDIA_KINDS]
    .sort((a, b) => (KIND_COUNTS.get(b.kind) ?? 0) - (KIND_COUNTS.get(a.kind) ?? 0))
    .map((kind) => ({
      value: kind.kind,
      label: `${kind.label} (${KIND_COUNTS.get(kind.kind) ?? 0})`,
      kind: kind.kind,
    })),
];

export function OptimizedCatalogView({
  onView,
  initialFilters,
}: {
  onView: (resource: Transcription) => void;
  initialFilters?: Partial<CatalogFilters>;
}) {
  const [filters, setFilters] = useState<CatalogFilters>({ ...EMPTY_FILTERS, ...initialFilters });
  const [sort, setSort] = useState<SortOrder>("recommended");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [advanced, setAdvanced] = useState(false);
  const deferredQuery = useDeferredValue(filters.query);

  const activeFilters = useMemo<CatalogFilters>(
    () => ({ ...filters, query: deferredQuery }),
    [filters, deferredQuery],
  );

  const filtered = useMemo(
    () => sortResources(TRANSCRIPTIONS.filter((resource) => matchesFilters(resource, activeFilters)), sort),
    [activeFilters, sort],
  );

  const visibleResources = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  const patch = useCallback((changes: Partial<CatalogFilters>) => {
    setFilters((current) => ({ ...current, ...changes }));
    setVisibleCount(PAGE_SIZE);
  }, []);

  const clearAll = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setVisibleCount(PAGE_SIZE);
  }, []);

  const applyPreset = useCallback((id: string) => {
    const preset = PRESETS.find((item) => item.id === id);
    setFilters({ ...EMPTY_FILTERS, ...(preset?.filters ?? {}) });
    setVisibleCount(PAGE_SIZE);
  }, []);

  const contentValue = filters.onlyWithFile && filters.kind === "all" ? "files" : filters.kind;
  const chips = activeFilterChips(filters);
  const advancedCount = chips.filter((chip) =>
    ["instrument", "key", "category", "onlyRequested", "onlyPending", "includeDead"].includes(String(chip.key)),
  ).length;
  const filesInView = useMemo(() => filtered.filter(hasFile).length, [filtered]);

  const activePreset = useMemo(() => {
    const keys = Object.keys(filters) as (keyof CatalogFilters)[];
    const isDefault = keys.every((key) => filters[key] === EMPTY_FILTERS[key]);
    if (isDefault) return "all";
    return (
      PRESETS.slice(1).find(
        (preset) =>
          !preset.filters.instrument &&
          !preset.filters.key &&
          !preset.filters.category &&
          (Object.keys(preset.filters) as (keyof CatalogFilters)[]).every(
            (key) => filters[key] === preset.filters[key],
          ),
      )?.id ?? ""
    );
  }, [filters]);

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
      {/* Barra compacta: buscar, fuente, contenido y orden. Todo lo demás, plegado. */}
      <div className="toolbar">
        <div className="toolbar__search">
          <span className="toolbar__icon" aria-hidden="true">
            🔍
          </span>
          <input
            id="search"
            className="search-input"
            type="search"
            placeholder="Busca un tema, un solista o una fuente…"
            aria-label="Buscar en el catálogo"
            value={filters.query}
            onChange={(event) => patch({ query: event.target.value })}
          />
          {filters.query && (
            <button className="toolbar__clear" onClick={() => patch({ query: "" })} aria-label="Borrar búsqueda">
              ✕
            </button>
          )}
        </div>

        <div className="toolbar__controls">
          <label className="toolbar__select">
            <span className="sr-only">Fuente</span>
            <select
              value={filters.project}
              onChange={(event) => patch({ project: event.target.value, page: "all" })}
            >
              <option value="all">Fuente: todas ({TRANSCRIPTIONS.length})</option>
              {SOURCES.map((source) => (
                <option key={source.id} value={source.name}>
                  {source.name} ({source.totals.items})
                </option>
              ))}
            </select>
          </label>

          <label className="toolbar__select">
            <span className="sr-only">Contenido</span>
            <select
              value={contentValue}
              onChange={(event) => {
                const option = CONTENT_OPTIONS.find((item) => item.value === event.target.value);
                patch({
                  kind: option?.kind ?? "all",
                  onlyWithFile: Boolean(option?.onlyWithFile),
                });
              }}
            >
              {CONTENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="toolbar__select">
            <span className="sr-only">Ordenar por</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortOrder)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Orden: {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className={`toolbar-button${advanced ? " is-active" : ""}`}
            onClick={() => setAdvanced((open) => !open)}
            aria-expanded={advanced}
          >
            ⚙️ Más filtros
            {advancedCount > 0 && <span className="toolbar-button__count">{advancedCount}</span>}
          </button>
        </div>
      </div>

      <div className="presets" role="tablist" aria-label="Atajos de búsqueda">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            role="tab"
            aria-selected={activePreset === preset.id}
            className={`preset${activePreset === preset.id ? " is-active" : ""}`}
            title={preset.hint}
            onClick={() => applyPreset(preset.id)}
          >
            <span className="preset__icon" aria-hidden="true">
              {preset.icon}
            </span>
            <span className="preset__label">{preset.label}</span>
          </button>
        ))}
      </div>

      <div className="catalog__summary">
        <p className="catalog__count">
          <strong>{filtered.length}</strong> piezas
          <span className="catalog__sep" aria-hidden="true">
            ·
          </span>
          <span className="catalog__files">{filesInView} con fichero directo</span>
          {filtered.length !== TRANSCRIPTIONS.length && (
            <>
              <span className="catalog__sep" aria-hidden="true">
                ·
              </span>
              <span>{TRANSCRIPTIONS.length} en total</span>
            </>
          )}
          <span className="catalog__sep" aria-hidden="true">
            ·
          </span>
          <span className="catalog__hint-inline">🔎 relee la página si el enlace cambió</span>
        </p>
      </div>

      {advanced && (
        <div className="filters filters--compact">
          <div className="filters__group">
            <span className="filters__label">Saxofón</span>
            <div className="filters__chips">
              {INSTRUMENTS.map((instrument) => (
                <Chip
                  key={instrument}
                  active={filters.instrument === instrument}
                  onClick={() =>
                    patch({ instrument: filters.instrument === instrument ? "all" : (instrument as Instrument) })
                  }
                >
                  {instrument}
                </Chip>
              ))}
              {MUSIC_KEYS.map((key) => (
                <Chip
                  key={key}
                  active={filters.key === key}
                  title={KEY_LABELS[key]}
                  onClick={() => patch({ key: filters.key === key ? "all" : (key as MusicKey) })}
                >
                  {KEY_LABELS[key]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="filters__group">
            <span className="filters__label">Tipo</span>
            <div className="filters__chips">
              {CATEGORIES.map((category) => (
                <Chip
                  key={category}
                  active={filters.category === category}
                  count={CATEGORY_COUNTS.get(category) ?? 0}
                  onClick={() => patch({ category: filters.category === category ? "all" : (category as Category) })}
                >
                  {category}
                </Chip>
              ))}
            </div>
          </div>

          <div className="filters__group">
            <span className="filters__label">Estado</span>
            <div className="filters__chips">
              <Chip
                active={filters.onlyRequested}
                count={TRANSCRIPTIONS.filter((resource) => resource.requested).length}
                onClick={() => patch({ onlyRequested: !filters.onlyRequested })}
              >
                ★ De tu lista
              </Chip>
              <Chip
                active={filters.onlyPending}
                count={PENDING_COUNT}
                onClick={() => patch({ onlyPending: !filters.onlyPending })}
              >
                Abren fuera
              </Chip>
              <Chip active={filters.includeDead} onClick={() => patch({ includeDead: !filters.includeDead })}>
                Incluir caídos
              </Chip>
            </div>
          </div>

          {chips.length > 0 && (
            <button className="pill pill--clear" onClick={clearAll}>
              Limpiar todos los filtros
            </button>
          )}
        </div>
      )}

      {chips.length > 0 && (
        <div className="filters__active">
          {chips.map((chip) => (
            <button
              key={String(chip.key)}
              className="pill"
              onClick={() =>
                patch({
                  [chip.key]: EMPTY_FILTERS[chip.key],
                  ...(chip.key === "project" ? { page: "all" as const } : {}),
                } as Partial<CatalogFilters>)
              }
            >
              {chip.label} <span aria-hidden="true">✕</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty">
          <p className="empty__title">Nada por aquí</p>
          <p className="empty__hint">
            Prueba con otra fuente, quita la tonalidad o busca solo el apellido del solista.
          </p>
          <button className="btn" onClick={clearAll}>
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid">
          {visibleResources.map((resource, index) => (
            <ResourceCard key={resource.id} resource={resource} index={index} onView={onView} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="catalog__more" ref={sentinelRef}>
          <button className="btn" onClick={() => setVisibleCount((current) => current + PAGE_SIZE)}>
            Cargar más ({filtered.length - visibleCount} restantes)
          </button>
        </div>
      )}

      <p className="catalog__footnote">
        {PROJECTS.length} fuentes · BBDD de piezas rastreada el{" "}
        {new Date(DATA_GENERATED_AT).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
      </p>
    </div>
  );
}
