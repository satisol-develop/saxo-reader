import { useState, useEffect } from "react";
import { SCRAPER_SKILLS } from "./scraper-config";

export interface ScraperResult {
  url: string;
  title: string;
  description: string;
  pdfUrls: string[];
  canEmbed: boolean;
  iframeStrategy: "same-origin" | "cross-origin-safe" | "cross-origin-proxy" | "no-iframe";
  detectedResources: string[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook personalizado para scraping de recursos
 */
export function useScraper() {
  const [results, setResults] = useState<ScraperResult[]>([]);

  useEffect(() => {
    // Inicializar con habilidades por defecto
    const initSkills = SCRAPER_SKILLS.map(skill => ({
      ...skill,
      isActive: true,
    }));
    setResults(initSkills as any);
  }, []);

  return {
    results,
    scrapeUrl: async (url: string) => {
      // Método de scraping simplificado
      return {
        url,
        title: "Scraping...",
        description: "Detecting resources...",
        pdfUrls: [],
        canEmbed: false,
        iframeStrategy: "no-iframe",
        detectedResources: [],
        loading: true,
        error: null,
      };
    },
  };
}

export function ScraperPanel() {
  const [url, setUrl] = useState("");
  const [result] = useState<ScraperResult | null>(null);

  return (
    <div className="scraper-panel">
      <h2>📡 Scraper de Recursos</h2>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!url.trim()) return;
          // La lógica de scraping se implementará en la siguiente etapa
        }}
      >
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/partitura.pdf"
          className="scraper-input"
        />
        <button type="submit" className="scraper-button">
          🔍 Detectar PDF
        </button>
      </form>

      {result && (
        <div className="scraper-result">
          <h3>{result.title}</h3>
          <p>{result.description}</p>

          {result.error && (
            <div className="error">
              ⚠️ {result.error}
            </div>
          )}

          {result.pdfUrls.length > 0 && (
            <div className="pdf-list">
              <h4>📄 PDFs detectados:</h4>
              <ul>
                {result.pdfUrls.map((pdf, i) => (
                  <li key={i}>
                    <a href={pdf} target="_blank" rel="noopener noreferrer">
                      📄 {pdf}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.detectedResources.length > 0 && (
            <div className="resources">
              <h4>Recursos detectados:</h4>
              <ul>
                {result.detectedResources.map((res, i) => (
                  <li key={i}>{res}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ScraperPanel;
