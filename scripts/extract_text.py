"""
Extract plain text from every raw source in data-raw/sources/ into
data-raw/text/<id>.txt, plus a list of image references found in XML pages
(data-raw/text/<id>.images.json). build-data.mjs uses these text files to
verify that every fact in machines.source.json is quoted from the data.

  pip install pypdf   (only needed when sources change)
  python scripts/extract_text.py
"""
import os, re, json
from html.parser import HTMLParser
from urllib.parse import urljoin

ROOT = os.path.join(os.path.dirname(__file__), '..', 'data-raw')
SRC, OUT = os.path.join(ROOT, 'sources'), os.path.join(ROOT, 'text')
os.makedirs(OUT, exist_ok=True)
NSSDCA = 'https://nssdc.gsfc.nasa.gov/'  # host of the NSSDCA pages (absolute links in the XML)


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.out, self.skip, self.imgs, self.links, self._a = [], 0, [], [], None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style'):
            self.skip += 1
        if tag == 'img':
            self.imgs.append({'src': urljoin(NSSDCA, a.get('src', '')), 'alt': a.get('alt', '')})
        if tag == 'a' and a.get('href'):
            self._a = {'href': urljoin(NSSDCA, a['href']), 'text': ''}
        if tag in ('p', 'br', 'h1', 'h2', 'h3', 'h4', 'li', 'tr', 'div'):
            self.out.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip -= 1
        if tag == 'a' and self._a:
            self.links.append(self._a)
            self._a = None

    def handle_data(self, d):
        if self._a is not None:
            self._a['text'] += d
        if not self.skip:
            self.out.append(d)


for name in sorted(os.listdir(SRC)):
    sid, ext = os.path.splitext(name)
    path = os.path.join(SRC, name)
    if ext == '.pdf':
        from pypdf import PdfReader
        text = '\n'.join(p.extract_text() or '' for p in PdfReader(path).pages)
    elif ext in ('.xml', '.html'):
        p = Page()
        p.feed(open(path, encoding='utf-8').read())
        text = ''.join(p.out)
        # Real mission images only (skip site logos/headers)
        images = [i for i in p.imgs if '/logo/' not in i['src']]
        big = [l for l in p.links if re.search(r'\.(jpe?g|gif|png)$', l['href'], re.I)]
        json.dump({'images': images, 'imageLinks': big}, open(os.path.join(OUT, sid + '.images.json'), 'w'), indent=2)
    else:
        continue
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r'\n\s*\n+', '\n', text).strip()
    open(os.path.join(OUT, sid + '.txt'), 'w', encoding='utf-8').write(text)
    print('extracted', sid, len(text), 'chars')
