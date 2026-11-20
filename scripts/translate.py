#!/usr/bin/env python3
"""
Timeline translations (run: `npm run translate` after `npm run data`).

Translates ONLY the text inside the timeline information box — moment titles,
texts, detail labels/values, photo captions and the few labels in that box —
into the languages in LANGS, using Snowflake Cortex AI_COMPLETE (one call per
language and machine, all in a single query). Navigation, the 3D scene and the
rest of the UI stay in English.

Writes public/data/i18n/<code>.json (one small file per language, loaded only
when a reader picks that language) and public/data/i18n/index.json.
Already-translated text is cached in data/i18n-cache.json, so re-running after
a data change only sends the new or changed strings.

Every translation is checked: it must keep every number of the English text,
must not be empty or English, and must be valid JSON; failures are retried, then
left in English (the app then says "some lines are not translated yet").

    python3 scripts/translate.py              # translate what is missing
    python3 scripts/translate.py --estimate   # only count tokens, no AI calls
    python3 scripts/translate.py --only hi,kn # some languages only

Needs a Snowflake connection (~/.snowflake/connections.toml "default", or the
SNOWFLAKE_* environment variables) with a role that has SNOWFLAKE.CORTEX_USER.
"""
import argparse, hashlib, json, os, re, sys, time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "public/data/machines.json"
OUT = ROOT / "public/data/i18n"
CACHE = ROOT / "data/i18n-cache.json"
MODEL = "claude-sonnet-4-5"

# code: (English name, own name)
LANGS = {
    "hi": ("Hindi", "हिन्दी"),
    "kn": ("Kannada", "ಕನ್ನಡ"),
    "ta": ("Tamil", "தமிழ்"),
    "te": ("Telugu", "తెలుగు"),
    "es": ("Spanish", "Español"),
    "fr": ("French", "Français"),
    "de": ("German", "Deutsch"),
    "ja": ("Japanese", "日本語"),
}

# labels shown inside the timeline box (keep in sync with src/data/i18n.js)
UI = {
    "type.launch": "Launch", "type.arrival": "Arrival", "type.landing": "Landing", "type.milestone": "Milestone",
    "type.discovery": "Discovery", "type.anomaly": "Problem!", "type.lost-contact": "Signal lost", "type.end": "Mission end",
    "source": "Source", "moreInfo": "For more information, open this link.", "open": "Open",
    "dataNotAvailable": "Data not available", "photoComingSoon": "Photo coming soon",
    "relatedPhoto": "Related photo", "fromPhotoSet": "From this mission’s photo set",
    "note": "Machine-translated from the English NASA text",
}

PROMPT = """You translate a children's space-history app (readers aged 10-17) from English into {lang}.
Translate every value of the JSON object below into natural, simple, accurate {lang}.
Rules:
- Keep every number, date, year and unit exactly as written, using Western digits (0-9).
- Keep proper names of spacecraft, people and places recognisable (transliterate them into the {lang} script if that is normal).
- Do not add, remove or explain anything. Keep quotes as quotes.
- Reply with ONLY a JSON object with exactly the same keys, no markdown fences.

{payload}"""


def english():
    """{group: {key: english}} — one group per machine plus 'ui'."""
    data = json.loads(DATA.read_text())
    groups = {"ui": dict(UI)}
    for m in data["machines"]:
        g = {}
        for e in m["events"]:
            k = f"e.{e['id']}"
            g[f"{k}.title"] = e["title"]
            g[f"{k}.text"] = e["text"]
            for i, (dk, dv) in enumerate(e.get("details") or []):
                g[f"{k}.d{i}.k"] = dk
                g[f"{k}.d{i}.v"] = dv
        shown = {e.get("image") for e in m["events"]}
        for img in m.get("images") or []:
            if img["id"] in shown and img.get("caption"):
                g[f"img.{img['id']}"] = img["caption"]
        groups[m["id"]] = {k: v for k, v in g.items() if isinstance(v, str) and v.strip()}
    return groups


def h(s):
    return hashlib.sha1(s.encode()).hexdigest()[:16]


def connect():
    import snowflake.connector
    kw = {"connection_name": os.environ.get("SNOWFLAKE_CONNECTION", "default")}
    try:
        return snowflake.connector.connect(**kw)
    except Exception:
        tok = Path(os.environ.get("SNOWFLAKE_TOKEN_FILE_PATH", "/snowflake/session/token"))
        return snowflake.connector.connect(
            account=os.environ["SNOWFLAKE_ACCOUNT"], host=os.environ.get("SNOWFLAKE_HOST"),
            authenticator="oauth", token=tok.read_text().strip() if tok.exists() else os.environ["SNOWFLAKE_TOKEN"],
            warehouse=os.environ.get("SNOWFLAKE_WAREHOUSE"), role=os.environ.get("SNOWFLAKE_ROLE"))


def digits(text):
    return sorted(re.findall(r"\d+", text))


def check(src, out):
    """Split a model answer into good / bad keys."""
    if not isinstance(out, dict):
        return {}, list(src)
    good, bad = {}, []
    for k, en in src.items():
        v = out.get(k)
        if not isinstance(v, str) or not v.strip():
            bad.append(k)
        elif Counter(digits(en)) - Counter(digits(v)):
            bad.append(k)  # a number from the English text went missing (extra digits are fine: "five" -> "5")
        elif len(en) > 12 and v.strip() == en.strip():
            bad.append(k)  # left in English
        else:
            good[k] = v.strip()
    return good, bad


def parse_json(text, keys=()):
    """The model's JSON answer. If it is not valid JSON (usually an unescaped quote inside a
    translation, e.g. "“The Eagle has landed”" written with plain quotes), fall back to reading
    it line by line: one `"key": "value",` per line, keys known in advance."""
    if text is None:
        return None
    t = text.strip()
    if t.startswith('"'):  # AI_COMPLETE returns a JSON string literal
        try:
            t = json.loads(t)
        except Exception:
            pass
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", str(t).strip())
    a, b = t.find("{"), t.rfind("}")
    try:
        return json.loads(t[a:b + 1]) if a >= 0 else None
    except Exception:
        pass
    out, known = {}, set(keys)
    for line in t.splitlines():
        m = re.match(r'^\s*"([^"]+)"\s*:\s*"(.*)"\s*,?\s*$', line)
        if m and m.group(1) in known:
            v = m.group(2).replace('\\"', '"').replace("\\n", " ")
            if v.startswith('"') and v.endswith('"') and len(v) > 1:
                v = f"“{v[1:-1]}”"  # a quoted title: keep it quoted, safely
            out[m.group(1)] = v.replace("\\\\", "\\")
    return out or None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--estimate", action="store_true")
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    langs = [l for l in (a.only.split(",") if a.only else LANGS) if l in LANGS]
    groups = english()
    cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}

    jobs = []  # (lang, group, {key: english}) for text not in the cache
    for lang in langs:
        c = cache.setdefault(lang, {})
        for gid, g in groups.items():
            todo = {k: v for k, v in g.items() if h(v) not in c}
            if todo:
                jobs.append((lang, gid, todo))
    mk = lambda lang, todo: PROMPT.format(lang=LANGS[lang][0], payload=json.dumps(todo, ensure_ascii=False, indent=0))
    prompts = [mk(l, t) for l, _, t in jobs]
    print(f"{len(jobs)} requests, {sum(len(t) for *_, t in jobs)} strings, ~{sum(len(p) for p in prompts) // 4:,} input tokens")
    if a.estimate or not jobs:
        if not jobs:
            print("everything is already translated (cache)")
    else:
        con = connect()
        cur = con.cursor()
        for attempt in range(3):
            if not jobs:
                break
            t0 = time.time()
            rows = ",".join(["(%s, %s, %s)"] * len(jobs))
            params = []
            for (lang, gid, _), p in zip(jobs, prompts):
                params += [lang, gid, p]
            cur.execute(
                f"SELECT column1, column2, AI_COMPLETE(%s, column3, {{'temperature': 0, 'max_tokens': 16000}}) FROM VALUES {rows}",
                [MODEL, *params])
            qid = cur.sfqid
            # read the answers back one small row at a time: big result sets are downloaded from
            # cloud storage, which restricted networks block — single rows come back inline
            retry, retry_prompts = [], []
            for lang, gid, todo in jobs:
                cur.execute("SELECT $3 FROM TABLE(RESULT_SCAN(%s)) WHERE $1 = %s AND $2 = %s", [qid, lang, gid])
                r = cur.fetchone()
                good, bad = check(todo, parse_json(r[0], todo) if r else None)
                for k, v in good.items():
                    cache[lang][h(todo[k])] = v
                if bad:
                    print(f"  {lang}/{gid}: {len(bad)} string(s) failed the check{' — retrying' if attempt < 2 else ' — English kept'}")
                    sub = {k: todo[k] for k in bad}
                    retry.append((lang, gid, sub))
                    retry_prompts.append(mk(lang, sub))
            print(f"round {attempt + 1}: {len(jobs)} requests in {time.time() - t0:.0f}s (query {qid})")
            CACHE.write_text(json.dumps(cache, ensure_ascii=False, indent=0, sort_keys=True))
            jobs, prompts = retry, retry_prompts

    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for lang in LANGS:
        c = cache.get(lang, {})
        if not c:
            continue
        doc = {"lang": lang, "name": LANGS[lang][1], "english": LANGS[lang][0], "model": MODEL, "groups": {}}
        total = done = 0
        for gid, g in groups.items():
            tr = {k: c[h(v)] for k, v in g.items() if h(v) in c}
            total += len(g)
            done += len(tr)
            doc["groups"][gid] = tr
        (OUT / f"{lang}.json").write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")))
        index.append({"code": lang, "name": LANGS[lang][1], "english": LANGS[lang][0], "coverage": round(done / total, 3)})
        print(f"{lang}: {done}/{total} strings -> public/data/i18n/{lang}.json ({(OUT / f'{lang}.json').stat().st_size // 1024} KB)")
    (OUT / "index.json").write_text(json.dumps({"languages": index}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    sys.exit(main())
