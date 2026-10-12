import { useMemo, useState } from "react";
import {
  ACCESS_INFO,
  ACCESS_ORDER,
  type Source,
  type SourceAccess,
  SOURCES,
  SOURCES_BY_FILES,
  SOURCES_GENERATED_AT,
  SOURCES_TOTAL_PAGES,
  STRATEGY_LABELS,
  fullFiles,
  offersLabel,
} from "./sources";

interface SourcesViewProps {
  /** Salta al buscador con la fuente (y opcionalmente su página) filtradas. */
  onSearch: (options: { project?: string; page?: string; pageTitle?: string }) => void;
}

function AccessBadges({ source }: { source: Source }) {
  return (
    <span className="access-row">
      {ACCESS_ORDER.filter((access) => (source.access?.[access] ?? 0) > 0).map((access) => (
        <span
          key={access}
          className={`access access--${ACCESS_INFO[access].tone}`}
          title={ACCESS_INFO[access].hint}
        >
          {ACCESS_INFO[access].icon} {source.access[access]}
          <span className="access__label">{ACCESS_INFO[access].label}</span>
        </span>
      ))}
    </span>
  );
}

function SourceCard({
  source,
  onSearch,
}: {
  source: Source;
  onSearch: SourcesViewProps["onSearch"];
}) {
  const [open, setOpen] = useState(false);
  const [showRecipe, setShowRecipe] = useState(false);
  const withFiles = source.pages.filter((page) => page.files.pdf + page.files.image + page.files.video > 0);
  const pages = open ? source.pages : withFiles.slice(0, 4);

  return (
    <article className="source">
      <header className="source__head">
        <div className="source__title">
          <h3>{source.name}</h3>
          <a className="source__host" href={source.hub} target="_blank" rel="noopener noreferrer">
            {source.host} ↗
          </a>
        </div>
        <div className="source__badges">
          <span className="badge badge--ghost" title="Cómo se scrapea">
            {STRATEGY_LABELS[source.kind]}
          </span>
          {!source.embed && (
            <span className="badge badge--state badge--state-warn" title="No permite mostrarse dentro de la app">
              Sin iframe
            </span>
          )}
        </div>
      </header>

      <p className="source__offers">
        {offersLabel(source.totals.files)}
        <span className="source__dot" aria-hidden="true">
          ·
        </span>
        {source.totals.pages} páginas
        <span className="source__dot" aria-hidden="true">
          ·
        </span>
        {source.totals.items} fichas
        {source.totals.pagesOnly > 0 && (
          <span className="source__muted">{source.totals.pagesOnly} abren fuera</span>
        )}
      </p>

      <AccessBadges source={source} />

      <div className="source__actions">
        <button className="btn btn--primary" onClick={() => onSearch({ project: source.name })}>
          🔍 Buscar en esta fuente
        </button>
        <button className="btn" onClick={() => setShowRecipe((value) => !value)} aria-expanded={showRecipe}>
          🧭 Cómo se scrapea
        </button>
        <button className="btn" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? "▲ Menos páginas" : `▼ ${source.pages.length} páginas`}
        </button>
      </div>

      {showRecipe && (
        <div className="recipe">
          <ol className="recipe__steps">
            {source.recipe.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          {source.recipe.filePatterns.length > 0 && (
            <p className="recipe__patterns">
              Patrón de ficheros:{" "}
              {source.recipe.filePatterns.map((pattern) => (
                <code key={pattern}>{pattern}</code>
              ))}
            </p>
          )}
          {source.notes && <p className="recipe__notes">{source.notes}</p>}
        </div>
      )}

      <ul className="page-list">
        {pages.map((page) => {
          const files = page.files.pdf + page.files.image + page.files.video;
          const access = ACCESS_INFO[page.access];
          return (
            <li key={page.url} className="page-row">
              <div className="page-row__main">
                <span className="page-row__title" title={page.title}>
                  {page.title || page.url}
                </span>
                <span className="page-row__url" title={page.url}>
                  {page.url.replace(/^https?:\/\/(www\.)?/, "")}
                </span>
              </div>
              <div className="page-row__meta">
                {page.files.pdf > 0 && <span className="tag tag--pdf">{page.files.pdf} PDF</span>}
                {page.files.image > 0 && <span className="tag tag--image">{page.files.image} img</span>}
                {page.files.video > 0 && <span className="tag tag--video">{page.files.video} vídeo</span>}
                <span className={`tag tag--${access.tone}`} title={access.hint}>
                  {access.icon} {access.label}
                </span>
                {page.repaired && (
                  <span className="tag tag--warn" title="El enlace original estaba caído y se reparó">
                    reparada
                  </span>
                )}
              </div>
              {files > 0 ? (
                <button
                  className="btn btn--tiny"
                  onClick={() => onSearch({ project: source.name, page: page.url, pageTitle: page.title })}
                  title="Ver en el buscador las piezas resueltas en esta página"
                >
                  {files} piezas
                </button>
              ) : (
                <a
                  className="btn btn--tiny"
                  href={page.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Abrir la página original"
                >
                  abrir ↗
                </a>
              )}
            </li>
          );
        })}
        {!open && withFiles.length > 4 && (
          <li className="page-row page-row--more">
            <button className="btn btn--tiny" onClick={() => setOpen(true)}>
              +{withFiles.length - 4} páginas con ficheros
            </button>
          </li>
        )}
        {open && withFiles.length === 0 && source.pages.length > 4 && (
          <li className="page-row page-row--more">Sin ficheros directos: esta fuente se abre fuera.</li>
        )}
      </ul>
    </article>
  );
}

export function SourcesView({ onSearch }: SourcesViewProps) {
  const [query, setQuery] = useState("");
  const [access, setAccess] = useState<SourceAccess | "todas">("todas");
  const [onlyFiles, setOnlyFiles] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return SOURCES_BY_FILES.filter((source) => {
      if (onlyFiles && fullFiles(source) === 0) return false;
      if (access !== "todas" && !(source.access?.[access] ?? 0)) return false;
      if (!needle) return true;
      return [
        source.name,
        source.host,
        source.notes,
        ...source.recipe.steps,
        ...source.pages.map((page) => `${page.title} ${page.url}`),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [access, onlyFiles, query]);

  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, source) => {
          acc.pdf += source.totals.files.pdf;
          acc.video += source.totals.files.video;
          acc.pages += source.totals.pages;
          return acc;
        },
        { pdf: 0, video: 0, pages: 0 },
      ),
    [filtered],
  );

  return (
    <div className="sources-view">
      <div className="toolbar">
        <div className="toolbar__search">
          <span className="toolbar__icon" aria-hidden="true">
            🗂️
          </span>
          <input
            className="search-input"
            type="search"
            placeholder="Busca una fuente, una página o una URL…"
            aria-label="Buscar entre las fuentes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="toolbar__controls">
          <label className="toolbar__sort">
            <span className="sr-only">Acceso</span>
            <select value={access} onChange={(event) => setAccess(event.target.value as SourceAccess | "todas")}>
              <option value="todas">Acceso: cualquiera</option>
              {ACCESS_ORDER.map((value) => (
                <option key={value} value={value}>
                  {ACCESS_INFO[value].icon} {ACCESS_INFO[value].label}
                </option>
              ))}
            </select>
          </label>
          <button
            className={`toolbar-button${onlyFiles ? " is-active" : ""}`}
            onClick={() => setOnlyFiles((value) => !value)}
            aria-pressed={onlyFiles}
          >
            📄 Solo con ficheros
          </button>
        </div>
      </div>

      <p className="catalog__count catalog__count--row">
        <strong>{filtered.length}</strong> fuentes · {totals.pdf} PDF · {totals.video} vídeos ·{" "}
        {totals.pages} páginas ·{" "}
        <span className="catalog__files">
          {SOURCES.length} webs y {SOURCES_TOTAL_PAGES} páginas en la BBDD
        </span>
      </p>

      <div className="source-grid">
        {filtered.map((source) => (
          <SourceCard key={source.id} source={source} onSearch={onSearch} />
        ))}
      </div>

      <p className="catalog__footnote">
        BBDD por fuentes rastreada el{" "}
        {new Date(SOURCES_GENERATED_AT).toLocaleDateString("es-ES", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}{" "}
        · cada ficha dice qué ofrece su página y cómo se scrapea
      </p>
    </div>
  );
}
