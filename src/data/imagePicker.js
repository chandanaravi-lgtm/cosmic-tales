/**
 * Image selection rule: every moment of a timeline shows a DIFFERENT photo — a
 * photo is never shown twice in one timeline. The data build assigns them (the
 * moment's own photo, else an unused photo of the machine, else a related photo
 * of the same world — see scripts/build-data.mjs); this is a second guard at run
 * time. A moment left without a photo gets a drawn "photo coming soon" picture.
 */
export function pickEventImages(machine) {
  const byId = new Map((machine.images || []).map((i) => [i.id, i]));
  const shown = new Set();
  return machine.events.map((e) => {
    const img = e.image ? byId.get(e.image) : null;
    if (!img || shown.has(img.local)) return null;
    shown.add(img.local);
    return { ...img, borrowed: !!e.photoBorrowed, related: !!e.photoRelated };
  });
}

/** Best image for the Cosmic Card: first photo, else first image. */
export function cardImage(machine) {
  const imgs = (machine.images || []).filter((i) => !i.related);
  return imgs.find((i) => i.kind === 'photo') || imgs[0] || null;
}

/**
 * URL candidates in order. Photo-pack images are local WebP files (full size +
 * thumbnail); older records may still carry a remote NASA `url` as last resort.
 */
export function imageSources(img, preferThumb = false) {
  if (!img) return [];
  const list = preferThumb ? [img.thumb, img.local, img.url] : [img.local, img.thumb, img.url];
  return [...new Set(list.filter(Boolean))];
}

/** Warm the browser cache so a photo shows instantly when it is needed. */
const warmed = new Set();
export function preloadImage(img, preferThumb = false) {
  const url = imageSources(img, preferThumb)[0];
  if (!url || warmed.has(url)) return;
  warmed.add(url);
  const el = new Image();
  el.decoding = 'async';
  el.src = url;
}
