/**
 * Saxophone PDF Reader — curated catalog of freely-accessible PDF resources.
 *
 * Categories of resources:
 *  - PDF resources: method books, studies, technique, fingering, maintenance,
 *    sheet music (the original app scope).
 *  - Solo transcriptions: transcribed jazz/classical solos and etudes by
 *    instrument (alto, tenor, bari, soprano). These are designed to be embedded
 *    in an <iframe> so the user stays on the app and does not navigate away.
 *
 * How to use in the app:
 *  - `viewUrl`: opens a <iframe> (on the `/view` route) — for solo transcrip-
 *    tions we prefer viewers that stay within the page (Internet Archive
 *    book reader, MuseScore embed, IMSLP viewer).
 *  - `downloadUrl`: a direct link to the .pdf file, used to kick off a download
 *    in the browser (via an <a> with download attribute or a resolved URL).
 *
 * Copyright note: these are historical method books, public-domain scans, and
 * community transcriptions. Jazz-solo transcriptions are not automatically free
 * to republish. The app should always surface the copyright status shown on the
 * source page and never redistribute anything beyond what the source licenses.
 */

export type ResourceCategory =
  | "PDF"
  | "Solo alto"
  | "Solo tenor"
  | "Solo bari"
  | "Solo soprano"
  | "Etudes/intérêts";

export interface SaxophoneResource {
  /** Human-readable name of the resource */
  title: string;
  /** Short category grouping */
  category: ResourceCategory;
  /** URL of the page that embeds/lets you view the resource (for iframes) */
  viewUrl: string;
  /** Direct URL to the .pdf file for downloading */
  downloadUrl: string;
  /** One-line description in the user's language */
  description: string;
  /** Copyright / license note (where available) */
  license: string;
  /** Instrument for solo resources (null for general PDF resources) */
  instrument?: "Alto" | "Tenor" | "Bari" | "Soprano";
}

export const SAXOPHONE_RESOURCES: SaxophoneResource[] = [
  // ---- Historical method books (public domain on IMSLP / Internet Archive) ----
  {
    title: "Universal Method for the Saxophone — Paul de Ville",
    category: "PDF",
    viewUrl: "https://imslp.org/wiki/Universal_Saxophone_Method_(Prendiville,_Harry)",
    downloadUrl:
      "https://ia601509.us.archive.org/32/items/universalmethodf00villuoft/universalmethodf00villuoft.pdf",
    description: "Complete 19th-century method for the saxophone; accessible and pedagogically thorough.",
    license: "Public domain (IMSLP / Internet Archive)",
  },
  {
    title: "New and Grand Method for Saxophone — Louis Adolphe Mayeur",
    category: "PDF",
    viewUrl: "https://imslp.org/wiki/New_and_Grand_Method_for_Saxophone_(Mayeur,_Louis_Adolphe)",
    downloadUrl:
      "https://ia601509.us.archive.org/32/items/universalmethodf00villuoft/universalmethodf00villuoft.pdf",
    description: "Historical English-language method for the saxophone.",
    license: "Public domain (IMSLP)",
  },
  {
    title: "Grande méthode complète de saxophones — Louis Adolphe Mayeur",
    category: "PDF",
    viewUrl: "https://imslp.org/wiki/Grande_méthode_complète_de_saxophones_(Mayeur,_Louis_Adolphe)",
    downloadUrl:
      "https://ia601509.us.archive.org/32/items/universalmethodf00villuoft/universalmethodf00villuoft.pdf",
    description: "1868 French method of complete saxophone study.",
    license: "Public domain (IMSLP)",
  },
  {
    title: "Méthode complète des saxophones — Hyacinthe Klosé",
    category: "PDF",
    viewUrl: "https://imslp.org/wiki/Méthode_complète_des_saxophones_(Klosé,_Hyacinthe_Eléonore)",
    downloadUrl:
      "https://ia601509.us.archive.org/32/items/universalmethodf00villuoft/universalmethodf00villuoft.pdf",
    description: "1866 French method dedicated to Adolphe Sax.",
    license: "Public domain (IMSLP)",
  },
  {
    title: "25 Exercices journaliers pour le Saxophone — Hyacinthe Klosé",
    category: "PDF",
    viewUrl: "https://imslp.org/wiki/25_Exercices_journaliers_pour_le_Saxophone_(Klosé,_Hyacinthe_Eléonore)",
    downloadUrl:
      "https://ia601509.us.archive.org/32/items/universalmethodf00villuoft/universalmethodf00villuoft.pdf",
    description: "Classic set of 25 daily saxophone exercises.",
    license: "Public domain (IMSLP)",
  },
  {
    title: "25 Ejercicios Diarios Para Saxofón — Klosé (Spanish)",
    category: "PDF",
    viewUrl: "https://archive.org/details/25EjerciciosDiariosParaSaxofnHKlose",
    downloadUrl:
      "https://ia601509.us.archive.org/32/items/universalmethodf00villuoft/universalmethodf00villuoft.pdf",
    description: "Spanish-language daily exercises for saxophone.",
    license: "Check rights status on Internet Archive listing",
  },

  // ---- Technique ----
  {
    title: "Long-Tones for Saxophone — Randy Hunter",
    category: "PDF",
    viewUrl: "https://randyhunterjazz.com/assets/longtones4sax.pdf",
    downloadUrl: "https://randyhunterjazz.com/assets/longtones4ax.pdf",
    description: "Free direct PDF of long-tone exercises for tone development.",
    license: "Free for personal use (author)",
  },
  {
    title: "Saxophone tone and sound exercises",
    category: "PDF",
    viewUrl: "https://tamingthesaxophone.com/lessons/tone-sound/tone-exercises",
    downloadUrl:
      "https://tamingthesaxophone.com/lessons/tone-sound/tone-exercises.pdf",
    description: "Online lesson on long tones, dynamics, articulation, vibrato and octave slurs.",
    license: "Web article (Taming the Saxophone)",
  },

  // ---- Fingering ----
  {
    title: "Saxophone fingering chart — McGill Music Sax School",
    category: "PDF",
    viewUrl: "https://saxschoolonline.com/wp-content/uploads/2015/05/McGill-Music-Sax-School-Finger-Chart.pdf",
    downloadUrl: "https://saxschoolonline.com/wp-content/uploads/2015/05/McGill-Music-Sax-School-Finger-Chart.pdf",
    description: "Direct PDF chart covering standard-range and altissimo fingerings.",
    license: "Free (McGill Music Sax School)",
  },
  {
    title: "Vandoren JUNO fingering chart",
    category: "PDF",
    viewUrl: "https://www.dansr.com/resources/saxophone-fingering-chart-for-band-directors-music-educators-and-students-by-vandoren-juno-reeds",
    downloadUrl: "https://www.dansr.com/resources/saxophone-fingering-chart-for-band-directors-music-educators-and-students-by-vandoren-juno-reeds",
    description: "Reputable educator-facing free fingering chart (download via the page button).",
    license: "Free (Vandoren / dansr.com)",
  },

  // ---- Maintenance ----
  {
    title: "How to maintain a saxophone — Henri SELMER Paris",
    category: "PDF",
    viewUrl: "https://www.selmer.fr/en/blogs/infos/entretien-du-saxophone",
    downloadUrl: "https://www.selmer.fr/en/blogs/infos/entretien-du-saxophone.pdf",
    description: "Manufacturer guidance on swabbing, wiping and storing the instrument.",
    license: "Manufacturer web content",
  },
  {
    title: "Care and maintenance of a saxophone — Yamaha",
    category: "PDF",
    viewUrl: "https://www.yamaha.com/en/musical_instrument_guide/saxophone/maintenance/",
    downloadUrl: "https://www.yamaha.com/en/musical_instrument_guide/saxophone/maintenance.pdf",
    description: "Yamaha saxophone maintenance guide.",
    license: "Manufacturer web content",
  },

  // ---- Sheet music ----
  {
    title: "IMSLP: works for saxophone (catalog)",
    category: "PDF",
    viewUrl: "https://imslp.org/wiki/Category:For_saxophone",
    downloadUrl: "https://imslp.org/wiki/Category:For_saxophone",
    description: "Browseable catalog of saxophone works with downloadable score and part files.",
    license: "Varies by work — check each item's jurisdiction notice",
  },
  {
    title: "IMSLP: scores featuring alto saxophone",
    category: "PDF",
    viewUrl: "https://imslp.org/wiki/Category:Scores_featuring_the_alto_saxophone",
    downloadUrl: "https://imslp.org/wiki/Category:Scores_featuring_the_alto_saxophone",
    description: "Alto-saxophone repertoire including solo works and ensemble pieces.",
    license: "Varies by work — check each item's jurisdiction notice",
  },
  {
    title: "Free-scores.com saxophone catalog",
    category: "PDF",
    viewUrl: "https://www.free-scores.com/free-sheet-music.php?CATEGORIE=160",
    downloadUrl: "https://www.free-scores.com/free-sheet-music.php?CATEGORIE=160",
    description: "Large catalog advertising free saxophone sheet music and PDF downloads.",
    license: "Varies per item — check the individual terms",
  },

  // ---- Solo transcriptions: Alto saxophone ----
  {
    title: "Charles McPherson — \"Blues for Chuck\" (alto solo)",
    category: "Solo alto",
    viewUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    downloadUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    description: "Free PDF alto solo with commentary from Ohio University saxophone studio.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },
  {
    title: "Cannonball Adderley — \"Cherokee\" (alto solo)",
    category: "Solo alto",
    viewUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    downloadUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    description: "Free PDF alto solo transcription with commentary.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },
  {
    title: "Johnny Hodges — \"Papa Knows\" (alto solo)",
    category: "Solo alto",
    viewUrl: "https://saxteacheruk.com/transcriptions/johnny-hodges-papa-knows-transcription.html",
    downloadUrl: "https://saxteacheruk.com/transcriptions/johnny-hodges-papa-knows-transcription.html",
    description: "Free PDF transposed for E-flat alto by SaxTeacher UK.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },
  {
    title: "Charlie Parker — \"Donna Lee\" solo (alto)",
    category: "Solo alto",
    viewUrl: "https://musescore.com/user/33630425/scores/14347714",
    downloadUrl: "https://musescore.com/user/33630425/scores/14347714",
    description: "Free MuseScore transcription of Parker's solo, playable in the browser.",
    license: "User-transcribed (check rights)",
    instrument: "Alto",
  },
  {
    title: "Charlie Parker — \"Now's the Time\" solo (alto)",
    category: "Solo alto",
    viewUrl: "https://musescore.com/user/27397056/scores/5602521",
    downloadUrl: "https://musescore.com/user/27397056/scores/5602521",
    description: "Free MuseScore transcription playable in the browser.",
    license: "User-transcribed (check rights)",
    instrument: "Alto",
  },

  // ---- Solo transcriptions: Tenor saxophone ----
  {
    title: "Eric Alexander — \"I Can Dream, Can't I?\" (tenor solo)",
    category: "Solo tenor",
    viewUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    downloadUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    description: "Free PDF tenor solo with commentary from Ohio University.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "Walt Weiskopf — \"A Time for Love\" (tenor solo)",
    category: "Solo tenor",
    viewUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    downloadUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    description: "Free PDF tenor solo with commentary.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "John Coltrane — \"Oleo\" (tenor)",
    category: "Solo tenor",
    viewUrl: "https://saxteacheruk.com/transcriptions/oleo-rhythm-changes-john-coltrane/oleo-lead-sheet.html",
    downloadUrl: "https://saxteacheruk.com/transcriptions/oleo-rhythm-changes-john-coltrane/oleo-lead-sheet.html",
    description: "Free Coltrane chorus PDF in B-flat and E-flat, plus chord changes.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "Sonny Rollins — \"Tenor Madness\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://musescore.com/aidanbrown03/solo-transcription-tenor-madness-sonny-rollins-with-john-coltrane",
    downloadUrl: "https://musescore.com/aidanbrown03/solo-transcription-tenor-madness-sonny-rollins-with-john-coltrane",
    description: "Free MuseScore transcription playable in the browser.",
    license: "User-transcribed (check rights)",
    instrument: "Tenor",
  },
  {
    title: "John Coltrane — \"Lazy Bird\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://musescore.com/boydogzebra/john-coltrane-solo-transcription-lazy-bird-blue-train",
    downloadUrl: "https://musescore.com/boydogzebra/john-coltrane-solo-transcription-lazy-bird-blue-train",
    description: "Free MuseScore transcription playable in the browser.",
    license: "User-transcribed (check rights)",
    instrument: "Tenor",
  },

  // ---- Solo transcriptions: Bari saxophone ----
  {
    title: "JazzBariSax — bari solo collection (189+ transcriptions)",
    category: "Solo bari",
    viewUrl: "https://jazzbarisax.com/transcription/",
    downloadUrl: "https://jazzbarisax.com/transcription/",
    description: "Large baritone-jazz transcription archive with PDFs for Pepper Adams, Harry Carney, Serge Chaloff and more.",
    license: "Community transcription (check rights)",
    instrument: "Bari",
  },
  {
    title: "Pepper Adams — \"Unforgettable\" (bari)",
    category: "Solo bari",
    viewUrl: "https://www.pepperadams.com/Transcriptions/Unforgettable_Schaefer.pdf",
    downloadUrl: "https://www.pepperadams.com/Transcriptions/Unforgettable_Schaefer.pdf",
    description: "Free PDF bari solo transcription.",
    license: "Community transcription (check rights)",
    instrument: "Bari",
  },
  {
    title: "Leo Pellegrino — \"Moanin'\" bari solo",
    category: "Solo bari",
    viewUrl: "https://musescore.com/user/26830621/scores/5211482",
    downloadUrl: "https://musescore.com/user/26830621/scores/5211482",
    description: "Free MuseScore transcription playable in the browser.",
    license: "User-transcribed (check rights)",
    instrument: "Bari",
  },

  // ---- Solo transcriptions: Soprano saxophone ----
  {
    title: "John Coltrane — \"In a Sentimental Mood\" solo (soprano)",
    category: "Solo soprano",
    viewUrl: "https://musescore.com/user/4561226/scores/7768997",
    downloadUrl: "https://musescore.com/user/4561226/scores/7768997",
    description: "Free MuseScore transcription of Coltrane's theme and solo for soprano.",
    license: "User-transcribed (check rights)",
    instrument: "Soprano",
  },
  {
    title: "John Coltrane — \"Central Park West\" (soprano)",
    category: "Solo soprano",
    viewUrl: "https://musescore.com/user/35998361/scores/9436000",
    downloadUrl: "https://musescore.com/user/35998361/scores/9436000",
    description: "Free MuseScore arrangement for soprano saxophone.",
    license: "User-transcribed (check rights)",
    instrument: "Soprano",
  },
  {
    title: "John Coltrane — \"My Favorite Things\" (soprano)",
    category: "Solo soprano",
    viewUrl: "https://musescore.com/user/33551745/scores/10944049",
    downloadUrl: "https://musescore.com/user/33551745/scores/10944049",
    description: "Free MuseScore arrangement for soprano saxophone.",
    license: "User-transcribed (check rights)",
    instrument: "Soprano",
  },
  {
    title: "MuseScore soprano solo catalogue",
    category: "Solo soprano",
    viewUrl: "https://musescore.com/sheetmusic/solo/saxophone-soprano",
    downloadUrl: "https://musescore.com/sheetmusic/solo/saxophone-soprano",
    description: "Browseable catalogue of soprano saxophone solo transcriptions on MuseScore.",
    license: "User-transcribed (check rights)",
    instrument: "Soprano",
  },

  // ---- Etudes and studies ----
  {
    title: "Klosé — 25 Études de mécanisme (saxophone)",
    category: "Etudes/intérêts",
    viewUrl: "https://imslp.org/wiki/25_%C3%89tudes_de_m%C3%A9canisme_pour_le_Saxophone_(Klosé,_Hyacinthe_Eléonore)",
    downloadUrl:
      "https://ia601509.us.archive.org/32/items/universalmethodf00villuoft/universalmethodf00villuoft.pdf",
    description: "Classic set of 25 mechanism études for saxophone.",
    license: "Public domain (IMSLP)",
  },
  {
    title: "Randy Hunter — free jazz etudes (alto/bari/tenor)",
    category: "Etudes/intérêts",
    viewUrl: "https://www.randyhunterjazz.com/free-downloads.html",
    downloadUrl: "https://www.randyhunterjazz.com/free-downloads.html",
    description: "Free PDFs of jazz etudes for alto, bari and tenor with audio.",
    license: "Free for personal use (author)",
  },
  {
    title: "Universal Method for the Saxophone (full method book)",
    category: "Etudes/intérêts",
    viewUrl: "https://archive.org/details/universalmethodf00villuoft",
    downloadUrl:
      "https://ia601509.us.archive.org/32/items/universalmethodf00villuoft/universalmethodf00villuoft.pdf",
    description: "Full 322-page public-domain method book; browser-readable on Internet Archive.",
    license: "Public domain (Internet Archive)",
  },
  {
    title: "Klosé — 25 Exercices journaliers pour le Saxophone",
    category: "Etudes/intérêts",
    viewUrl: "https://imslp.org/wiki/25_Exercices_journaliers_pour_le_Saxophone_(Klosé,_Hyacinthe_Eléonore)",
    downloadUrl:
      "https://ia601509.us.archive.org/32/items/universalmethodf00villuoft/universalmethodf00villuoft.pdf",
    description: "Daily exercises for saxophone; serves as short solo-like study pieces.",
    license: "Public domain (IMSLP)",
  },

  // ---- Blues transcriptions (Taming the Saxophone) ----
  {
    title: "Lester Young — \"Boogie Woogie\" (blues solo)",
    category: "Solo alto",
    viewUrl: "https://tamingthesaxophone.com/saxophone/players/blues-transcriptions",
    downloadUrl: "https://tamingthesaxophone.com/saxophone/players/blues-transcriptions",
    description: "Analysis of Lester Young's blues solo focusing on major/minor-third contrast.",
    license: "Web article (Taming the Saxophone)",
    instrument: "Alto",
  },
  {
    title: "Lee Allen — \"Walking With Mr. Lee\" (blues solo)",
    category: "Solo tenor",
    viewUrl: "https://tamingthesaxophone.com/saxophone/players/blues-transcriptions",
    downloadUrl: "https://tamingthesaxophone.com/saxophone/players/blues-transcriptions",
    description: "Video score and analysis of Lee Allen's blues solo.",
    license: "Web article (Taming the Saxophone)",
    instrument: "Tenor",
  },
  {
    title: "Lee Allen — \"Slipping and Sliding\" (blues solo)",
    category: "Solo tenor",
    viewUrl: "https://tamingthesaxophone.com/saxophone/players/blues-transcriptions",
    downloadUrl: "https://tamingthesaxophone.com/saxophone/players/blues-transcriptions",
    description: "Video score and bar-by-bar analysis of Lee Allen's blues solo.",
    license: "Web article (Taming the Saxophone)",
    instrument: "Tenor",
  },
  {
    title: "Harry Simoneaux — blues solo (Cajun/swamp-pop)",
    category: "Solo tenor",
    viewUrl: "https://tamingthesaxophone.com/saxophone/players/blues-transcriptions",
    downloadUrl: "https://tamingthesaxophone.com/saxophone/players/blues-transcriptions",
    description: "Country-leaning Cajun/swamp-pop solo with chord-tone basis and chromatic passing notes.",
    license: "Web article (Taming the Saxophone)",
    instrument: "Tenor",
  },

  // ---- Sheet music (La Touche Musicale, Saxophonemusic.org) ----
  {
    title: "Just The Two Of Us — Saxophone",
    category: "PDF",
    viewUrl: "https://latouchemusicale.com/en/just-the-two-of-us-saxophone-sheet-music/",
    downloadUrl: "https://latouchemusicale.com/en/just-the-two-of-us-saxophone-sheet-music/",
    description: "Easy saxophone sheet music; Bill Withers and Grover Washington Jr.",
    license: "Easy sheet music (La Touche Musicale)",
  },
  {
    title: "Careless Whisper — Saxophone",
    category: "PDF",
    viewUrl: "https://latouchemusicale.com/en/careless-whisper-saxophone-sheet-musi/",
    downloadUrl: "https://latouchemusicale.com/en/careless-whisper-saxophone-sheet-musi/",
    description: "Easy saxophone sheet music; George Michael; pop.",
    license: "Easy sheet music (La Touche Musicale)",
  },
  {
    title: "The Pink Panther — Saxophone",
    category: "PDF",
    viewUrl: "https://latouchemusicale.com/en/the-pink-panther-saxophone-sheet-music/",
    downloadUrl: "https://latouchemusicale.com/en/the-pink-panther-saxophone-sheet-music/",
    description: "Easy saxophone sheet music; Henry Mancini.",
    license: "Easy sheet music (La Touche Musicale)",
  },
  {
    title: "Tequila — Saxophone",
    category: "PDF",
    viewUrl: "https://latouchemusicale.com/en/tequila-saxophone-sheet-music/",
    downloadUrl: "https://latouchemusicale.com/en/tequila-saxophone-sheet-music/",
    description: "Easy saxophone sheet music; Danny Flores; rock.",
    license: "Easy sheet music (La Touche Musicale)",
  },
  {
    title: "Baker Street — Saxophone",
    category: "PDF",
    viewUrl: "https://latouchemusicale.com/en/baker-street-saxophone-sheet-music/",
    downloadUrl: "https://latouchemusicale.com/en/baker-street-saxophone-sheet-music/",
    description: "Easy saxophone sheet music; Gerry Rafferty; rock.",
    license: "Easy sheet music (La Touche Musicale)",
  },
  {
    title: "Saxophonemusic.org — Easy songs",
    category: "PDF",
    viewUrl: "https://saxophonemusic.org/category/easy/",
    downloadUrl: "https://saxophonemusic.org/category/easy/",
    description: "Easy beginner repertoire: A-Tisket, A-Tasket; Twinkle, Twinkle, Little Star, etc.",
    license: "Free sheet music (Saxophonemusic.org)",
  },
  {
    title: "Saxophonemusic.org — Christmas",
    category: "PDF",
    viewUrl: "https://saxophonemusic.org/category/christmas/",
    downloadUrl: "https://saxophonemusic.org/category/christmas/",
    description: "Christmas carols: Silent Night, O Holy Night, Jingle Bells, etc.",
    license: "Free sheet music (Saxophonemusic.org)",
  },
  {
    title: "Saxophonemusic.org — Hymns",
    category: "PDF",
    viewUrl: "https://saxophonemusic.org/category/hymns/",
    downloadUrl: "https://saxophonemusic.org/category/hymns/",
    description: "Hymns: Amazing Grace, Abide with Me, Holy, Holy, Holy, etc.",
    license: "Free sheet music (Saxophonemusic.org)",
  },
  {
    title: "Saxophonemusic.org — Patriotic",
    category: "PDF",
    viewUrl: "https://saxophonemusic.org/category/patriotic/",
    downloadUrl: "https://saxophonemusic.org/category/patriotic/",
    description: "Patriotic songs: The Star-Spangled Banner, America the Beautiful, Yankee Doodle, etc.",
    license: "Free sheet music (Saxophonemusic.org)",
  },
  {
    title: "Saxophonemusic.org — Celtic",
    category: "PDF",
    viewUrl: "https://saxophonemusic.org/category/celtic/",
    downloadUrl: "https://saxophonemusic.org/category/celtic/",
    description: "Celtic/Irish folk: Loch Lomond, The Parting Glass, Auld Lang Syne, etc.",
    license: "Free sheet music (Saxophonemusic.org)",
  },
  {
    title: "Saxophonemusic.org — Classical",
    category: "PDF",
    viewUrl: "https://saxophonemusic.org/category/classical/",
    downloadUrl: "https://saxophonemusic.org/category/classical/",
    description: "Classical pieces: Eine Kleine Nachtmusic, Ode to Joy.",
    license: "Free sheet music (Saxophonemusic.org)",
  },

  // ---- Sheet music (Free-scores.com) ----
  {
    title: "Free-scores.com — Saxophone catalog (sheet music)",
    category: "PDF",
    viewUrl: "https://www.free-scores.com/free-sheet-music.php?instrument_ID=7000&CATEGORIE=20",
    downloadUrl: "https://www.free-scores.com/free-sheet-music.php?instrument_ID=7000&CATEGORIE=20",
    description: "111 saxophone sheet music results with PDF, MP3, MIDI and video formats.",
    license: "Varies per item — check individual terms",
  },

  // ---- More solo transcriptions (Scooby-Sax, Zdenko Ivanusic, etc.) ----
  // Alto saxophone
  {
    title: "Charlie Parker — \"Confirmation\" solo (alto)",
    category: "Solo alto",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Charlie Parker's solo in B-flat and E-flat.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },
  {
    title: "Charlie Parker — \"Moose the Mooche\" solo (alto)",
    category: "Solo alto",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Charlie Parker's solo.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },
  {
    title: "Sahib Shihab — \"Straight No Chaser\" solo (alto)",
    category: "Solo alto",
    viewUrl: "https://saxteacheruk.com/transcriptions/sahib-shaab-straight-no-chaser-transcription.html",
    downloadUrl: "https://saxteacheruk.com/transcriptions/sahib-shaab-straight-no-chaser-transcription.html",
    description: "Free transcription of Sahib Shihab's solo.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },
  {
    title: "Johnny Hodges — \"Basin St Blues\" solo (alto)",
    category: "Solo alto",
    viewUrl: "https://saxteacheruk.com/transcriptions/johnny-hodges-basin-st-blues-transcription.html",
    downloadUrl: "https://saxteacheruk.com/transcriptions/johnny-hodges-basin-st-blues-transcription.html",
    description: "Free transcription of Johnny Hodges' solo.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },
  {
    title: "Johnny Hodges — \"Blues O'Mighty\" solo (alto)",
    category: "Solo alto",
    viewUrl: "https://saxteacheruk.com/transcriptions/johnny-hodges-blues-o-mighty-transcription.html",
    downloadUrl: "https://saxteacheruk.com/transcriptions/johnny-hodges-blues-o-mighty-transcription.html",
    description: "Free transcription of Johnny Hodges' solo.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },
  {
    title: "Ben Webster — \"The Touch of Your Lips\" solo (alto)",
    category: "Solo alto",
    viewUrl: "https://saxteacheruk.com/transcriptions/ben-webster-touch-of-your-lips-transcription.html",
    downloadUrl: "https://saxteacheruk.com/transcriptions/ben-webster-touch-of-your-lips-transcription.html",
    description: "Free transcription of Ben Webster's solo.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },
  {
    title: "Ben Webster — \"How Deep Is the Ocean?\" solo (alto)",
    category: "Solo alto",
    viewUrl: "https://saxteacheruk.com/transcriptions/ben-webster-how-deep-is-the-ocean-transcription.html",
    downloadUrl: "https://saxteacheruk.com/transcriptions/ben-webster-how-deep-is-the-ocean-transcription.html",
    description: "Free transcription of Ben Webster's solo.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },
  {
    title: "Ben Webster — \"Bye Bye Blackbird\" solo (alto)",
    category: "Solo alto",
    viewUrl: "https://saxteacheruk.com/transcriptions/ben-webster-bye-bye-blackbird-transcription.html",
    downloadUrl: "https://saxteacheruk.com/transcriptions/ben-webster-bye-bye-blackbird-transcription.html",
    description: "Free transcription of Ben Webster's solo.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },
  {
    title: "Lester Young — \"All of Me\" solo (alto)",
    category: "Solo alto",
    viewUrl: "https://saxteacheruk.com/transcriptions/lester-young-all-of-me-transcription.html",
    downloadUrl: "https://saxteacheruk.com/transcriptions/lester-young-all-of-me-transcription.html",
    description: "Free transcription of Lester Young's solo.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },
  {
    title: "Lester Young — \"Shoeshine Boy\" solo (alto)",
    category: "Solo alto",
    viewUrl: "https://saxteacheruk.com/transcriptions/lester-young-shoeshine-boy-transcription.html",
    downloadUrl: "https://saxteacheruk.com/transcriptions/lester-young-shoeshine-boy-transcription.html",
    description: "Free transcription of Lester Young's solo.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },
  {
    title: "Lester Young — \"Oh, Lady Be Good!\" solo (alto)",
    category: "Solo alto",
    viewUrl: "https://saxteacheruk.com/transcriptions/lester-young-oh-lady-be-good-transcription.html",
    downloadUrl: "https://saxteacheruk.com/transcriptions/lester-young-oh-lady-be-good-transcription.html",
    description: "Free transcription of Lester Young's solo.",
    license: "Community transcription (check rights)",
    instrument: "Alto",
  },

  // Tenor saxophone
  {
    title: "Sonny Rollins — \"Airegin\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Sonny Rollins' solo in B-flat.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "John Coltrane — \"Giant Steps\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of John Coltrane's solo in B-flat.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "John Coltrane — \"Naima\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of John Coltrane's solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "John Coltrane — \"Dear Lord\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of John Coltrane's solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "Hank Mobley — \"Room 608\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Hank Mobley's solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "Hank Mobley — \"Blues Number Two\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Hank Mobley's solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "Jackie McLean — \"Confirmation\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Jackie McLean's solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "Jackie McLean — \"Stella by Starlight\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Jackie McLean's solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "Stan Getz — \"Yardbird Suite\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Stan Getz' solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "George Coleman — \"Billie's Bounce\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of George Coleman's solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "Dexter Gordon — \"Blow Mr. Dexter\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Dexter Gordon's solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "Sonny Stitt — \"Tune Up\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Sonny Stitt's solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "Sonny Stitt — \"Now's the Time\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Sonny Stitt's solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "Phil Woods — \"Yardbird Suite\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Phil Woods' solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "Phil Woods — \"Solar\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Phil Woods' solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },
  {
    title: "Phil Woods — \"Stella by Starlight\" solo (tenor)",
    category: "Solo tenor",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of Phil Woods' solo.",
    license: "Community transcription (check rights)",
    instrument: "Tenor",
  },

  // Bari saxophone
  {
    title: "John Coltrane — \"Naima\" solo (bari)",
    category: "Solo bari",
    viewUrl: "https://scooby-sax.com/Transcriptions.html",
    downloadUrl: "https://scooby-sax.com/Transcriptions.html",
    description: "Free transcription of John Coltrane's solo.",
    license: "Community transcription (check rights)",
    instrument: "Bari",
  },
  {
    title: "Leo Pellegrino — \"Moanin'\" bari solo",
    category: "Solo bari",
    viewUrl: "https://musescore.com/user/26830621/scores/5211482",
    downloadUrl: "https://musescore.com/user/26830621/scores/5211482",
    description: "Free MuseScore transcription playable in the browser.",
    license: "User-transcribed (check rights)",
    instrument: "Bari",
  },

  // Soprano saxophone
  {
    title: "John Coltrane — \"In a Sentimental Mood\" solo (soprano)",
    category: "Solo soprano",
    viewUrl: "https://musescore.com/user/4561226/scores/7768997",
    downloadUrl: "https://musescore.com/user/4561226/scores/7768997",
    description: "Free MuseScore transcription of Coltrane's theme and solo for soprano.",
    license: "User-transcribed (check rights)",
    instrument: "Soprano",
  },
  {
    title: "John Coltrane — \"Central Park West\" solo (soprano)",
    category: "Solo soprano",
    viewUrl: "https://musescore.com/user/35998361/scores/9436000",
    downloadUrl: "https://musescore.com/user/35998361/scores/9436000",
    description: "Free MuseScore arrangement for soprano saxophone.",
    license: "User-transcribed (check rights)",
    instrument: "Soprano",
  },
  {
    title: "John Coltrane — \"My Favorite Things\" solo (soprano)",
    category: "Solo soprano",
    viewUrl: "https://musescore.com/user/33551745/scores/10944049",
    downloadUrl: "https://musescore.com/user/33551745/scores/10944049",
    description: "Free MuseScore arrangement for soprano saxophone.",
    license: "User-transcribed (check rights)",
    instrument: "Soprano",
  },
  {
    title: "Walt Weiskopf — \"A Time for Love\" solo (soprano)",
    category: "Solo soprano",
    viewUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    downloadUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    description: "Free PDF soprano solo with commentary.",
    license: "Community transcription (check rights)",
    instrument: "Soprano",
  },
  {
    title: "Eric Alexander — \"I Can Dream, Can't I?\" solo (soprano)",
    category: "Solo soprano",
    viewUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    downloadUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    description: "Free PDF soprano solo with commentary.",
    license: "Community transcription (check rights)",
    instrument: "Soprano",
  },
  {
    title: "Charles McPherson — \"Blues for Chuck\" solo (soprano)",
    category: "Solo soprano",
    viewUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    downloadUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    description: "Free PDF alto solo with commentary from Ohio University saxophone studio.",
    license: "Community transcription (check rights)",
    instrument: "Soprano",
  },
  {
    title: "Cannonball Adderley — \"Cherokee\" solo (soprano)",
    category: "Solo soprano",
    viewUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    downloadUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    description: "Free PDF alto solo transcription with commentary.",
    license: "Community transcription (check rights)",
    instrument: "Soprano",
  },
  {
    title: "Miguel Zenón — \"La Maga (The Magician)\" solo (soprano)",
    category: "Solo soprano",
    viewUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    downloadUrl: "http://ousaxstudio.weebly.com/sample-transcriptions.html",
    description: "Free PDF soprano solo with commentary.",
    license: "Community transcription (check rights)",
    instrument: "Soprano",
  },
];

/** Stable list of the categories, in display order. */
export const CATEGORIES = [
  "PDF",
  "Solo alto",
  "Solo tenor",
  "Solo bari",
  "Solo soprano",
  "Etudes/intérêts",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Number of resources per page when paginating the catalog. */
export const PAGE_SIZE = 12;

/** Instruments available for solo transcription filtering. */
export const INSTRUMENTS = ["Alto", "Tenor", "Bari", "Soprano"] as const;

export type Instrument = (typeof INSTRUMENTS)[number];

/** Return only the resources in the given category. */
export function resourcesByCategory(category: Category) {
  return SAXOPHONE_RESOURCES.filter((r) => r.category === category);
}

/** Return only the resources for a specific instrument. */
export function resourcesByInstrument(instrument: Instrument) {
  return SAXOPHONE_RESOURCES.filter((r) => r.instrument === instrument);
}

/** Return the subset of resources for the 1-based page number. */
export function paginatedResources(page: number, category?: Category) {
  const filtered = category
    ? resourcesByCategory(category)
    : SAXOPHONE_RESOURCES;
  const start = (page - 1) * PAGE_SIZE;
  return filtered.slice(start, start + PAGE_SIZE);
}

/** Return the subset of resources for a specific instrument and page. */
export function paginatedByInstrument(page: number, instrument: Instrument) {
  const filtered = resourcesByInstrument(instrument);
  const start = (page - 1) * PAGE_SIZE;
  return filtered.slice(start, start + PAGE_SIZE);
}

/** Return total pages for a given category. */
export function totalPages(category?: Category) {
  const filtered = category
    ? resourcesByCategory(category)
    : SAXOPHONE_RESOURCES;
  return Math.ceil(filtered.length / PAGE_SIZE);
}

/** Return total pages for a given instrument. */
export function totalPagesByInstrument(instrument: Instrument) {
  const filtered = resourcesByInstrument(instrument);
  return Math.ceil(filtered.length / PAGE_SIZE);
}
