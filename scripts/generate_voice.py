#!/usr/bin/env python3
"""
Generate the timeline voice-over with Kokoro TTS (hexgrad/Kokoro-82M, ONNX export).

  data/narration.json        scripts, one per timeline event (the "summary file")
  scripts/voice.config.json  voices, effects, pronunciation fixes
        │
        ▼
  public/audio/narration/<voice>/<machine>/<event>.mp3   small mono MP3s
  public/data/narration.json                             manifest: urls, durations, caption cues
  docs/NARRATION_SUMMARY.md                              readable summary of every timeline

Why pre-generate instead of running Kokoro in the browser?  The model is ~90-330 MB;
downloading it would make loading far slower. Pre-rendered clips are ~5-8 KB per
second of speech and are fetched one at a time, only when the timeline is open.

Each clip is built sentence by sentence so we get exact caption timings and natural
storytelling pauses. Unchanged clips are skipped (content hash), so editing one line
only re-renders that clip.

Usage:  python scripts/generate_voice.py [--only machine-id] [--voice astronaut] [--force]
Setup:  pip install -r scripts/voice-requirements.txt
        (model files are downloaded on first run into $KOKORO_MODEL_DIR, default ~/.cache/kokoro-onnx)
"""
import argparse, hashlib, json, os, re, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
CFG = json.loads((ROOT / "scripts/voice.config.json").read_text())
SCRIPTS = json.loads((ROOT / "data/narration.json").read_text())["machines"]
MACHINES = json.loads((ROOT / "public/data/machines.json").read_text())["machines"]
OUT_AUDIO = ROOT / "public/audio/narration"
OUT_MANIFEST = ROOT / "public/data/narration.json"
OUT_SUMMARY = ROOT / "docs/NARRATION_SUMMARY.md"
SR = 24000

# ---------------------------------------------------------------- text helpers
ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()

def two_digits(n):
    if n < 20:
        return ONES[n]
    t, o = divmod(n, 10)
    return TENS[t] + (f"-{ONES[o]}" if o else "")

def year_words(y):
    """1967 -> 'nineteen sixty-seven', 2009 -> 'two thousand nine', 2018 -> 'twenty eighteen'.
    (espeak reads 1967 as 'nineteen hundred sixty seven', which sounds wrong.)"""
    hi, lo = divmod(y, 100)
    if 2000 <= y <= 2009:
        return "two thousand" + (f" {ONES[lo]}" if lo else "")
    if lo == 0:
        return f"{two_digits(hi)} hundred"
    return f"{two_digits(hi)} {'oh ' + ONES[lo] if lo < 10 else two_digits(lo)}"

YEAR_RE = re.compile(r"(?<![\d,.])(19\d\d|20\d\d)(?![\d,.]?\d)")

def spoken(text):
    """Text sent to the TTS engine. Captions keep the original spelling."""
    for word, say in CFG.get("pronounce", {}).items():
        text = re.sub(rf"\b{re.escape(word)}\b", say, text)
    return YEAR_RE.sub(lambda m: year_words(int(m.group(1))), text)

def sentences(text):
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]

# ---------------------------------------------------------------- audio helpers
def ffmpeg_exe():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return "ffmpeg"

def tone(freq, secs, amp=0.16):
    t = np.arange(int(SR * secs)) / SR
    env = np.minimum(1, np.minimum(t, secs - t) / 0.01)  # 10 ms fade in/out, no clicks
    return (np.sin(2 * np.pi * freq * t) * env * amp).astype(np.float32)

def silence(secs):
    return np.zeros(int(SR * secs), dtype=np.float32)

# Post-processing per effect. "radio" = band-limited, compressed, light hiss and the
# classic two-tone beeps that bracket a space-to-ground transmission.
EFFECTS = {
    "radio": {
        "lead": lambda: np.concatenate([tone(2525, 0.25), silence(0.22)]),
        "tail": lambda: np.concatenate([silence(0.25), tone(2475, 0.25), silence(0.05)]),
        "hiss": 0.004,
        "filter": "highpass=f=260,lowpass=f=4300,acompressor=threshold=-20dB:ratio=3.5:attack=4:release=90:makeup=2,"
                  "loudnorm=I=-17:TP=-1.5:LRA=9",
    },
    "warm": {
        "lead": lambda: silence(0.12),
        "tail": lambda: silence(0.35),
        "hiss": 0.0,
        "filter": "highpass=f=60,acompressor=threshold=-22dB:ratio=2:attack=12:release=140:makeup=1.5,"
                  "aecho=0.85:0.6:35:0.08,loudnorm=I=-17:TP=-1.5:LRA=11",
    },
}

def encode(wave, effect, out_path):
    """float32 mono @24k -> filtered MP3."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        sf.write(tmp.name, wave, SR, subtype="PCM_16")
        cmd = [ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y", "-i", tmp.name,
               "-af", EFFECTS[effect]["filter"], "-ar", str(SR), "-ac", "1",
               "-c:a", "libmp3lame", "-b:a", CFG.get("mp3Bitrate", "48k"), str(out_path)]
        subprocess.run(cmd, check=True)
    os.unlink(tmp.name)

# ---------------------------------------------------------------- model
def load_kokoro():
    from kokoro_onnx import Kokoro
    d = Path(os.environ.get("KOKORO_MODEL_DIR", Path.home() / ".cache/kokoro-onnx"))
    d.mkdir(parents=True, exist_ok=True)
    m = CFG["model"]
    for f in (m["onnx"], m["voices"]):
        if not (d / f).exists():
            print(f"  downloading {f} …", flush=True)
            urllib.request.urlretrieve(m["downloadBase"] + f, d / f)
    return Kokoro(str(d / m["onnx"]), str(d / m["voices"]))

# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="machine id")
    ap.add_argument("--voice", help="voice key from voice.config.json")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    old = json.loads(OUT_MANIFEST.read_text()) if OUT_MANIFEST.exists() else {}
    old_clips = old.get("clips", {})
    voices = {k: v for k, v in CFG["voices"].items() if not args.voice or k == args.voice}
    kokoro = None
    clips, made, skipped, missing = {}, 0, 0, []
    t0 = time.time()

    for m in MACHINES:
        script = SCRIPTS.get(m["id"], {})
        n = len(m["events"])
        for i, ev in enumerate(m["events"]):
            text = script.get(ev["id"])
            if not text:
                missing.append(f"{m['id']}/{ev['id']}")
                continue
            entry = clips.setdefault(m["id"], {}).setdefault(ev["id"], {"text": text, "voices": {}})
            for vkey, v in CFG["voices"].items():
                prev = old_clips.get(m["id"], {}).get(ev["id"], {}).get("voices", {}).get(vkey)
                lines = ([v["greeting"]] if i == 0 and v.get("greeting") else []) + sentences(text) \
                    + ([v["signoff"]] if i == n - 1 and v.get("signoff") else [])
                key = hashlib.sha1(json.dumps([CFG["model"]["onnx"], v, EFFECTS[v["effect"]]["filter"],
                                               CFG.get("pronounce"), lines]).encode()).hexdigest()[:12]
                rel = f"audio/narration/{vkey}/{m['id']}/{ev['id']}.mp3"
                selected = vkey in voices and (not args.only or args.only == m["id"])
                if prev and prev.get("hash") == key and (ROOT / "public" / rel).exists() and not args.force or not selected:
                    if prev:
                        entry["voices"][vkey] = prev
                    skipped += 1
                    continue
                kokoro = kokoro or load_kokoro()
                fx = EFFECTS[v["effect"]]
                parts, cues = [fx["lead"]()], []
                t = len(parts[0]) / SR
                for k, line in enumerate(lines):
                    audio, sr = kokoro.create(spoken(line), voice=v["kokoroVoice"], speed=v["speed"], lang=CFG["lang"])
                    assert sr == SR
                    audio = audio.astype(np.float32)
                    cues.append({"t": round(t, 2), "text": line})
                    parts.append(audio)
                    t += len(audio) / SR
                    if k < len(lines) - 1:
                        parts.append(silence(v["sentencePause"]))
                        t += v["sentencePause"]
                parts.append(fx["tail"]())
                wave = np.concatenate(parts)
                if fx["hiss"]:
                    wave = wave + np.random.default_rng(7).normal(0, fx["hiss"], len(wave)).astype(np.float32)
                encode(wave, v["effect"], ROOT / "public" / rel)
                entry["voices"][vkey] = {"url": rel, "duration": round(len(wave) / SR, 2), "cues": cues, "hash": key}
                made += 1
                print(f"  [{vkey:11}] {m['id']}/{ev['id']}  {len(wave)/SR:5.1f}s   ({time.time()-t0:5.0f}s elapsed)", flush=True)

    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "engine": CFG["model"]["name"],
        "voices": {k: {"label": v["label"], "description": v["description"]} for k, v in CFG["voices"].items()},
        "clips": clips,
    }
    OUT_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")))
    write_summary(clips)
    print(f"done: {made} generated, {skipped} unchanged/skipped, {len(missing)} events without a script"
          + (f": {', '.join(missing)}" if missing else ""))

def write_summary(clips):
    """docs/NARRATION_SUMMARY.md: every machine's timeline as a spoken story."""
    out = ["# Narration summary — every timeline, as the narrator tells it", "",
           "Generated by `npm run voice` from `data/narration.json`. Each paragraph retells one timeline",
           "event using only the facts in that event's data (see `data/machines.source.json`).", ""]
    for m in MACHINES:
        out += [f"## {m['name']}", ""]
        for ev in m["events"]:
            c = clips.get(m["id"], {}).get(ev["id"])
            date = (ev.get("date") or {}).get("label") or "Date not available"
            secs = ", ".join(f"{k} {v['duration']:.0f}s" for k, v in (c or {}).get("voices", {}).items())
            out += [f"**{date} — {ev['title']}**" + (f" _({secs})_" if secs else ""), "",
                    c["text"] if c else "_No narration script yet._", ""]
    OUT_SUMMARY.write_text("\n".join(out))

if __name__ == "__main__":
    sys.exit(main())
