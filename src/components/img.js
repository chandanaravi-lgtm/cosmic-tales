import { imageSources } from '../data/imagePicker.js';
import { esc } from '../data/format.js';

/**
 * Put a data image into `container`, trying each source in turn
 * (local WebP -> thumbnail -> remote URL). If all fail, show `failedHTML` —
 * a drawn illustration, never a broken-image icon.
 * Images are lazy-loaded and decoded asynchronously.
 */
export function mountImage(container, img, fallbackHTML, { preferThumb = false, className = '', failedHTML = fallbackHTML, eager = false } = {}) {
  container.innerHTML = '';
  const sources = imageSources(img, preferThumb);
  if (!sources.length) { container.innerHTML = fallbackHTML; return; }
  const el = document.createElement('img');
  el.alt = img.alt || '';
  el.loading = eager ? 'eager' : 'lazy';
  el.decoding = 'async';
  el.referrerPolicy = 'no-referrer';
  if (className) el.className = className;
  let i = 0;
  el.onerror = () => {
    i++;
    if (i < sources.length) el.src = sources[i];
    else container.innerHTML = failedHTML; // the data HAS a photo, it just could not be fetched
  };
  el.onload = () => container.classList.add('has-image');
  el.src = sources[0];
  container.appendChild(el);
}

export function captionHTML(img) {
  if (!img) return '';
  const credit = img.credit ? ` <span class="credit">${esc(img.credit)}</span>` : '';
  return `${esc(img.caption || img.alt || '')}${credit}`;
}
