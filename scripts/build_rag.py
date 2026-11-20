#!/usr/bin/env python3
"""
Build the knowledge base for "Ask Astro", the in-app assistant (run: `npm run rag`).

The ONLY input is data-raw/rag/Data.zip (the team's data zip: 3 NSSDCA pages +
5 NASA Science PDFs). Its files are read straight from the zip, turned into
clean passages and sentences, and written to public/data/rag-index.json. The
browser searches that file; every answer is made of sentences copied word for
word from it, so the assistant can only say what the zip says.

    pip install pypdf      (only needed when the zip changes)
    npm run rag
"""
import io, json, re, sys, time, zipfile, hashlib
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ZIP = ROOT / "data-raw/rag/Data.zip"
OUT = ROOT / "public/data/rag-index.json"

# Which machine each file is about. Matched on the file's own title text, so
# renamed files (display (1).xml …) are still routed correctly.
#   names  = words a question may use for this machine (routing only, not facts)
DOCS = [
    {"id": "apollo-11-lm", "match": "Apollo 11 Lunar Module", "name": "Apollo 11 Lunar Module \u201cEagle\u201d", "short": "Apollo 11 Eagle",
     "body": "moon", "names": ["apollo 11", "apollo11", "eagle", "easep", "lm-5", "armstrong", "aldrin", "tranquility"]},
    {"id": "apollo-12-lm", "match": "Apollo 12 Lunar Module", "name": "Apollo 12 Lunar Module \u201cIntrepid\u201d", "short": "Apollo 12 Intrepid",
     "body": "moon", "names": ["apollo 12", "apollo12", "intrepid", "lm-6", "conrad", "bean"]},
    {"id": "apollo-15-lm", "match": "Apollo 15 Lunar Module", "name": "Apollo 15 Lunar Module \u201cFalcon\u201d", "short": "Apollo 15 Falcon",
     "body": "moon", "names": ["apollo 15", "apollo15", "falcon", "lm-10", "scott", "irwin", "hadley", "moon buggy", "lunar roving vehicle", "lrv"]},
    {"id": "surveyor-3", "match": "Surveyor 3", "name": "Surveyor 3", "short": "Surveyor 3",
     "body": "moon", "names": ["surveyor 3", "surveyor", "surveyor-c"]},
    {"id": "viking-1", "match": "Viking 1", "name": "Viking 1", "short": "Viking 1",
     "body": "mars", "names": ["viking 1", "viking", "viking-b", "thomas mutch", "chryse"]},
    {"id": "mars-pathfinder", "match": "Mars Pathfinder", "name": "Mars Pathfinder & Sojourner", "short": "Mars Pathfinder",
     "body": "mars", "names": ["mars pathfinder", "pathfinder", "sojourner", "carl sagan memorial station", "ares vallis"]},
    {"id": "near-shoemaker", "match": "NEAR Shoemaker", "name": "NEAR Shoemaker", "short": "NEAR Shoemaker",
     "body": "deep-space", "names": ["near shoemaker", "near", "shoemaker", "eros", "mathilde", "near earth asteroid rendezvous"]},
    {"id": "kepler", "match": "Kepler", "name": "Kepler Space Telescope (K2)", "short": "Kepler",
     "body": "deep-space", "names": ["kepler", "k2", "kepler space telescope"]},
]

MONTHS = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?"
DATE_LINE = re.compile(rf"^{MONTHS} \d{{1,2}}, \d{{4}}$")
# label lines in the NASA Science "at a glance" blocks (value on the next line)
FACT_LABELS = [
    "Nation", "Objective(s)", "Objective", "Spacecraft", "Spacecraft Mass", "Spacecraft mass", "Spacecraft Power",
    "Mission Design and Management", "Mission design and management", "Launch Vehicle", "Launch vehicle",
    "Launch Date and Time", "Launch date and time", "Launch Site", "Launch site", "Launch", "Launch location",
    "Rocket", "Mars landing", "Landing site", "End of mission", "Rover",
]
SECTION_HEADS = {
    "What was Viking 1?", "What was NEAR Shoemaker?", "What was Surveyor 3?", "Results", "In Depth: NEAR Shoemaker",
    "In depth: the mission", "The television camera", "Apollo 12 visits Surveyor 3", "Mission overview", "Key facts",
    "Mission results", "Airbag landing", "The Sojourner rover", "Landing site: Ares Vallis", "Mars Pathfinder science instruments",
    "Mars Pathfinder science highlights", "360-degree landing-site panorama", "Overview", "'Planets are Everywhere'", "Legacy",
    "Mission at a glance", "Key dates", "Key Dates", "Firsts", "Scientific Instruments", "Scientific instruments",
    "Description", "Mission Profile", "Lunar Module Spacecraft and Subsystems", "Facts in Brief", "Alternate Names",
}
# trailing boilerplate that is not about the machine
STOP_AT = ("Key Source", "Source note", "Source\n", "Funding Agenc", "Additional Information")
DROP_LINE = re.compile(r"^(Page \d+|.*\bNASA Science$|.*NASA lunar exploration$|NASA - NSSDCA - Spacecraft - Details|"
                       r"\w+day, \d{1,2} \w+ \d{4}|NSSDCA/COSPAR ID:.*|urn:nasa:.*|\d{5}|Instrument|Purpose)$")
ABBREV = re.compile(r"(?:\b(?:Jr|Sr|Dr|Mr|Mrs|Ms|Fla|Calif|St|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|U\.S|[A-Z])|\b(?i:no|vs|approx|ca|e\.g|i\.e|a\.m|p\.m))\.$")


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.out, self.skip = [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"): self.skip += 1
        if tag in ("p", "br", "h1", "h2", "h3", "h4", "li", "tr", "div"): self.out.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"): self.skip -= 1

    def handle_data(self, d):
        if not self.skip: self.out.append(d)


def file_text(name, data):
    if name.lower().endswith(".pdf"):
        from pypdf import PdfReader
        return "\n".join(p.extract_text() or "" for p in PdfReader(io.BytesIO(data)).pages), "pdf"
    p = Page(); p.feed(data.decode("utf-8", "replace"))
    return "".join(p.out), "html"


def clean_lines(text):
    for stop in STOP_AT:
        i = text.find(stop)
        if i > 200: text = text[:i]
    text = text.replace("\u00a0", " ").replace("\u2002", " ").replace("\uf0b7", "•").replace("\x7f", "•")
    text = re.sub(r"[ \t]+", " ", text)
    lines = [l.strip() for l in text.split("\n")]
    return [l for l in lines if l and not DROP_LINE.match(l)]


def sentences(par):
    """Split a paragraph into sentences without breaking on Jr. / Fla. / initials."""
    parts, cur = [], ""
    for tok in re.split(r"(?:(?<=[.!?])|(?<=[.!?][\"”’)]))\s+", par):
        cur = f"{cur} {tok}".strip() if cur else tok
        if ABBREV.search(cur) or re.search(r"\b\d+\.$", cur):
            continue
        parts.append(cur); cur = ""
    if cur: parts.append(cur)
    return [s for s in (p.strip() for p in parts) if len(s) > 2]


def passages_pdf(lines):
    """NASA Science PDFs: re-join wrapped lines; turn label/value and date/event blocks into sentences."""
    out, section, buf, group = [], "Overview", [], None
    # merge the two-line label "Mission Design and" + "Management"
    merged = []
    for l in lines:
        if merged and merged[-1].lower() == "mission design and" and l.lower() == "management":
            merged[-1] += " " + l
        else:
            merged.append(l)
    lines = merged

    def flush():
        if buf:
            out.append({"section": section, "text": " ".join(buf)}); buf.clear()

    i = 0
    while i < len(lines):
        l = lines[i]
        nxt = lines[i + 1] if i + 1 < len(lines) else ""
        if l in SECTION_HEADS or (l.isupper() and len(l) < 40):
            flush(); section = l.title() if l.isupper() else l; i += 1; continue
        if l in FACT_LABELS and nxt and nxt not in FACT_LABELS:
            flush()
            value, j = nxt, i + 2
            # a value can wrap onto the next line: "(RTGs); Orbiters were solar-powered"
            while j < len(lines) and (lines[j][:1] in "(" or lines[j][:1].islower()) and lines[j] not in FACT_LABELS:
                value += " " + lines[j]; j += 1
            out.append({"section": section, "text": f"{l}: {value.rstrip('.')}."}); i = j; continue
        if DATE_LINE.match(l) and nxt and not DATE_LINE.match(nxt):
            flush()
            value, j = nxt, i + 2
            while j < len(lines) and lines[j][:1].islower():  # wrapped description
                value += " " + lines[j]; j += 1
            out.append({"section": "Key dates", "text": f"{l}: {value.rstrip('.')}."}); i = j; continue
        if section in ("Firsts", "Scientific instruments", "Scientific Instruments") and not re.match(r"^\d{1,2}\. ", l) \
                and l not in ("Orbiters", "Landers", "Aeroshells") and not re.search(r"[.!?]$", l):
            flush()
            label = section
            out.append({"section": section, "text": f"{label}: {l}."}); i += 1; continue
        if section.lower().startswith("scientific instruments") and l in ("Orbiters", "Landers", "Aeroshells"):
            flush(); group = l; i += 1; continue
        if re.match(r"^\d{1,2}\. ", l):  # numbered instrument lists -> one sentence per group
            flush()
            items = []
            while i < len(lines) and re.match(r"^\d{1,2}\. ", lines[i]):
                items.append(re.sub(r"^\d{1,2}\. ", "", lines[i]).rstrip(".")); i += 1
            who = f"Scientific Instruments ({group})" if group else "Scientific instruments"
            out.append({"section": section, "text": f"{who}: {'; '.join(items)}."}); continue
        if l.startswith("•"):
            flush(); buf.append(l.lstrip("• ").strip()); flush(); i += 1; continue
        buf.append(l)
        # a line ending a sentence that is followed by a capitalised, shortish line → new paragraph
        if re.search(r"[.!?\"”]$", l) and not ABBREV.search(l) and (len(l) < 70 or (nxt and nxt[0].isupper() and len(nxt) < 60)):
            flush()
        i += 1
    flush()
    return out


def passages_html(lines):
    """NSSDCA pages: one paragraph per line, with section headings."""
    out, section = [], "Description"
    names = []
    for l in lines[1:] if lines else []:
        if l in SECTION_HEADS or (section != "Alternate Names" and len(l) < 70 and not re.search(r"[.:;]", l) and l[0].isupper() and len(l.split()) <= 8):
            section = l
            continue
        if section == "Alternate Names":
            names.append(l); continue
        if section == "Facts in Brief":
            out.append({"section": section, "text": l.rstrip(".") + "."}); continue
        out.append({"section": section, "text": l})
    if names:
        out.append({"section": "Alternate Names", "text": "Alternate names: " + ", ".join(names) + "."})
    return out


NORM = lambda t: re.sub(r"[^a-z0-9]", "", t.lower())


def verify(sentence, source_norm):
    """Every sentence must occur in the zip's text (ignoring punctuation, spacing
    and line breaks). "Label: value" sentences built from the fact blocks must
    have BOTH the label and the value in the text."""
    if NORM(sentence) in source_norm:
        return True
    m = re.match(r"^([^:]{2,60}?)(?: \(([^)]*)\))?: (.+)$", sentence)
    return bool(m) and NORM(m.group(1)) in source_norm and (not m.group(2) or NORM(m.group(2)) in source_norm) \
        and all(NORM(part) in source_norm for part in re.split(r"; |, ", m.group(3)))


def main():
    if not ZIP.exists():
        sys.exit(f"missing {ZIP}")
    raw = ZIP.read_bytes()
    zf = zipfile.ZipFile(io.BytesIO(raw))
    docs, passages = [], []
    for info in sorted(zf.infolist(), key=lambda i: i.filename):
        if info.is_dir() or not re.search(r"\.(pdf|xml|html?)$", info.filename, re.I):
            continue
        text, kind = file_text(info.filename, zf.read(info))
        lines = clean_lines(text)
        head = " ".join(lines[:4])
        meta = next((d for d in DOCS if d["match"].lower() in head.lower() or d["match"].lower() in info.filename.lower()), None)
        if not meta:
            print(f"  ! skipped {info.filename}: no machine matched"); continue
        ps = passages_pdf(lines) if kind == "pdf" else passages_html(lines)
        title = next((l for l in text.split("\n") if l.strip()), info.filename).strip() if kind == "html" else Path(info.filename).stem.replace("_", " ")
        if kind == "html":
            m = re.search(r"\n\s*(Apollo \d+ Lunar Module[^\n]*)", text)
            title = f"NSSDCA \u2013 {m.group(1).strip()}" if m else title
        docs.append({"id": meta["id"], "name": meta["name"], "short": meta["short"], "body": meta["body"], "names": meta["names"],
                     "file": Path(info.filename).name, "title": title})
        source_norm = NORM(text)
        for k, p in enumerate(ps):
            sents = sentences(p["text"])
            bad = [x for x in sents if not verify(x, source_norm)]
            if bad:
                sys.exit(f"✖ {info.filename}: sentence not found in the zip text: {bad[0]!r}")
            if sents:
                passages.append({"doc": meta["id"], "section": p["section"], "n": k, "sentences": sents})
        print(f"  {Path(info.filename).name:38} -> {meta['id']:16} {len(ps):3} passages")
    out = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "source": {"file": "data-raw/rag/Data.zip", "sha1": hashlib.sha1(raw).hexdigest(), "files": len(docs)},
        "docs": docs,
        "passages": passages,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    n_s = sum(len(p["sentences"]) for p in passages)
    print(f"✔ {len(docs)} files, {len(passages)} passages, {n_s} sentences -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
