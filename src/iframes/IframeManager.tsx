import { useState, useEffect } from "react";
import { getIframeStrategy, getCorsProxyUrl } from "../scraper-config";

interface IframeManagerProps {
  url: string;
  title: string;
  className?: string;
  width?: string;
  height?: string;
}

export function IframeManager({ url, title, className = "", width = "100%", height = "600px" }: IframeManagerProps) {
  const [iframeConfig, setIframeConfig] = useState({
    src: url,
    sandbox: "allow-scripts allow-same-origin",
    allow: "fullscreen",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Determine the best iframe strategy
    const strategy = getIframeStrategy(url);

    switch (strategy) {
      case "same-origin":
        setIframeConfig({
          src: url,
          sandbox: "allow-scripts allow-same-origin",
          allow: "fullscreen",
        });
        break;

      case "cross-origin-safe":
        setIframeConfig({
          src: url,
          sandbox: "allow-scripts allow-same-origin",
          allow: "fullscreen",
        });
        break;

      case "cross-origin-proxy":
        // Use CORS proxy for MuseScore and other restricted sites
        const proxyUrl = getCorsProxyUrl(url);
        setIframeConfig({
          src: proxyUrl || url,
          sandbox: "allow-scripts allow-same-origin",
          allow: "fullscreen",
        });
        break;

      default:
        // No iframe - link in new tab
        setIframeConfig({
          src: "#",
          sandbox: "",
          allow: "",
        });
        break;
    }

    setLoading(false);
  }, [url]);

  if (iframeConfig.src === "#") {
    return (
      <div className={`iframe-placeholder ${className}`}>
        <p>
          Este recurso no se puede mostrar en un iframe.
          <a href={url} target="_blank" rel="noopener noreferrer">
            Abrir en una nueva pestaña →
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className={`iframe-container ${className}`} style={{ width, height }}>
      <div className="iframe-wrapper">
        <iframe
          title={title}
          src={iframeConfig.src}
          sandbox={iframeConfig.sandbox}
          allow={iframeConfig.allow}
          style={{
            width: "100%",
            height: "100%",
            border: "1px solid #ddd",
            borderRadius: "8px",
            overflow: "hidden",
          }}
          onLoad={() => setLoading(false)}
          onError={() => {
            setError("Error al cargar el contenido");
            setLoading(false);
          }}
        />
      </div>
      {loading && <div className="iframe-loading">Cargando...</div>}
      {error && <div className="iframe-error">⚠️ {error}</div>}
    </div>
  );
}

export default IframeManager;
