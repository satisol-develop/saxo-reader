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
  PROJECTS,
  CATEGORY_COUNTS,
  KIND_COUNTS,
  PENDING_COUNT,
  sortResources,
  SORT_OPTIONS,
  type SortOrder,
  sourceUrl as resourceSourceUrl,
  type Transcription,
  TRANSCRIPTIONS,
  DATA_GENERATED_AT,
} from "./catalog";
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

function FilterRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="filters__row">
      <span className="filters__label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <div className="filters__chips">{children}</div>
    </div>
  );
}

export function OptimizedCatalogView({ onView }: { onView: (resource: Transcription) => void }) {
  const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortOrder>("recommended");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  const chips = activeFilterChips(filters);
  const filesInView = useMemo(() => filtered.filter(hasFile).length, [filtered]);
  const activePreset = useMemo(() => {
    const keys = Object.keys(filters) as (keyof CatalogFilters)[];
    const isDefault = keys.every((key) => filters[key] === EMPTY_FILTERS[key]);
    if (isDefault) return "all";
    return (
      PRESETS.slice(1).find((preset) =>
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
      <div className="toolbar">
        <div className="toolbar__search">
          <span className="toolbar__icon" aria-hidden="true">
            🔍
          </span>
          <input
            id="search"
            className="search-input"
            type="search"
            placeholder="Busca un tema, un solista o un proyecto…"
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
          <button
            className={`toolbar-button${filtersOpen ? " is-active" : ""}`}
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
          >
            ⚙️ Filtros
            {chips.length > 0 && <span className="toolbar-button__count">{chips.length}</span>}
          </button>
          <label className="toolbar__sort">
            <span className="sr-only">Ordenar por</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortOrder)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  Orden: {option.label}
                </option>
              ))}
            </select>
          </label>
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
        </p>
        <p className="catalog__hint">
          «Buscar fichero» relee la página de origen cuando el enlace cambie de sitio.
        </p>
      </div>

      {filtersOpen && (
        <div className="filters">
          <div className="filters__head">
            <span className="filters__title">Refina la búsqueda</span>
            {chips.length > 0 && (
              <button className="pill pill--clear" onClick={clearAll}>
                Limpiar todo
              </button>
            )}
          </div>

          <FilterRow label="Fichero" hint="qué abre cada ficha">
            <Chip active={filters.kind === "all"} onClick={() => patch({ kind: "all" })}>
              Cualquiera
            </Chip>
            {MEDIA_KINDS.map((kind) => (
              <Chip
                key={kind.kind}
                active={filters.kind === kind.kind}
                count={KIND_COUNTS.get(kind.kind) ?? 0}
                onClick={() => patch({ kind: filters.kind === kind.kind ? "all" : (kind.kind as MediaKind) })}
              >
                {kind.label}
              </Chip>
            ))}
            <Chip active={filters.onlyWithFile} onClick={() => patch({ onlyWithFile: !filters.onlyWithFile })}>
              Solo con fichero
            </Chip>
          </FilterRow>

          <FilterRow label="Saxofón" hint="tonalidad que puedes leer">
            <Chip active={filters.instrument === "all"} onClick={() => patch({ instrument: "all" })}>
              Todos
            </Chip>
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
          </FilterRow>

          <FilterRow label="Proyecto" hint={`${PROJECTS.length} webs rastreadas`}>
            <Chip active={filters.project === "all"} count={TRANSCRIPTIONS.length} onClick={() => patch({ project: "all" })}>
              Todos
            </Chip>
            {PROJECTS.map((project) => (
              <Chip
                key={project.name}
                active={filters.project === project.name}
                count={project.count}
                onClick={() => patch({ project: filters.project === project.name ? "all" : project.name })}
              >
                {project.name}
              </Chip>
            ))}
          </FilterRow>

          <FilterRow label="Tipo de recurso">
            <Chip active={filters.category === "all"} onClick={() => patch({ category: "all" })}>
              Todos
            </Chip>
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
          </FilterRow>

          <FilterRow label="Estado del scraping">
            <Chip
              active={filters.onlyRequested}
              count={TRANSCRIPTIONS.filter((resource) => resource.requested).length}
              onClick={() => patch({ onlyRequested: !filters.onlyRequested })}
            >
              ★ De tu lista
            </Chip>
            <Chip active={filters.onlyPending} count={PENDING_COUNT} onClick={() => patch({ onlyPending: !filters.onlyPending })}>
              Sin fichero (abre fuera)
            </Chip>
            <Chip active={filters.includeDead} onClick={() => patch({ includeDead: !filters.includeDead })}>
              Incluir enlaces caídos
            </Chip>
          </FilterRow>
        </div>
      )}

      {chips.length > 0 && (
        <div className="filters__active">
          {chips.map((chip) => (
            <button
              key={String(chip.key)}
              className="pill"
              onClick={() => patch({ [chip.key]: EMPTY_FILTERS[chip.key] } as Partial<CatalogFilters>)}
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
            Prueba con otro proyecto, quita la tonalidad o busca solo el apellido del solista.
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
        BBDD rastreada el{" "}
        {new Date(DATA_GENERATED_AT).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })} ·
        una ficha por pieza
      </p>
    </div>
  );
}
