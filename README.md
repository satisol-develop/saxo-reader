# Saxophone PDF Reader

Buscador de transcripciones, métodos y recursos de saxofón. Un scraper recorre
las páginas de origen, resuelve **qué hay exactamente en cada enlace** (PDF,
imagen, vídeo o sólo una página) y lo deja en una BBDD JSON que alimenta la app:
buscar, filtrar por proyecto/tipo/instrumento, ver dentro de la app y descargar.

> La app nunca aloja los documentos: enlaza a la fuente original (IMSLP, Internet
> Archive, MuseScore, SaxTeacher UK, Scooby Sax…) y muestra el estado de derechos
> de cada recurso.

---

## Cómo funciona

```
saxophone-transcriptions-resources.md   tu biblioteca (piezas por proyecto)
        │  npm run scrape:sources
        ▼
scripts/sources.json      páginas a visitar + scripts/library.json (tus piezas)
        │  npm run scrape            (crawl → scripts/crawl-cache.json)
        │  npm run scrape -- --from-cache   re-empareja sin salir a la red
        ▼
src/data/sources.json         ← BBDD POR FUENTES (la base del buscador)
        21 webs · 501 páginas: qué ofrece cada página y cómo se scrapea
src/data/transcriptions.json  ← piezas ya resueltas (capa "ya disponible")
        │  npm run build
        ▼
dist/                         app estática (GitHub Pages)
```

La app se organiza por **fuentes**, no por un listado plano de partituras:

- **🔍 Buscar**: el buscador de piezas ya resueltas (884 fichas). Filtra por
  fuente, contenido, saxofón/tonalidad, tipo y estado.
- **🗂️ Fuentes**: el directorio de las 21 webs. Cada fuente enseña su **receta**
  («cómo se scrapea»: dónde está el catálogo, patrón de los ficheros, pasos) y
  cada una de sus **páginas** con lo que ofrece de verdad y su estado de acceso:

  | acceso | qué significa |
  | --- | --- |
  | ✅ Abierta | se rastrea sin problemas; los ficheros están en el HTML |
  | 🔒 Descarga con botón | la página abre, el fichero sale al pulsar (login, pago, reCAPTCHA) |
  | ⚙️ Solo JavaScript | el catálogo se pinta en el navegador (SPA): se enlazan sus anclas |
  | 🤖 Bloquea bots | responde 403/429 a los scrapers (abre bien en el navegador) |
  | ⛔ Caída | el enlace ya no responde |
  | ⏳ Sin rastrear | está en tu lista y aún no se ha visitado |

  Desde cualquier página puedes saltar al buscador ya filtrado por esa fuente o
  por esa página concreta ("esta página ofrece estos 3 PDFs").

1. **Scraping de build** (`scripts/scrape.mjs`): visita cada página, guarda el
   estado HTTP y decide el medio:
   - **PDF** directo (aunque esté enlazado dentro de una página con 260
     partituras: se elige la que corresponde al título, y la tonalidad del
     instrumento cuando hay versiones Bb/Eb).
   - **Vídeo** con su URL de embed (YouTube/Vimeo o `.mp4`). Sólo se acepta una
     URL que sea un vídeo: un canal de YouTube no es un vídeo.
   - **Imagen** de partitura.
   - **Página**: cuando no hay fichero identificable, la ficha abre la fuente en
     una pestaña nueva.
   - **Reparación**: si un enlace está caído (404), se busca la página viva en el
     índice del proyecto y se empareja por título (así se arreglaron 8 enlaces
     muertos de SaxTeacher UK).
2. **Scraping en el navegador** (`src/lib/scrape.ts`): un enlace puede cambiar
   después de generar la BBDD. El botón *«Buscar fichero»* de cada ficha (y
   *«Volver a buscar»* en el visor) relee la página con las mismas reglas y
   guarda el resultado en `localStorage`. Como el navegador no puede leer
   orígenes ajenos, se usa una cadena de proxies CORS públicos
   (allorigins → codetabs → jina) o el tuyo propio con `VITE_SCRAPE_PROXY`.
3. **Emparejamiento con tu lista**: cada pieza del markdown se busca en las
   fichas rastreadas (tema primero, solista para desempatar, tonalidad según el
   instrumento y, como red, el nombre del fichero). Sin coincidencia, la pieza
   entra igualmente en el buscador apuntando a su página, lista para reintentar.
4. **Visor por tipo**: PDF e imágenes en `<iframe>`/`<img>`, vídeos embebidos, y
   aviso + botón cuando el sitio prohíbe el iframe (MuseScore, free-scores,
   Taming the Saxophone, La Touche Musicale) o bloquea a los bots (403/429).
5. **Leer de verdad**: el visor tiene **pantalla completa** (Fullscreen API y, si
   el navegador no la concede, «modo teatro» a pantalla completa dentro de la
   app), **zoom** para PDF (hash `#zoom=`) e imágenes, y atajos: `F` pantalla
   completa, `+`/`−`/`0` zoom, `Esc` salir.

---

## Buscar y filtrar

La barra es **una sola fila**: buscador + `Fuente` + `Contenido` + `Orden`, y
**«Más filtros»** para lo demás. Nada de 45 chips a la vista:

- **Contenido**: cualquier contenido, con fichero directo, PDF, Vídeo, Imagen o
  Página (con su recuento).
- **Fuente**: las 21 webs con sus piezas ya resueltas.
- **Más filtros**: saxofón y tonalidad legible (Concierto C, Sib, Mib, Fa), tipo
  de recurso (Solo, Estudio/Método, Partitura, Guía, Índice) y estado
  (★ de tu lista, abren fuera, incluir caídos).

**Atajos de un clic**: Todo · PDF listos · De tu lista · Vídeos · Estudios ·
Pendientes. Búsqueda por tema, solista, fuente o tonalidad (todas las palabras,
en cualquier orden), orden **Recomendado** por defecto (tus piezas y lo que se
abre aquí primero) y los filtros activos como etiquetas quitables.

---

## Comandos

```bash
npm install
npm run dev            # servidor de desarrollo

npm run scrape         # visita todas las fuentes y reescribe la BBDD
npm run scrape -- --from-cache        # re-empareja en segundos con el último crawl
npm run scrape -- --only imslp.org    # sólo un dominio (no borra el resto)
npm run scrape -- --limit 5 --delay 0 # prueba rápida
npm run scrape:sources # regenera sources.json y library.json desde el markdown
npm run check:data     # valida la BBDD (lo usa el CI antes de compilar)

npm run build          # typecheck + bundle a dist/
npm run build:all      # scrape + validación + build
npm run lint
```

Para añadir una **fuente nueva**: añade su receta en
[`scripts/source-profiles.mjs`](scripts/source-profiles.mjs) (dominio, de dónde
cuelga el catálogo, patrón de los ficheros, qué hace con los bots) y su dominio
en el mapa de reglas de [`scripts/build-sources.mjs`](scripts/build-sources.mjs).
Después, `npm run scrape:sources && npm run scrape`.

Para añadir **piezas** a mano: edita `scripts/sources.json` (o `src/catalog.ts` y
luego `npm run scrape:sources`), ejecuta `npm run scrape` y revisa el resumen que
imprime (cuántos PDFs, cuántos caídos, cuántos reparados, y el estado de acceso
de cada fuente).

---

## Deploy automático (GitHub Pages)

El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compila
y publica en cada push a `main`, y además:

- se puede lanzar a mano (**Actions → Deploy a GitHub Pages → Run workflow**)
  marcando *«Volver a hacer scraping»* para refrescar la BBDD en el deploy;
- corre **cada lunes** con scraping, así se detectan enlaces caídos y ficheros
  nuevos sin que nadie haga nada.

Para activarlo una sola vez: **Settings → Pages → Source: GitHub Actions**.

La BBDD incluida en el repo hace que un deploy normal sea rápido y reproducible
(no depende de que los sitios de terceros respondan). Alternativa manual:
`npm run deploy:github`, que publica `dist/` en la rama `gh-pages`.

`vite.config.ts` usa `base: "/saxo-reader/"` porque el sitio se sirve en
`https://<usuario>.github.io/saxo-reader/`; cámbialo si usas dominio propio.

---

## Límites conocidos

- **MuseScore** responde 403 a los scrapers (10 fichas): se marcan como
  «Bloquea bots» y se abren en pestaña nueva; su Score Viewer sí funciona en el
  navegador.
- **IMSLP** sirve los escaneos tras un anti-bot: la ficha usa la página de la obra
  (que se incrusta bien y trae su propio botón de descarga) y guarda el enlace
  `Special:ImagefromIndex`.
- Los proxies CORS públicos tienen límite de peticiones; si se agotan, el botón
  de reintento avisa y se usa el enlace de la BBDD.
