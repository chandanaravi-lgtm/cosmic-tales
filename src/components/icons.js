/**
 * Original glassmorphism-style SVG icons (inline, no network).
 * Each call gets unique gradient ids so icons can appear many times.
 */
let uid = 0;
const id = (p) => `${p}${++uid}`;

export function moonIcon() {
  const g = id('mg'), h = id('mh');
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="icon">
    <defs>
      <radialGradient id="${g}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#f4f7ff"/><stop offset=".55" stop-color="#b9c3d9"/><stop offset="1" stop-color="#5d6782"/></radialGradient>
      <linearGradient id="${h}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>
    <circle cx="24" cy="24" r="15" fill="url(#${g})"/>
    <circle cx="19" cy="20" r="3.4" fill="#7e88a3" opacity=".55"/><circle cx="29" cy="28" r="4.4" fill="#7e88a3" opacity=".45"/>
    <circle cx="27" cy="16.5" r="1.8" fill="#7e88a3" opacity=".5"/><circle cx="18" cy="30" r="2" fill="#7e88a3" opacity=".4"/>
    <path d="M24 9a15 15 0 0 1 0 30a11 15 0 0 0 0-30z" fill="#0b1024" opacity=".28"/>
    <ellipse cx="20" cy="15" rx="8" ry="4" fill="url(#${h})" opacity=".7"/>
  </svg>`;
}

export function marsIcon() {
  const g = id('rg'), h = id('rh');
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="icon">
    <defs>
      <radialGradient id="${g}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffd2a6"/><stop offset=".5" stop-color="#e0703f"/><stop offset="1" stop-color="#7a2a17"/></radialGradient>
      <linearGradient id="${h}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    </defs>
    <circle cx="23" cy="25" r="14" fill="url(#${g})"/>
    <path d="M10 22c5 2 9-1 14 0s9 3 12 1" stroke="#8d3418" stroke-width="2" fill="none" opacity=".45" stroke-linecap="round"/>
    <path d="M12 30c4 1 8 3 13 1s7-1 10 0" stroke="#8d3418" stroke-width="1.6" fill="none" opacity=".35" stroke-linecap="round"/>
    <ellipse cx="23" cy="12.5" rx="5" ry="1.6" fill="#fff" opacity=".55"/>
    <ellipse cx="19" cy="16" rx="7" ry="3.5" fill="url(#${h})" opacity=".6"/>
    <circle cx="40" cy="11" r="2.4" fill="#b9a08a"/>
  </svg>`;
}

export function deepSpaceIcon() {
  const g = id('dg');
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="icon">
    <defs><radialGradient id="${g}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#d6c2ff"/><stop offset="1" stop-color="#6b4fd8" stop-opacity="0"/></radialGradient></defs>
    <ellipse cx="24" cy="24" rx="19" ry="8" fill="none" stroke="#b9a5ff" stroke-width="1.6" opacity=".55" transform="rotate(-25 24 24)"/>
    <ellipse cx="24" cy="24" rx="13" ry="5" fill="none" stroke="#e3d8ff" stroke-width="1.4" opacity=".6" transform="rotate(-25 24 24)"/>
    <circle cx="24" cy="24" r="8" fill="url(#${g})"/>
    <g fill="#fff"><circle cx="9" cy="10" r="1.1"/><circle cx="40" cy="36" r="1.2"/><circle cx="38" cy="9" r=".8"/><circle cx="8" cy="37" r=".8"/></g>
    <g transform="translate(34 14) rotate(35)"><rect x="-2" y="-1.6" width="4" height="3.2" rx=".6" fill="#ffd27a"/><rect x="-7" y="-1" width="4.4" height="2" fill="#7fa6ff"/><rect x="2.6" y="-1" width="4.4" height="2" fill="#7fa6ff"/></g>
  </svg>`;
}

export function homeIcon() {
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="icon">
    <ellipse cx="24" cy="24" rx="18" ry="7" fill="none" stroke="#cfe0ff" stroke-width="1.5" opacity=".6"/>
    <ellipse cx="24" cy="24" rx="11" ry="4.3" fill="none" stroke="#cfe0ff" stroke-width="1.3" opacity=".5"/>
    <circle cx="24" cy="24" r="5" fill="#ffc36b"/><circle cx="24" cy="24" r="7.5" fill="#ffb24d" opacity=".25"/>
    <circle cx="41" cy="22" r="2" fill="#6fb6ff"/><circle cx="14" cy="27.5" r="1.6" fill="#e0703f"/>
  </svg>`;
}

export function soundIcon(on) {
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="icon icon-line">
    <path d="M11 19h6l8-7v24l-8-7h-6z" fill="rgba(255,255,255,.18)" stroke="#e8eeff" stroke-width="2" stroke-linejoin="round"/>
    ${on
      ? '<path d="M30 18c2.5 3 2.5 9 0 12M34 14c5 5 5 15 0 20" fill="none" stroke="#9fd8ff" stroke-width="2.2" stroke-linecap="round"/>'
      : '<path d="M31 19l9 10M40 19l-9 10" fill="none" stroke="#ff9f9f" stroke-width="2.2" stroke-linecap="round"/>'}
  </svg>`;
}

export function searchIcon() {
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="icon icon-line">
    <circle cx="21" cy="21" r="10" fill="rgba(255,255,255,.14)" stroke="#e8eeff" stroke-width="2.4"/>
    <path d="M17 17.5a5 5 0 0 1 5-2.5" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none" opacity=".7"/>
    <path d="M29 29l9 9" stroke="#e8eeff" stroke-width="3.2" stroke-linecap="round"/>
  </svg>`;
}

export function closeIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon icon-line"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`;
}
export function arrowIcon(dir = 'right') {
  const d = dir === 'right' ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7';
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon icon-line"><path d="${d}" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
export function flipIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon icon-line"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M18 3v4h-4M6 21v-4h4" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
export function externalIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon icon-line"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/** "Ask Astro" chat button: a friendly little astronaut in a glass bubble. */
export function astronautIcon() {
  const suit = id('as'), visor = id('av'), glow = id('ag');
  return `<svg viewBox="0 0 64 64" aria-hidden="true" class="icon astronaut">
    <defs>
      <radialGradient id="${suit}" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".65" stop-color="#dfe5f5"/><stop offset="1" stop-color="#8e99bd"/></radialGradient>
      <linearGradient id="${visor}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b3f8f"/><stop offset=".55" stop-color="#1a1f4f"/><stop offset="1" stop-color="#5b2d7a"/></linearGradient>
      <radialGradient id="${glow}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#9fd8ff" stop-opacity=".9"/><stop offset="1" stop-color="#9fd8ff" stop-opacity="0"/></radialGradient>
    </defs>
    <!-- backpack + body -->
    <rect x="17" y="34" width="30" height="22" rx="10" fill="#b9c3dc"/>
    <path d="M20 58v-9a12 12 0 0 1 24 0v9z" fill="url(#${suit})"/>
    <rect x="27" y="46" width="10" height="6" rx="2" fill="#ff9f5a"/><circle cx="29.5" cy="49" r="1" fill="#fff"/><circle cx="34.5" cy="49" r="1" fill="#9fd8ff"/>
    <!-- helmet -->
    <circle cx="32" cy="26" r="17" fill="url(#${suit})"/>
    <rect x="19.5" y="17" width="25" height="18" rx="9" fill="url(#${visor})"/>
    <ellipse cx="26" cy="21.5" rx="5" ry="2.2" fill="#fff" opacity=".7" transform="rotate(-18 26 21.5)"/>
    <circle cx="38.5" cy="29" r="1.4" fill="#fff" opacity=".5"/>
    <!-- antenna -->
    <path d="M45 13l4-6" stroke="#cfd7ee" stroke-width="2" stroke-linecap="round"/><circle cx="49.5" cy="6.5" r="3" fill="url(#${glow})"/><circle cx="49.5" cy="6.5" r="1.6" fill="#ffd27a"/>
  </svg>`;
}

export function sendIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><path d="M3.5 11.2 20 4l-6.8 16.5-2.6-6.9z" fill="currentColor"/><path d="M10.6 13.6 20 4" stroke="#0a0f22" stroke-width="1.4" stroke-linecap="round"/></svg>`;
}

export function minimizeIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon icon-line"><path d="M6 12h12" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>`;
}

/** Narrator avatar: a glass astronaut helmet with an animated "voice" visor. */
export function helmetIcon() {
  const g = id('hg'), v = id('hv');
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="icon helmet">
    <defs>
      <radialGradient id="${g}" cx="35%" cy="28%" r="80%"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#d7def2"/><stop offset="1" stop-color="#7f8bb0"/></radialGradient>
      <linearGradient id="${v}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe3a3"/><stop offset=".5" stop-color="#ff9f5a"/><stop offset="1" stop-color="#5a2e7a"/></linearGradient>
    </defs>
    <path d="M10 40v-4a14 14 0 0 1 28 0v4z" fill="url(#${g})" opacity=".9"/>
    <circle cx="24" cy="21" r="14" fill="url(#${g})"/>
    <rect x="13" y="14" width="22" height="14" rx="7" fill="url(#${v})"/>
    <g class="helmet-wave" stroke="#fff" stroke-width="1.6" stroke-linecap="round">
      <path d="M17 21v0"/><path d="M20.5 19v4"/><path d="M24 17.5v7"/><path d="M27.5 19v4"/><path d="M31 21v0"/>
    </g>
    <ellipse cx="18" cy="16.5" rx="4" ry="1.6" fill="#fff" opacity=".55"/>
    <circle cx="38" cy="16" r="2" fill="#9fd8ff"/><path d="M36.5 16H34" stroke="#cfd7ee" stroke-width="1.6"/>
  </svg>`;
}

export function playIcon(playing) {
  return playing
    ? `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>`
    : `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon"><path d="M7 4.5v15l12-7.5z" fill="currentColor"/></svg>`;
}

/** Gallery: a framed photo with a mountain and a planet. */
export function galleryIcon() {
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="icon icon-line">
    <rect x="8" y="11" width="32" height="26" rx="5" fill="rgba(255,255,255,.14)" stroke="#e8eeff" stroke-width="2.2"/>
    <path d="M10 33l9-10 7 7 4-4 8 8" fill="none" stroke="#9fd8ff" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="31" cy="19" r="3.2" fill="#ffd27a"/>
  </svg>`;
}

/** Saved items: a bookmark ribbon (filled when something is saved). */
export function bookmarkIcon(filled = false) {
  return `<svg viewBox="0 0 48 48" aria-hidden="true" class="icon icon-line">
    <path d="M15 9h18a2 2 0 0 1 2 2v28l-11-7-11 7V11a2 2 0 0 1 2-2z" fill="${filled ? '#ffd27a' : 'rgba(255,255,255,.14)'}" stroke="${filled ? '#ffd27a' : '#e8eeff'}" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`;
}

/** Like: a heart, filled when the photo is liked. */
export function heartIcon(filled = false) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon icon-line icon-heart"><path d="M12 20.5s-7.5-4.6-9.2-9.4C1.6 7.6 3.9 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.3 0 5.6 3.1 4.4 6.6-1.7 4.8-9.2 9.4-9.2 9.4z" fill="${filled ? '#ff5d7a' : 'rgba(255,255,255,.12)'}" stroke="${filled ? '#ff5d7a' : 'currentColor'}" stroke-width="1.9" stroke-linejoin="round"/></svg>`;
}

export function translateIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon icon-line"><path d="M4 5h9M8.5 3v2M6 5c.7 3 2.8 5.6 5.5 7M11 5c-.8 3.6-3.4 6.6-7 8" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/><path d="M13 21l4-9 4 9M14.4 18h5.2" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function checkIcon() {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon icon-line"><circle cx="12" cy="12" r="10" fill="rgba(184,240,198,.2)" stroke="#b8f0c6" stroke-width="1.8"/><path d="M7.5 12.5l3 3 6-7" stroke="#b8f0c6" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
