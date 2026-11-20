# Data gap report — Cosmic Tales

This report lists what the supplied data does **not** contain. The app never fills these gaps with invented facts. A missing field shows **"Data not available"**, and a moment without its own photo shows a clearly captioned *related* photo of the same world.

## Sources used (and only these)

| File | Machine(s) |
|---|---|
| `data-raw/sources/surveyor-3.pdf` | Surveyor 3 |
| `data-raw/sources/apollo-11-lm.xml` (NSSDCA) | Apollo 11 Lunar Module "Eagle" / EASEP |
| `data-raw/sources/apollo-12-lm.xml` (NSSDCA) | Apollo 12 Lunar Module "Intrepid" / ALSEP |
| `data-raw/photos/` (team photo pack) | Photos only — never facts |
| `data-raw/links/` (team links pack) | "More information" links |
| `data-raw/sources/apollo-15-lm.xml` (NSSDCA) | Apollo 15 Lunar Module "Falcon" / ALSEP |
| `data-raw/sources/viking-1.pdf` | Viking 1 |
| `data-raw/sources/mars-pathfinder.pdf` | Mars Pathfinder & Sojourner |
| `data-raw/sources/near-shoemaker.pdf` | NEAR Shoemaker |
| `data-raw/sources/kepler-k2.pdf` | Kepler / K2 |

## Summary of gaps (short version)

| Gap | Machines | What the app shows |
|---|---|---|
| **Missing fields** | Kepler: launch location, launch vehicle, destination · Mars Pathfinder: exact landing coordinates, launch time/pad · Surveyor 3, Viking 1, Kepler: some moments only have a month/year | "Data not available"; approximate marker labelled as approximate |
| **Missing photos** | Surveyor 3 has **no correct photos in its own folder** (the `s3` folder shows other missions) — it borrows the Surveyor pictures from the `apolo 12` folder. Mars Pathfinder has only 2 usable photos, Apollo 11/12/15 and Viking 1 only 3 each. **25 more unique photos are needed** (exact list per rover below and in `docs/PHOTOS_NEEDED.md`). | No photo is ever repeated inside a timeline: a moment without its own photo borrows a *related* photo of the same world from the Gallery, captioned "Related photo", until the real one is added |
| **Missing 3D models** | Surveyor 3, Viking 1, NEAR Shoemaker, Kepler (no model supplied). The rover model is generic, not an exact Sojourner. All three Apollo LMs share one model. | Simple stylised stand-in shapes |
| **Missing links** | None — all 8 machines have a "more information" link | — |
| **Unverified links** | The build sandbox could not open science.nasa.gov or nssdc.gsfc.nasa.gov, so the 8 links were not opened. The 3 NSSDCA IDs (1969-059C, 1969-099C, 1971-063C) match the Apollo source files. | Links open in a new tab |

## Ask Astro knowledge (`data-raw/rag/Data.zip`)

- The data zip contains the same 8 files as `data-raw/sources/` (identical, byte for byte): `display.xml` = Apollo 11, `display (1).xml` = Apollo 12, `display (2).xml` = Apollo 15, plus the 5 NASA Science PDFs. Files are matched to machines by their title text, not their file names.
- Not in the zip, so Astro cannot answer them: the app's own kid-friendly timeline texts, the photo captions, the narration, the "more information" links, and the 3D models. Questions about using the app itself only get a short help message.
- Page headers, NSSDCA staff/contact lists, reference lists and "Key Source" notes are left out of the knowledge base, because they are not about the machines.

## Photos (team photo pack, `data-raw/photos/`)

- 58 photos in 8 folders were supplied; **38 are used** (2 of them by two machines: the Surveyor 3 photo and the Surveyor visit artwork appear for both Surveyor 3 and Apollo 12) and 20 were left out (list below, with reasons): wrong mission, watermarked, duplicate or unusable shape.
- Photos are converted to local WebP (`npm run photos`): 7.9 MB of originals become ~2.8 MB, in two sizes (1200 px for the timeline, 420 px thumbnails for cards/lists). Nothing is loaded from the internet any more, so photos appear immediately and never break.
- Which photo belongs to which moment, plus the caption and alt text, is in `data/photos.json`. Captions only describe what is visible — they are **not used as facts**. The pack has no photo credits, so no credit line is shown.
- The 5 PDFs contain no images; the old NSSDCA image links (remote, often slow or blocked) are no longer used.

## Links (team links pack, `data-raw/links/`)

- One `.txt` file per machine; `data/links.json` says which file belongs to which machine. The URL shown is read straight from the `.txt` file at build time.
- Shown at the end of each timeline as **"For more information, open this link."**, opening in a new tab.

## 3D models

| Supplied file | Used for | Notes |
|---|---|---|
| `moon.zip` (FBX + 8K texture) | The Moon | Decimated 260k → 80k → 40k triangles (float UVs kept, calibration unchanged); textures 1K (start-up) → 2K → 4K (close-up), WebP. |
| `mars-the-red-planet-free_1_.zip` (.blend + 8K texture) | Mars | **The model's UVs were mirrored east–west** (Mars would have appeared mirror-imaged). Fixed by flipping U in the converter; verified against the texture (Olympus Mons ≈ 135° W). The supplied normal map is a blank 207-byte image, so it is not used. |
| `earth.zip` (FBX + 8K texture) | Earth | — |
| `sun.zip` (FBX + texture) | The Sun | Core mesh only. |
| `MOON_instruments.zip` (Apollo LM .blend) | Apollo 11 / 12 / 15 Lunar Modules | Hidden reference planes, camera, lights and ground plane removed; old Blender 2.79 shaders converted to PBR colours; 689k → 90k triangles. The same model is used for all three LMs. |
| `MARS_Rovers.zip` (glTF) | Mars Pathfinder & Sojourner | CC-BY-4.0, *"High-Detail Mars Rover 3D Model" by shriyans716* (credited in the README). It is a generic rover and does not look exactly like Sojourner. |

Machines without a supplied model (Surveyor 3, Viking 1, NEAR, Kepler) use simple stylised "toy" shapes. These are clearly not replicas.

## Display decisions you should know about

- **Stylised scale.** Sizes and distances are compressed, and machines are drawn hugely enlarged so they can be seen.
- **Surveyor 3 vs Apollo 12.** They are only about 180 m apart in the data, so their markers are nudged apart (display only). The cards show the real coordinates.
- **Mars Pathfinder** has no coordinates in the data (only "Ares Vallis"). Its marker sits at a clearly labelled *approximate* spot.
- **NEAR Shoemaker / Eros** and **Kepler** positions in the scene are decorative, not real orbits.
- **Viking 1** = one machine with two markers (lander on the surface + stylised orbiter).
- When you focus the Moon or Mars, the globe is gently turned (and the Moon moved to a "full-ish" phase) so the landing sites are sunlit and face you.

## Voice narration

- **Space Apps Challenge resources not used.** The challenge's resources page (spaceappschallenge.org) was blocked by the build sandbox's network policy, so its contents could not be read. The narration scripts (`data/narration.json`) were written **only** from the facts already in each timeline event. If you want material from those resources included, add them as source files in `data-raw/sources/` like the PDFs/XMLs, and then extend the scripts.
- **Story framing.** Each voice adds a greeting on a machine's first moment ("This is your astronaut guide…") and a sign-off on its last ("Over and out!"). These are framing, not facts. A few kid-friendly interjections ("Uh oh.", "Chilly!", "A real space mystery!") are reactions to facts in the data, not new claims.
- **Pronunciation fixes** (audio only; captions keep the real spelling): Mathilde → "Ma-teeld", Chryse → "Kry-see", Sagan → "Saygun". Years are spoken as "nineteen sixty-seven", not "nineteen hundred sixty-seven".
- **Speech is machine-generated** (Kokoro-82M). It was checked for timing, loudness (about −17.5 LUFS, no clipping) and pitch, but nobody has listened to every clip. Please listen through once before judging day and re-word any line that sounds odd (`npm run voice` re-renders only changed clips).
