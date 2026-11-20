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

## Machine data coverage (generated by `npm run data` — 2026-11-17)

273 facts/images were checked against the raw source files; all verified.

| Machine | Photos | Events | Events still needing their own photo | Events w/o exact date | 3D model | More-info link | Missing fields (shown as "Data not available") |
|---|---|---|---|---|---|---|---|
| Surveyor 3 | 6 | 6 | 2 | 2 | none (stylised stand-in) | yes | — |
| Apollo 11 Lunar Module “Eagle” | 7 | 7 | 4 | 0 | `apollo_lm` model | yes | — |
| Apollo 12 Lunar Module “Intrepid” | 7 | 7 | 4 | 0 | `apollo_lm` model | yes | — |
| Apollo 15 Lunar Module “Falcon” | 8 | 8 | 5 | 0 | `apollo_lm` model | yes | — |
| Viking 1 | 9 | 9 | 6 | 2 | none (stylised stand-in) | yes | — |
| Mars Pathfinder & Sojourner | 6 | 6 | 4 | 2 | `mars_rover` model | yes | Landing coordinates |
| NEAR Shoemaker | 13 | 11 | 0 | 0 | none (stylised stand-in) | yes | — |
| Kepler Space Telescope | 9 | 7 | 0 | 1 | none (stylised stand-in) | yes | Launch location, Launch vehicle, Destination |

### Photos still needed

25 unique photos (Surveyor 3: 2, Apollo 11 Eagle: 4, Apollo 12 Intrepid: 4, Apollo 15 Falcon: 5, Viking 1: 6, Pathfinder & Sojourner: 4) — send real, landscape photos (≥ 800 px wide, no watermarks), one per moment. How to add them: [PHOTOS_NEEDED.md](PHOTOS_NEEDED.md).

| Machine | How many | Moment | File name | Recommended subject |
|---|---|---|---|---|
| Surveyor 3 | 2 | 4 May 1967 · Last message home | `surveyor-3/last-contact.jpg` | Surveyor 3 standing silent on the lunar surface (any lunar-surface view of the lander) |
|  |  | After Apollo 12 · Space-weathered parts | `surveyor-3/parts-studied.jpg` | The returned Surveyor 3 camera or scoop being examined in a laboratory on Earth |
| Apollo 11 Lunar Module “Eagle” | 4 | 16 Jul 1969 · Riding a Saturn 5 | `apollo-11-lm/launch.jpg` | The Apollo 11 Saturn V rocket lifting off (16 Jul 1969) |
|  |  | 21 Jul 1969 · Science left behind | `apollo-11-lm/easep.jpg` | The EASEP science station (seismometer / laser reflector) set up on the Moon |
|  |  | 22 Jul 1969 · A mystery ending | `apollo-11-lm/ascent-fate.jpg` | Eagle's ascent stage in lunar orbit, seen from the command module |
|  |  | 27 Aug 1969 · The science station goes quiet | `apollo-11-lm/easep-end.jpg` | Close-up of the Apollo 11 passive seismometer on the lunar surface |
| Apollo 12 Lunar Module “Intrepid” | 4 | 14 Nov 1969 · Second trip to the Moon | `apollo-12-lm/launch.jpg` | The Apollo 12 Saturn V rocket lifting off (14 Nov 1969) |
|  |  | 19 Nov 1969 · Oops — the TV camera! | `apollo-12-lm/tv-camera.jpg` | The Apollo 12 TV camera on the lunar surface |
|  |  | 19 Nov 1969 · Science station switched on | `apollo-12-lm/alsep-on.jpg` | The Apollo 12 ALSEP science station being set up |
|  |  | 30 Sep 1977 · Science station switched off | `apollo-12-lm/alsep-off.jpg` | The Apollo 12 ALSEP science station on the lunar surface |
| Apollo 15 Lunar Module “Falcon” | 5 | 31 Jul 1971 · Taking the Moon’s temperature | `apollo-15-lm/heat-flow.jpg` | The Apollo 15 heat-flow experiment / ALSEP drill on the Moon |
|  |  | 2 Aug 1971 · Hammer vs. feather | `apollo-15-lm/feather.jpg` | Dave Scott with the hammer and feather (TV still) |
|  |  | 2 Aug 1971 · Leaving gifts behind | `apollo-15-lm/liftoff.jpg` | The Fallen Astronaut plaque and figure left at Hadley |
|  |  | 3 Aug 1971 · Crash landing (on purpose) | `apollo-15-lm/impact.jpg` | Falcon's ascent stage lifting off or in lunar orbit |
|  |  | 30 Sep 1977 · Science station switched off | `apollo-15-lm/alsep-off.jpg` | The Apollo 15 ALSEP central station on the lunar surface |
| Viking 1 | 6 | Jun 1976 · Too bumpy to land! | `viking-1/new-site.jpg` | Viking orbiter view of the Chryse Planitia landing area |
|  |  | Jul 1976 · A broken earthquake detector | `viking-1/seismometer.jpg` | The Viking lander seismometer (or a lander instrument close-up) |
|  |  | 28 Jul 1976 · Is anything alive? | `viking-1/soil.jpg` | The Viking 1 robot arm digging a trench in Martian soil |
|  |  | 7 Aug 1980 · The orbiter runs out of fuel | `viking-1/orbiter-off.jpg` | The Viking orbiter, or one of its photos of Mars or its moons |
|  |  | Jan 1982 · A new name | `viking-1/renamed.jpg` | A Viking 1 lander panorama of Chryse Planitia |
|  |  | 11 Nov 1982 · One wrong command | `viking-1/lost.jpg` | The Viking 1 lander on Mars (a lander view of its own deck or surroundings) |
| Mars Pathfinder & Sojourner | 4 | 4 Jul 1997 · Bounce, bounce, bounce! | `mars-pathfinder/landing.jpg` | Pathfinder's airbags (or an airbag drop test) |
|  |  | 1997 · Clues of ancient water | `mars-pathfinder/water.jpg` | Rocks and ancient flood channels at Ares Vallis |
|  |  | 1997 · Dust devils & magnetic dust | `mars-pathfinder/weather.jpg` | A Martian dust devil or the Martian sky seen by Pathfinder |
|  |  | 27 Sep 1997 · Final message | `mars-pathfinder/end.jpg` | The Pathfinder lander and Sojourner panorama ('Sagan Memorial Station') |
| **Total** | **25** | | | |

### Photos left out of the timelines (still shown in the Gallery)

- `s3/1.jpg, 2.jpg, 3.jfif, 4.jpg, 5.jpg, 6.jpg` — Not Surveyor 3: they appear to show other missions (twin spacecraft at the Moon, a Saturn orbiter, a Europa lander concept, a Jupiter probe, a telescope over Earth, a sample-return probe).
- `apolo 12/3` — Same photo as Surveyor_3_on_Moon.jpg (smaller crop).
- `11/hh.webp` — Tall Apollo-programme poster: far too tall for the photo frame and unreadable when shrunk.
- `11/images.jfif` — Shows the Moon buggy, which (per the data) first flew on Apollo 15 — not Apollo 11.
- `11/lunar module.jfif` — Carries a third-party (Science Photo Library) watermark.
- `apolo 15/WhatsApp Image 2026-11-15 at 12.51.33 PM (2).jpeg` — Shows a command module in a museum, not the lunar module Falcon.
- `apolo 15/WhatsApp Image 2026-11-15 at 12.51.34 PM (1).jpeg` — Cockpit/hatch close-up that cannot be identified as Apollo 15.
- `viking 1/images (1).jfif` — Appears to be a Mariner probe, not Viking.
- `viking 1/images (2).jfif` — Carries a third-party (Interstellar) watermark.
- `viking 1/mars-67522_1920.jpg` — Shows a later six-wheeled Mars rover, not Viking 1.
- `mars path finder/images (1).jfif` — Shows a satellite above Earth, not Pathfinder.
- `mars path finder/images (2).jfif` — Appears to be the InSight lander, not Pathfinder.
- `mars path finder/images (4).jfif` — Appears to be a Mariner probe, not Pathfinder.
- `mars path finder/spaceimagesimagesl.2e16d0ba.fill-490x430-c70.format-jpeg_h7pTMXR.jpg` — Shows small cube-shaped spacecraft, not Pathfinder.
- `kepler/WhatsApp Image 2026-11-15 at 12.04.51 PM (1).jpeg` — Unclear star-streak image that cannot be identified.

- **surveyor-3:** The pack's own `s3` folder shows other missions (see `excluded`), so Surveyor 3 uses the Surveyor pictures from the `apolo 12` folder.

## Notes, conflicts and display decisions

- **Surveyor 3:** Conflict: the Surveyor 3 PDF says Apollo 12 landed on November 18, 1969 and visited on November 19; the NSSDCA Apollo 12 page gives 19 Nov 1969 (landing, UT) and 20 Nov 1969 (second moonwalk, UT). The gap is a time-zone difference (EST vs UT). Surveyor 3’s timeline follows the Surveyor 3 PDF; Apollo 12’s timeline follows NSSDCA.
- **Apollo 11 Lunar Module “Eagle”:** The NSSDCA page does not name the launch pad, only “Cape Canaveral, United States”.
- **Apollo 12 Lunar Module “Intrepid”:** The NSSDCA page does not name the launch pad, only “Cape Canaveral, United States”.
- **Apollo 15 Lunar Module “Falcon”:** The Lunar Roving Vehicle is described inside the Apollo 15 LM record; it has no separate record, launch data or image, so it is not a separate machine.
- **Viking 1:** Viking 1 is shown as one machine with two markers (lander on the surface at the given coordinates, plus a stylised orbiter circling Mars).
- **Viking 1:** The image totals in the PDF (52,663 orbiter images; 4,500 lander photos) are for BOTH Viking missions together, so they are not shown as Viking 1 numbers.
- **Mars Pathfinder & Sojourner:** Exact landing coordinates are not in the data (only “Ares Vallis”). The marker uses an approximate display position, labelled as approximate in the app.
- **Mars Pathfinder & Sojourner:** Sojourner has no separate end date in the data, so the lander + rover are one machine (the uploaded rover 3D model represents Sojourner). The rover model is a generic rover by shriyans716 (CC-BY-4.0) and does not look exactly like the real Sojourner.
- **Mars Pathfinder & Sojourner:** The data gives no launch time or launch pad number.
- **NEAR Shoemaker:** NEAR sits on Eros, which is shown as a stylised, procedurally generated asteroid. Its position in the scene is decorative, not a real orbit.
- **Kepler Space Telescope:** Missing in the data: launch site, launch vehicle and where Kepler is now (its orbit/destination). Shown as “Data not available”.
- **Kepler Space Telescope:** Kepler drifts on a stylised path in the outer scene; this position is decorative.
