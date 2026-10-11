# Saxophone PDF Reader

A web app that helps musicians find, view, and download freely accessible PDF
resources about the saxophone. The catalog ships with real, publicly reachable
PDFs and viewer pages: historical method books, studies, technique exercises,
fingering charts, instrument maintenance guides, and sheet music.

> The app never stores or redistributes the PDFs itself. Every resource links to
> its original source (IMSLP, Internet Archive, manufacturers, community
> projects) so copyright status and licensing are always respected.

---

## How it works

1. **Catalog** – A searchable, filterable grid of saxophone PDF resources.
   Each card shows the title, description, license note, and instrument for
   solo transcriptions.
2. **View** – Click **👁️ Ver** on any resource to open the viewer **inside the
   same page** (no navigation away). The resource loads in an `<iframe>` so
   you can read the PDF or score without leaving the app.
3. **Download** – A direct link to the `.pdf` file kicks off a browser download.
4. **Cerrar** – The viewer has a close button (✕) to go back to the catalog.

Each card shows title, description, and the copyright/license note, so the
user can check the rights before using the material.

---

## Tech stack (the "skills" required)

| Area | Technology | Why |
| --- | --- | --- |
| Framework | [React 19](https://react.dev) | Component UI, state/local routing |
| Build | [Vite 8](https://vite.dev) | Fast dev server + production bundle |
| Language | TypeScript 6 | Type-safe props, config, and data shapes |
| Styling | Plain CSS (CSS variables) | No extra dependency; themeable via :root tokens |
| Data | Local TypeScript catalog | Curated `SaxophonePdfResource[]` list, CATEGORIES, pagination |
| Icons | Emoji | Zero-dependency inline icons |

The stack is deliberately small so the app stays easy to run, extend, and
host. Everything is compiled to a static site (see `dist/` after `npm run build`).

### To run locally

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm run build      # produces dist/ (typecheck + bundle)
npm run preview    # preview the production build
```

### To deploy

The output is static and can be dropped on any static host (GitHub Pages,
Netlify, Vercel, Cloudflare Pages, an S3 bucket, etc.). If you use
[Freebuff Sites](https://freebuff.com), add a Worker that serves `dist/` as
assets and proxy the SPA fallback.

---

## The "skills" (competencies) for this project

Building this app requires a mix of technical, musical, and legal competencies:

1. **Frontend engineering** – React + Vite + TypeScript to render the catalog
   and PDF viewers reliably.
2. **Web security / privacy** – The app keeps all viewing inside the page: when
   you click **👁️ Ver**, the resource loads in an `<iframe>` within the
   viewer (the iframe is sandboxed and only same-origin resources are
   embedded). External tools are opened only in a new tab via
   `rel="noopener noreferrer"` to avoid tab-nabbing and data leakage.
3. **Legal / licensing awareness** – Surfacing copyright status on every card
   and warning users to check the source's license before use, rather than
   assuming public domain.
4. **Musical literacy** – Presenting the resources in sensible groups
   (methods, studies, technique, fingering, maintenance, sheet music) so
   users can find what they need.
5. **Responsive design** – A grid that works on mobile (where many
   saxophone students access material) and desktop.
6. **Documentation / onboarding** – Clear run instructions and a plain-language
   explanation of what the app does and does not do.

---

## Curated resources (example entries)

| Category | Title | View | Download |
| --- | --- | --- | --- |
| Method | Universal Method for the Saxophone (de Ville) | \[\] | \[\] |
| Studies | 25 Exercices journaliers (Klosé) | \[\] | \[\] |
| Technique | Long-Tones for Saxophone (Randy Hunter) | \[\] | \[\] |
| Fingering | McGill Sax School fingering chart | \[\] | \[\] |
| Sheet music | IMSLP: works for saxophone | \[\] | \[\] |

The full list is in `src/catalog.ts` with `viewUrl` (for the viewer) and
`downloadUrl` (for the PDF download) per resource.

---

## Project structure

```
saxo-reader/
├── index.html
├── public/
│   └── saxophone.svg
├── src/
│   ├── catalog.ts      # resource data, categories, pagination
│   ├── App.tsx         # routing between catalog + viewer
│   ├── index.css       # global styles + CSS variables
│   ├── main.tsx        # entry point
│   └── vite-env.d.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Notes on the resources

* Historical method books (de Ville, Mayeur, Klosé) are **public domain** on
  IMSLP/Internet Archive.
* Modern method books are often **still copyrighted**; none were included as
  free PDFs.
* Manufacturer guides (SELMER, Yamaha) are web articles, not PDFs — the app
  links to them rather than fabricating a download link.
* Copyrights vary by jurisdiction for many IMSLP works; the app always
  surfaces the source's own license note instead of asserting a status.

---

## Limitations

* The PDF viewers are the sources' own embedders (IMSLP/Internet Archive),
  which are sometimes slow; a local PDF library (e.g. PDF.js) could be added
  later for offline reading.
* Direct download URLs for some sources (mostly manufacturer web articles)
  are best-effort; the "Ver" action always works because the source page is
  reliable.

---

*Built with Vite + React + TypeScript.*
