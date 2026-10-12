/**
 * Perfiles de fuente: **cómo se scrapea cada web**.
 *
 * Cada fuente (un dominio) declara aquí su receta: de dónde cuelga el catálogo,
 * qué patrón tienen los ficheros, en qué se diferencia su HTML y qué hace con
 * los bots. El scraper lo usa para visitar y `scripts/scrape.mjs` lo vuelca en
 * `src/data/sources.json`, que es la BBDD por fuentes que alimenta el buscador:
 * una ficha por web y, dentro, una por página con lo que ofrece en realidad
 * (PDF / imágenes / vídeo) y su estado de acceso.
 *
 *   access:        open      → se puede rastrear con normalidad
 *                  bots      → responde 403/429 a los scrapers (abre en el navegador)
 *                  js        → el catálogo se pinta con JavaScript (anclas/SPA)
 *                  gated     → el fichero está tras un botón, login o pago
 *   strategy:      list      → un índice con enlaces a ficheros
 *                  pieces    → páginas sueltas, una por pieza
 *                  letters   → índices alfabéticos (/title/a/, /title/b/…)
 *                  sitemap   → hay que leer los sitemaps para encontrar páginas
 *                  spa       → aplicación de una sola página con anclas
 *                  hub       → página de recurso (métodos, guías)
 */

export const PROJECT_NAMES = {
  "scooby-sax.com": "Scooby Sax",
  "saxteacheruk.com": "SaxTeacher UK",
  "ousaxstudio.weebly.com": "Ohio Sax Studio",
  "musescore.com": "MuseScore",
  "imslp.org": "IMSLP",
  "saxophonemusic.org": "Saxophonemusic.org",
  "tamingthesaxophone.com": "Taming the Saxophone",
  "latouchemusicale.com": "La Touche Musicale",
  "archive.org": "Internet Archive",
  "randyhunterjazz.com": "Randy Hunter Jazz",
  "free-scores.com": "Free-scores.com",
  "saxschoolonline.com": "McGill Sax School",
  "dansr.com": "Vandoren / D'Addario",
  "selmer.fr": "Selmer Paris",
  "yamaha.com": "Yamaha",
  "jazzbarisax.com": "JazzBariSax",
  "pepperadams.com": "Pepper Adams",
  "bopland.org": "BopLand",
  "sharpelevenmusic.com": "Sharp Eleven Music",
  "zdenkoivanusic.com": "Zdenko Ivanusic",
  "jazzsaxophonelessons.com": "Jazz Saxophone Lessons",
};

export const SOURCE_PROFILES = {
  "scooby-sax.com": {
    hub: "https://scooby-sax.com/Transcriptions.html",
    strategy: "list",
    access: "open",
    filePatterns: ["*.pdf"],
    howToScrape: [
      "Descarga el índice Transcriptions.html y quédate con los <a href> que acaban en .pdf (son ~260).",
      "El nombre del fichero ya trae datos: tema_solista_tonalidad (AFoggyDay_Cuber_Bb.pdf).",
      "Úsalo como respaldo del texto del enlace: separa por '_' y ' - ' y detecta Bb/Eb/C.",
      "Si el mismo tema tiene versiones Bb, C y Eb, elige la que lee el instrumento pedido.",
    ],
    notes: "Los PDF son enlaces directos: se leen dentro de la app sin salir.",
  },
  "saxteacheruk.com": {
    hub: "https://saxteacheruk.com/free-transcriptions.html",
    strategy: "pieces",
    access: "open",
    filePatterns: ["*.pdf"],
    howToScrape: [
      "Entra en el índice free-transcriptions.html y saca las URLs /transcriptions/<pieza>/….html.",
      "Visita cada página de pieza: los PDF (parte Bb, Eb y concert) están enlazados ahí, a veces en un segundo nivel.",
      "Cada página trae también un <audio> con la grabación: úsalo para saber que la pieza existe.",
      "Si una URL responde 404, se busca su equivalente vivo en el índice del proyecto (así se repararon 8 enlaces).",
    ],
    notes: "Publica lead sheets y transcripciones completas; el título real manda sobre el texto del enlace.",
  },
  "zdenkoivanusic.com": {
    hub: "https://www.zdenkoivanusic.com/sdm_downloads/good-time-boogie/",
    strategy: "pieces",
    access: "gated",
    filePatterns: ["?sdm_process_download=1&download_id=*"],
    howToScrape: [
      "El catálogo cuelga de /sdm_downloads/<pieza>/ (una página por pieza).",
      "El PDF no es un enlace directo: la página tiene un botón ?sdm_process_download=1&download_id=NNN con reCAPTCHA.",
      "No se puede automatizar: se guarda la pieza apuntando a su página para que el usuario pulse el botón allí.",
      "El listado se descubre desde /transcriptions/ y /downloads/ más los sitemaps del sitio.",
    ],
    notes: "33 piezas arregladas por saxofón; la descarga es manual por el reCAPTCHA del sitio.",
  },
  "saxophonemusic.org": {
    hub: "https://saxophonemusic.org/category/classical/",
    strategy: "letters",
    access: "open",
    filePatterns: ["*-b-flat.pdf", "*-e-flat.pdf", "*.pdf"],
    howToScrape: [
      "Recorre los índices alfabéticos /title/a/, /title/b/… (listan todas las obras).",
      "Cada obra vive en /title/<letra>/<obra>/ y publica un PDF por tonalidad (<obra>-b-flat.pdf, <obra>-e-flat.pdf).",
      "Redacta el título quitando guiones del slug: a-tisket-a-tasket → A-Tisket, A-Tasket.",
    ],
    notes: "151 fichas, casi todas con PDF directo por instrumento.",
  },
  "bopland.org": {
    hub: "http://bopland.org/database",
    strategy: "spa",
    access: "js",
    filePatterns: [],
    howToScrape: [
      "El catálogo es una SPA (#treble-clef-licks/<Tema>): al pedir el HTML no hay enlaces de fichero.",
      "Los temas se sacan del sitemap del sitio (anclas con '/'), no del HTML.",
      "Cada lick se guarda como pieza que abre el lector de BopLand en su ancla.",
    ],
    notes: "No expone PDFs: es un lector (partitura + audio) dentro del navegador.",
  },
  "musescore.com": {
    hub: "https://musescore.com/sheetmusic/solo/saxophone-alto",
    strategy: "pieces",
    access: "bots",
    filePatterns: [],
    howToScrape: [
      "Responde 403 a cualquier petición automática, incluso con User-Agent de navegador.",
      "Las piezas se guardan desde tu lista, apuntando a su página de MuseScore.",
      "En el navegador su visor de partituras sí funciona: se abre en pestaña nueva.",
    ],
    notes: "Cortafuegos anti-bot: no hay scraping posible desde aquí.",
  },
  "imslp.org": {
    hub: "https://imslp.org/wiki/Category:For_saxophone",
    strategy: "hub",
    access: "open",
    filePatterns: ["Special:ImagefromIndex/*"],
    howToScrape: [
      "Las obras viven en /wiki/<Obra> y los escaneos se sirven tras un paso anti-bot.",
      "Se guarda la página de la obra (se incrusta bien) y el enlace Special:ImagefromIndex/<id> con su botón de descarga.",
    ],
    notes: "Escaneos con licencia por obra: revisa el aviso de cada documento.",
  },
  "archive.org": {
    hub: "https://archive.org/details/universalmethodf0000unse",
    strategy: "hub",
    access: "open",
    filePatterns: ["*.pdf"],
    howToScrape: [
      "Los métodos están en /details/<obra>/; los PDF cuelgan del propio detalle.",
      "Se descarta la fila genérica «download 1 file» y se usa el título de la obra.",
    ],
    notes: "Métodos históricos completos (Klosé, Universal Method).",
  },
  "free-scores.com": {
    hub: "https://www.free-scores.com/free-sheet-music.php?CATEGORIE=280",
    strategy: "hub",
    access: "open",
    filePatterns: [],
    howToScrape: [
      "Cada obra tiene su página /partition/…; el PDF real está detrás de su descarga.",
      "El sitio prohíbe el iframe: la ficha abre su página, que ya lleva el botón de descarga.",
    ],
    notes: "31 páginas de obra; no se puede incrustar.",
  },
  "jazzbarisax.com": {
    hub: "http://jazzbarisax.com/new-transcriptions/",
    strategy: "pieces",
    access: "open",
    filePatterns: [],
    howToScrape: [
      "Páginas por transcripción con el vídeo de YouTube de la grabación.",
      "Se guarda el vídeo con URL de embed (nunca un canal): youtube-nocookie.com/embed/<id>.",
    ],
    notes: "Colección centrada en barítono: 7 vídeos incrustados.",
  },
  "ousaxstudio.weebly.com": {
    hub: "https://ousaxstudio.weebly.com/sample-transcriptions.html",
    strategy: "pieces",
    access: "open",
    filePatterns: ["*.pdf"],
    howToScrape: [
      "Weebly: los PDF cuelgan de la propia página de transcripción.",
      "Páginas de interés: /sample-transcriptions.html, /repertoire.html, /tunes-to-know.html.",
    ],
    notes: "Transcripciones de ejemplo del estudio de la Ohio University.",
  },
  "sharpelevenmusic.com": {
    hub: "https://sharpelevenmusic.com/saxophone-transcriptions",
    strategy: "pieces",
    access: "gated",
    filePatterns: [],
    howToScrape: [
      "Su catálogo va por suscripción: el HTML no expone los PDF.",
      "Se guardan las piezas apuntando a la página para abrirlas allí.",
    ],
    notes: "4 piezas de tu lista resueltas como página (contenido de pago).",
  },
  "jazzsaxophonelessons.com": {
    hub: "https://www.jazzsaxophonelessons.com/free-downloads/",
    strategy: "pieces",
    access: "open",
    filePatterns: ["*.pdf"],
    howToScrape: [
      "Recorre /free-downloads/ y las páginas con 'transcription' en la URL.",
      "Los PDF son enlaces directos de la página.",
    ],
    notes: "Solos transcritos de regalo.",
  },
  "tamingthesaxophone.com": {
    hub: "https://tamingthesaxophone.com/saxophone/players/blues-transcriptions",
    strategy: "pieces",
    access: "open",
    filePatterns: ["*.pdf"],
    howToScrape: [
      "Páginas de solos de blues con PDF y lección escrita.",
      "No permite el iframe: la ficha abre la página (o el PDF directo si lo hay).",
    ],
    notes: "Guías largas: útiles como método, no solo como partituras.",
  },
  "latouchemusicale.com": {
    hub: "https://latouchemusicale.com/es/partituras-saxofon/",
    strategy: "hub",
    access: "open",
    filePatterns: [],
    howToScrape: [
      "Blog con partituras por nivel; el PDF se pide desde su propia página.",
      "No permite el iframe: se abre fuera.",
    ],
    notes: "Recurso en español, útil para empezar.",
  },
  "pepperadams.com": {
    hub: "https://pepperadams.com/",
    strategy: "hub",
    access: "open",
    filePatterns: [],
    howToScrape: ["Página oficial del baritonista: transcripciones y artículos sueltos."],
    notes: "Referencia histórica del barítono.",
  },
  "randyhunterjazz.com": {
    hub: "https://randyhunterjazz.com/",
    strategy: "hub",
    access: "open",
    filePatterns: [],
    howToScrape: ["Recursos y clases de saxo jazz; PDFs sueltos enlazados desde sus páginas."],
    notes: "",
  },
  "saxschoolonline.com": {
    hub: "https://saxschoolonline.com/",
    strategy: "hub",
    access: "open",
    filePatterns: [],
    howToScrape: ["Escuela online: recursos de práctica (mayoría tras registro)."],
    notes: "Contenido mayormente con cuenta.",
  },
  "dansr.com": {
    hub: "https://www.dansr.com/",
    strategy: "hub",
    access: "open",
    filePatterns: [],
    howToScrape: ["Material de Vandoren/D'Addario: ejercicios y boquillas."],
    notes: "",
  },
  "selmer.fr": {
    hub: "https://www.selmer.fr/",
    strategy: "hub",
    access: "open",
    filePatterns: [],
    howToScrape: ["Recursos del fabricante (digitaciones, mantenimiento)."],
    notes: "",
  },
  "yamaha.com": {
    hub: "https://www.yamaha.com/",
    strategy: "hub",
    access: "open",
    filePatterns: [],
    howToScrape: ["Manuales y guías de la marca."],
    notes: "",
  },
};

/** Perfil genérico para dominios que no están en la tabla. */
export const DEFAULT_PROFILE = {
  hub: "",
  strategy: "hub",
  access: "open",
  filePatterns: [],
  howToScrape: ["Se visitan las páginas listadas y se guardan los ficheros enlazados (PDF, imagen o vídeo)."],
  notes: "",
};

export const profileFor = (host) => SOURCE_PROFILES[host] ?? DEFAULT_PROFILE;
