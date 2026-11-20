# Cosmic Tales

*Machines we left among the stars.* An interactive 3D solar-system explorer for school-age space fans (ages about 10–17). Fly to the Moon, Mars and deep space, click a real NASA machine to get its **Cosmic Card**, then follow its key moments on the **timeline** — with photos, a voice narrator, translation, Save, a photo Gallery and a link to read more.

Plain JavaScript + three.js + GSAP + Vite (no React, no TypeScript — chosen for the smallest, fastest download).

**Contents:** [Quick start](#quick-start) · [What's inside](#whats-inside) · [Folder layout](#folder-layout) · [Data formats](#data-formats) · [How-to guides](#how-to-guides) · [Keeping the project small](#keeping-the-project-small-for-github) · [Publishing the app (beginner guide)](#publishing-the-app-step-by-step-for-beginners) · [Ask Astro](#ask-astro-the-in-app-assistant) · [Voice narration](#voice-narration-kokoro-tts) · [Translation](#timeline-translation) · [Loading speed](#loading-speed) · [Credits](#credits)

---

## Quick start

**You need:** **Node.js 18.18 or newer** (Node 20 LTS or 22 LTS recommended) and **npm 9 or newer** (it comes with Node). Check with `node -v` and `npm -v`. Any recent Chrome, Edge, Firefox or Safari with WebGL.

```bash
cd "cosmic tales"
npm install        # once — downloads three.js, GSAP, Vite and the fonts (~60 MB into node_modules/)
npm run dev        # while editing      → http://localhost:8000
npm run serve      # demos / judging    → production build + preview on http://localhost:8000
```

Use `npm run serve` for demos: the production build sends about 1 MB before the first view; photos, narration and the lander/rover models load later, only when needed.

The Python scripts (`npm run photos`, `textures`, `voice`, `rag`, `translate`) are only needed when you change photos, textures, narration, the assistant's knowledge or translations — their output is already in `public/`.

---

## What's inside

| Feature | Where |
|---|---|
| Animated 3D solar system (stylised scale, orbits, starfield, asteroid belt, bloom); sun light + soft camera "headlight" + rim glow, so every planet is readable from any angle | `src/scenes/` |
| Your Moon, Mars, Earth and Sun models (compressed GLB) with 1K → 2K → 4K WebP texture levels | `public/models/`, `public/images/planets/` |
| Big glowing **Cosmic Tale** title, text-only **Moon / Mars / Deep Space** tabs with their own gradients (no emojis), Search, Sound, Saved and Gallery top-right — all always visible | `src/components/Header.js`, `src/styles/header.css` |
| Clicking a planet or its name flies smoothly to it; **Whole solar system** button bottom-left | `src/scenes/MachineMarkers.js`, `src/components/ZoomOutButton.js` |
| Glass search bar; results grouped into *Planets & places*, *Machines & missions*, *Timeline moments*; × to cancel | `src/components/Header.js`, `src/data/DataStore.js` `searchAll()` |
| Clear-glass UI (≈ 3 px blur, light tint, thin border, faint highlight) on the header, bars, search, cards, timeline, chat, modals and Gallery | `src/styles/base.css` (`--clear-blur`) |
| Camera zooms in first, then the **Cosmic Card** (holo sheen, chip, barcode, tilt, flip) | `src/main.js`, `src/components/CosmicCard.js` |
| Machine close-up: as close as possible with the whole machine in frame, low camera angle, sunlit key light, soft shadows, metal reflections, slow orbit | `src/main.js`, `src/scenes/SceneManager.js` |
| **Timeline** in a right-hand panel while the 3D machine stays visible on the left; snaps to key moments; *Play story*; ends with **"For more information, open this link."** (new tab) | `src/components/Timeline.js` |
| Timeline box that **never scrolls**: photo + text always fit one screen-sized box (text steps down through tighter densities on small screens) | `src/components/Timeline.js` `#fit()`, `src/styles/timeline.css` |
| Every moment has a **different photo** — a photo is never shown twice in one timeline | `scripts/build-data.mjs`, `src/data/imagePicker.js` |
| **Save**: asks *what* (this moment / whole timeline) and *where* (Favourites, an existing or new collection), confirms, and the **Saved** panel shows them later | `src/components/Saved.js` |
| **Translation** of the timeline box only — Hindi, Kannada, Tamil, Telugu, Spanish, French, German, Japanese; navigation and 3D labels stay English | `src/data/i18n.js`, `public/data/i18n/` |
| **Gallery**: every unique photo once, one-line names, a ♥ **Like** button on every photo, an **All photos / Liked** switch, and a phone-style viewer (← / →, swipe, close) that browses all photos or only the liked ones | `src/components/Gallery.js`, `public/data/gallery.json` |
| **Ask Astro** chat: fixed in the lower-right corner (never moves; every click opens it); hides while a timeline, the Gallery or Saved is open; answers only from the team's `Data.zip` | `src/components/AstroChat.js`, `src/rag/engine.js` |
| **Voice narrator** (Kokoro TTS): Astronaut / Storyteller voices, Listen · Pause · Continue, 0.75–2× speed, captions | `src/audio/Narrator.js`, `src/components/VoiceDeck.js` |
| Loading screen, WebGL/data error messages, automatic quality fallback, generated ambient sound | `src/components/Loader.js`, `src/audio/AmbientSynth.js` |

**Keyboard:** `/` opens search (`Esc` or × closes it) · `←` / `→`, `Home`, `End` move through the timeline · `Space` plays/pauses the story · `N` pauses/continues the narrator · `−` / `+` change its speed · `Esc` closes the top panel · `H` returns home · everything works with `Tab`.

**Deep links:** `#machine=surveyor-3`, `#view=moon`, `#view=mars`, `#view=deepspace`.

**Stored in the browser** (`localStorage`, nothing is sent anywhere): sound on/off, narrator voice/speed, chosen language, Saved collections (`cosmic-tales:saved`) and Liked photos (`cosmic-tales:liked`).

---

## Folder layout

```
cosmic tales/
├─ index.html               page shell + preload hints
├─ package.json             scripts and dependencies
├─ vite.config.js           dev/preview server on port 8000, relative asset paths
├─ netlify.toml             Netlify build settings (optional)
├─ .gitignore               keeps node_modules/, dist/, assets-src/ and zips out of Git
├─ src/
│  ├─ main.js               app controller (views, camera flow, wiring)
│  ├─ components/           UI: Header, CosmicCard, Timeline, Saved, Gallery, AstroChat, VoiceDeck, Panels, Loader, icons…
│  ├─ scenes/               3D: SceneManager, SolarSystem, MachineMarkers, CameraDirector, Starfield, procedural planets
│  ├─ data/                 DataStore, i18n, image picker, formatting
│  ├─ config/               app.config.js (all UI text + settings), bodies.js (planets), model calibration
│  ├─ rag/                  Ask Astro search engine
│  ├─ audio/                narrator + ambient sound
│  ├─ core/                 event bus, asset loader/cache
│  └─ styles/               CSS per area
├─ public/                  copied as-is into the build
│  ├─ data/                 machines.json, gallery.json, narration.json, rag-index.json, i18n/<lang>.json
│  ├─ images/rovers/<id>/   timeline + card photos per machine (WebP + thumbnails)
│  ├─ images/gallery/       extra Gallery photos
│  ├─ images/planets/       planet textures (1K / 2K / 4K WebP)
│  ├─ models/               planet, lander and rover GLB models
│  └─ audio/narration/      narration clips (<voice>/<machine>/<moment>.mp3)
├─ data/                    hand-edited sources: machines.source.json, photos.json, links.json, narration.json
├─ data-raw/                original PDFs/XML, photo pack, links pack, Data.zip (inputs to the build scripts)
├─ scripts/                 build-data, photos, textures, voice, rag, translate, model converter, tests
└─ docs/                    DATA_GAPS.md, PHOTOS_NEEDED.md, DEMO_SCRIPT.md, NARRATION_SUMMARY.md
```

`assets-src/` (the original 8K textures, FBX and Blender files, ~245 MB) is **not** part of the download or the GitHub repository. The app never loads it; you only need it to re-make textures or re-convert a model.

---

## Data formats

### No made-up facts

`npm run data` (`scripts/build-data.mjs`) checks that **every `quote` occurs word for word in its source text**, that every photo exists and names real timeline moments, that no photo repeats inside a timeline, and that every link file contains a URL. If anything can't be verified, the build fails. Missing fields are `null` and show as **"Data not available"**. Photo captions only describe the picture; they are never used as facts.

### Planets and other bodies — `src/config/bodies.js`

```js
{
  id: 'mars', name: 'Mars',
  radius: 0.95, orbit: 34, period: 240, spin: 55, phase: 5.3,   // stylised scale (see the comment at the top of the file)
  model: 'models/mars.glb', calibration: 'mars',                  // GLB in public/models; lat/lon calibration key
  textures: { low: 'images/planets/mars_1k.webp', mid: 'images/planets/mars_2k.webp', high: 'images/planets/mars_4k.webp' },
  atmosphere: { color: '#ff9a6b', intensity: 0.3 }, focus: 3.3, featured: true,
  fallbackSite: { lat: 8, lon: -18 },                             // display-only spot for a machine with no coordinates
}
```

A body without `model` gets a procedural sphere (`procedural: 'jupiter'`). `parent: 'earth'` makes it orbit another body.

### Rovers, landers and missions — `data/machines.source.json`

```jsonc
{
  "id": "viking-1", "name": "Viking 1", "aliases": ["Viking Lander 1"],
  "body": "mars",                     // moon | mars | deep-space
  "anchor": "eros",                   // optional: sit on a decorative deep-space body
  "model": "mars_rover",              // optional GLB key in MODEL_URLS (src/scenes/MachineMarkers.js); else a stylised shape
  "markerShape": "lander",            // lander | rover | probe | telescope | orbiter
  "launchDate":  { "value": "20 August 1975", "iso": "1975-08-20", "src": "viking-1", "quote": "…verbatim from the source…" },
  "launchSite":  { "value": "…", "src": "…", "quote": "…" },     // or null -> "Data not available"
  "launchVehicle": …, "purpose": …, "destination": …,
  "abandoned": { "value": "1982", "note": "last contact", "status": "ended", "src": …, "quote": … },
  "location":  { "lat": 22.483, "lon": -47.94, "name": "Chryse Planitia", "src": …, "quote": … },   // real landing site
  "events": [ /* timeline entries, see below */ ],
  "dataNotes": ["shown in docs/DATA_GAPS.md"]
}
```

### Timeline entries (inside `events`)

```jsonc
{ "id": "landing", "type": "landing",            // launch | arrival | landing | milestone | discovery | anomaly | lost-contact | end
  "date": { "iso": "1976-07-20", "label": "20 Jul 1976" },
  "title": "First perfect landing on Mars", "text": "Kid-friendly retelling…",
  "details": [["Landed", "Chryse Planitia"]],
  "src": "viking-1", "quotes": ["…verbatim…"] }
```

### Images — `data/photos.json`

```jsonc
"viking-1": {
  "folder": "viking 1",                                         // folder inside data-raw/photos/
  "images": [{ "id": "lander", "file": "images.jfif", "alt": "What is in the picture", "caption": "Short caption." }],
  "events": { "landing": "lander" }                             // timeline moment id -> image id
},
"relatedFill": { "moon": [ … ], "mars": [ … ] }                 // Gallery photos a moment may borrow (see "photos" below)
```

`npm run data` writes the final `images`, each event's `image` and `moreInfo` into `public/data/machines.json`:

```jsonc
"images":   [{ "id": "lander", "kind": "photo", "local": "images/rovers/viking-1/lander.webp",
               "thumb": "images/rovers/viking-1/lander-thumb.webp", "alt": "…", "caption": "…" }],
"moreInfo": { "url": "https://science.nasa.gov/mission/viking-1/", "site": "NASA Science", "file": "data-raw/links/viking 1.txt" }
```

### Links — `data/links.json` + `data-raw/links/*.txt`

`data/links.json` maps a machine id to a `.txt` file in `data-raw/links/`; the first URL in that file is used.

### Gallery — `public/data/gallery.json` (generated by `npm run photos`)

```jsonc
{ "photos": [{ "id": "g1", "name": "Surveyor 3 on the Moon", "group": "Surveyor 3", "machine": "surveyor-3",
               "local": "images/rovers/surveyor-3/on-moon.webp", "thumb": "images/rovers/surveyor-3/on-moon-thumb.webp" }],
  "skippedDuplicates": ["…same picture as one already in the gallery"] }
```

---

## How-to guides

### Add a new rover or machine

1. Put its source file (PDF/XML/HTML) in `data-raw/sources/<id>.pdf` and run `python scripts/extract_text.py` (needs `pip install pypdf`).
2. Add a record to `data/machines.source.json` (format above) with `src` + `quote` on every fact, and add the source to `"sources"`. Use the real landing coordinates from the source in `location`; if the source has none, leave `location` out and the marker is placed at the body's `fallbackSite` and labelled *approximate*.
3. Run `npm run data`. It fails and tells you exactly which quote it couldn't find.
4. Photos: see below. Link: see below. Narration: add its lines to `data/narration.json` and run `npm run voice`.
5. Run `npm run data` again and reload. The machine appears on its body, in search, in the bottom bar and in the lists — no code changes.

### Replace or swap a 3D model

- **A machine model (rover / lander):** put the `.glb` in `public/models/`, add it to `MODEL_URLS` in `src/scenes/MachineMarkers.js`, and set `"model"` on the machine record. Origin at the bottom centre, +Y up. Keep it small: `npx gltfpack -i big.glb -o public/models/rover.glb -cc` usually cuts the size by 5–10×.
- **A planet (Moon / Mars / Earth):** replace the source in `assets-src/`, then run the converter:
  ```bash
  pip install bpy==4.2.0 numpy          # Python 3.11
  python scripts/blender_convert.py -- assets-src /tmp/models-out
  npx @gltf-transform/cli meshopt /tmp/models-out/moon.glb public/models/moon.glb
  cp /tmp/models-out/models-report.json src/config/model-calibration.json
  ```
  The converter measures each planet's latitude/longitude alignment from its UVs (so real landing coordinates land on the right spot) and fixes mirrored UVs. Put 8K textures in `assets-src/` and run `npm run textures` to make the `_1k/_2k/_4k.webp` files in `public/images/planets/`.

### Add or replace photos

Rule: **every moment of a timeline shows a different photo** — a photo is never shown twice in one timeline. A moment without its own photo takes an unused photo of the same machine; if none is left it borrows a *related* photo of the same world from the Gallery (captioned "Related photo"). `docs/PHOTOS_NEEDED.md` lists every moment still waiting for its own photo (currently 25), with the exact file name and subject wanted.

1. **Quickest:** save the photo as `data-raw/photos-new/<machine-id>/<moment-id>.jpg` (names are in `docs/PHOTOS_NEEDED.md`), optionally with a same-named `.txt` holding a one-line caption.
2. **Or** put originals in `data-raw/photos/<folder>/` and list them in `data/photos.json` (format above). To leave a photo out, don't list it (note why under `"excluded"`).
3. Run `npm run photos` (makes WebP files + thumbnails in `public/images/rovers/<machine>/` and rebuilds the Gallery, removing duplicates) and then `npm run data`.

### Add or update an external information link

Edit the URL in the machine's `.txt` file in `data-raw/links/` (or add a new file and map it in `data/links.json`), then run `npm run data`. It appears at the end of the timeline as **"For more information, open this link."** and opens in a new tab.

### Add a celestial body

Add an entry to `BODIES` in `src/config/bodies.js` (format above).

---

## Keeping the project small for GitHub

The project is about **35 MB** without `node_modules/`, `dist/` and `assets-src/` — fine for GitHub (its limit is 100 MB per file).

- **Never commit** `node_modules/` (re-created by `npm install`), `dist/` (re-created by `npm run build`) or `assets-src/` (original 8K/FBX/Blender sources, ~245 MB). The included `.gitignore` already excludes them, plus `*.zip` (except `data-raw/rag/Data.zip`), logs and `.env`.
- **Photos:** always go through `npm run photos`; it makes ~150–250 KB WebP files instead of multi-MB JPEGs.
- **Models:** compress with `gltfpack -cc` (see above). Keep each model under ~5 MB.
- **Textures:** the app only needs `public/images/planets/*_1k/_2k/_4k.webp`.
- **Narration:** `public/audio/` (~13 MB) is the biggest folder. To save space you can delete one voice folder (e.g. `public/audio/narration/storyteller/`) — that voice then says "Voice not available".
- Check what you are about to upload: `git count-objects -vH` after committing, or `du -sh public/*`.

---

## Publishing the app (step by step, for beginners)

**Best option for this project: Vercel** (free, detects Vite automatically, gives you an `https://…vercel.app` address). Netlify works the same way and is described as an alternative. GitHub Pages also works (asset paths are relative) but needs an extra workflow file, so it is not the first choice.

### 1. Download and unpack

1. Download the ZIP files (see `DOWNLOAD_INSTRUCTIONS.txt`) and extract **all of them into the same place**. You get one folder called **`cosmic tales`** containing `package.json`, `src/`, `public/` …
2. Check that `cosmic tales/public/images/`, `public/models/` and `public/audio/` all exist.

### 2. Install the tools (once)

3. Install **Node.js 20 LTS** from https://nodejs.org (Windows/macOS installer; keep the defaults). This also installs npm.
4. Install **VS Code** from https://code.visualstudio.com.
5. Install **Git** from https://git-scm.com/downloads. On Windows this also installs **Git Bash** — use it for the commands below. (macOS/Linux: use the normal Terminal.)

### 3. Run it on your computer

6. Open VS Code → **File → Open Folder…** → choose the `cosmic tales` folder.
7. Open the terminal: **Terminal → New Terminal**. (On Windows pick *Git Bash* from the ▾ next to the `+`.)
8. Install the dependencies and start the app:
   ```bash
   node -v          # should print v18.18 or higher
   npm install
   npm run dev
   ```
9. Open http://localhost:8000 in your browser. Press `Ctrl + C` in the terminal to stop it.
10. Check the production build works:
    ```bash
    npm run build    # creates the dist/ folder
    npm run preview  # http://localhost:8000
    ```

### 4. Put it on GitHub

11. Create a free account at https://github.com and sign in.
12. Click **+ → New repository**. Name it `cosmic-tales`, choose **Public**, and **do not** tick "Add a README" or ".gitignore" (the project has its own). Click **Create repository**.
13. In the VS Code terminal (inside `cosmic tales`), tell Git who you are (once per computer):
    ```bash
    git config --global user.name "Your Name"
    git config --global user.email "you@example.com"
    ```
14. Turn the folder into a Git repository and make the first commit:
    ```bash
    git init
    git add .
    git status                 # node_modules/, dist/ and assets-src/ must NOT be listed
    git commit -m "Cosmic Tales hackathon app"
    ```
15. Connect it to GitHub and upload (replace `YOUR-USERNAME`):
    ```bash
    git branch -M main
    git remote add origin https://github.com/YOUR-USERNAME/cosmic-tales.git
    git push -u origin main
    ```
    The first push opens a browser window to sign in to GitHub. Refresh your repository page — the files are there.

### 5. Deploy with Vercel

16. Go to https://vercel.com → **Sign Up** → **Continue with GitHub**.
17. Click **Add New… → Project**, find `cosmic-tales` and click **Import**.
18. Vercel detects **Vite**. Check: *Build Command* `npm run build`, *Output Directory* `dist`. Click **Deploy**.
19. After about a minute you get your public address, e.g. **`https://cosmic-tales-yourname.vercel.app`**. Open it and share it — that is your **final public app URL**.

**Alternative — Netlify:** https://app.netlify.com → **Add new site → Import an existing project → GitHub** → pick `cosmic-tales`. The included `netlify.toml` fills in *Build command* `npm run build` and *Publish directory* `dist`. Click **Deploy**; your address is `https://<name>.netlify.app`. (No GitHub? Run `npm run build` and drag the `dist` folder onto https://app.netlify.com/drop.)

### 6. Update the app later

20. Make your changes, test with `npm run dev`, then:
    ```bash
    git add .
    git commit -m "Describe what you changed"
    git push
    ```
    Vercel (or Netlify) rebuilds and updates the same public URL automatically within a minute or two.
21. If you changed data files (photos, links, facts), run `npm run photos` and/or `npm run data` **before** committing.

---

## Ask Astro (the in-app assistant)

The astronaut button sits **fixed in the lower-right corner** and never moves. **Click it** and the chat window opens beside it. After **45 seconds without any interaction** a bar warns "Closing soon", then the window folds back into the astronaut (the conversation is kept). `Esc` or the – button closes it. It hides while a timeline, the Gallery or the Saved panel is open and returns to the same corner afterwards.

**Only answers from the data zip** — a retrieval system (RAG without a generator):

```
data-raw/rag/Data.zip          the ONLY source (3 NSSDCA pages + 5 NASA Science PDFs)
scripts/build_rag.py           zip -> clean passages + sentences      (npm run rag)
public/data/rag-index.json     the knowledge base (~70 KB, loaded the first time the chat opens)
src/rag/engine.js              search + answer engine (plain JS, runs in the browser)
scripts/test-rag.mjs           70+ test questions: right answers + off-topic refusals   (npm run test:rag)
```

- `npm run rag` reads the files straight out of the zip and checks that every one of the 424 sentences really occurs in the zip's text.
- Each answer is the best 1–3 sentences **copied word for word**, with the file they came from and a "Show …" button that flies the 3D view to that machine.
- **Domain lock:** questions that don't name one of the 8 machines or a place must use at least two specific words that appear in the files; anything else gets a polite refusal and suggested questions.
- **No AI text generation**, so it cannot invent facts, and it needs no server or API key. The trade-off: answers use NASA's own (sometimes technical) wording.

## Voice narration (Kokoro TTS)

Every timeline moment has a spoken version made with [Kokoro-82M](https://github.com/hexgrad/kokoro) (ONNX export `kokoro-onnx`).

```
data/narration.json          one short spoken story per timeline event
scripts/voice.config.json    voices, speed, pauses, effects, pronunciation fixes
scripts/generate_voice.py    renders the clips               (npm run voice)
public/audio/narration/      <voice>/<machine>/<event>.mp3
public/data/narration.json   manifest the app loads: urls, durations, caption timings
```

Two voices: *Astronaut* (`am_michael`, mission-control radio effect) and *Storyteller* (`af_heart`). Scripts retell only the facts in each event. Clips are pre-rendered (running Kokoro in the browser would mean a 90–330 MB download). To edit: change a line in `data/narration.json`, `pip install -r scripts/voice-requirements.txt`, `npm run voice` (only changed clips re-render).

## Timeline translation

`npm run translate` (`scripts/translate.py`) translates only the text in the timeline box (titles, texts, details, photo captions, a few box labels) with Snowflake Cortex `AI_COMPLETE`, checks every string (same keys, nothing empty, numbers kept) and writes one small file per language to `public/data/i18n/<lang>.json` (30–60 KB). A language file and its Noto font are fetched only when a visitor picks that language, so nothing extra loads at start-up. Results are cached in `data/i18n-cache.json`, so a re-run only sends changed text (`--estimate` shows the token count first; `--only hi,ta` limits languages). Translations are machine translations and are marked as such in the box. If a string is missing, the English text is shown with a short note.

## Loading speed

- **1K WebP planet textures at start-up** (≈ 375 KB for all four), 2K swapped in afterwards, 4K only when the camera is close.
- **Preload hints** in `index.html` fetch models, textures and data in parallel with the JS; shaders are compiled before the first frame.
- **Lazy loading:** lander/rover models, narration, the chat engine (≈ 20 KB) and its knowledge base, language files and fonts, the Gallery list and its thumbnails all load only when first needed.
- **Procedural planets in a Web Worker**, so the loader never freezes.
- **Photos are local WebP** (1200 px + 420 px thumbnails); the timeline preloads only the next and previous moments' photos. Textures and models are cached, so revisiting a planet does not reload them.

## Credits

- Mission facts: NASA Science pages and the NASA NSSDCA Master Catalog, as supplied in `data-raw/sources/`.
- Photos: the team photo pack in `data-raw/photos/` (no credits were supplied with it).
- Planet models/textures: as supplied by the project owner.
- Mars rover model: *"High-Detail Mars Rover 3D Model"* by **shriyans716** (https://sketchfab.com/shriyans716), CC-BY-4.0 (`public/models/mars_rover.LICENSE.txt`).
- Narration voices: Kokoro-82M by hexgrad (Apache-2.0), ONNX export by thewh1teagle/kokoro-onnx.
- Built with three.js, GSAP and Vite.
