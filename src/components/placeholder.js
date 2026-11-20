import { STRINGS } from '../config/app.config.js';
import { esc } from '../data/format.js';

/**
 * "Tasteful placeholder" art used when the data has no image for a moment.
 * It is an obvious illustration (never a fake photo) and says so.
 */
const ART = {
  launch: `<path d="M100 28c14 12 20 34 18 58l-18 14-18-14c-2-24 4-46 18-58z" fill="url(#pg)" stroke="#e9f0ff" stroke-width="2"/>
    <circle cx="100" cy="62" r="7" fill="#0b1230" stroke="#9fd8ff" stroke-width="2"/>
    <path d="M82 86l-12 16 16-4zM118 86l12 16-16-4z" fill="#ff9a6b"/>
    <path d="M92 104c2 14 8 22 8 22s6-8 8-22" fill="#ffc36b" opacity=".9"/>`,
  landing: `<path d="M60 128h80" stroke="#cfd6e6" stroke-width="3" stroke-linecap="round"/>
    <rect x="80" y="70" width="40" height="28" rx="4" fill="url(#pg)" stroke="#e9f0ff" stroke-width="2"/>
    <path d="M84 98l-14 28M116 98l14 28M100 98v28" stroke="#e9f0ff" stroke-width="3"/>
    <path d="M100 40v22" stroke="#9fd8ff" stroke-width="2" stroke-dasharray="4 4"/>`,
  arrival: `<circle cx="100" cy="86" r="34" fill="url(#pg)" opacity=".9"/>
    <ellipse cx="100" cy="86" rx="58" ry="16" fill="none" stroke="#9fd8ff" stroke-width="2" stroke-dasharray="6 5"/>
    <rect x="146" y="76" width="10" height="8" fill="#ffd27a"/>`,
  milestone: `<path d="M100 36l14 30 32 4-24 22 6 32-28-15-28 15 6-32-24-22 32-4z" fill="url(#pg)" stroke="#e9f0ff" stroke-width="2"/>`,
  discovery: `<circle cx="90" cy="80" r="26" fill="none" stroke="#e9f0ff" stroke-width="4"/>
    <path d="M108 98l26 26" stroke="#e9f0ff" stroke-width="7" stroke-linecap="round"/>
    <circle cx="90" cy="80" r="18" fill="url(#pg)" opacity=".7"/>
    <path d="M140 40l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#ffd27a"/>`,
  anomaly: `<path d="M100 36l46 84H54z" fill="url(#pg)" stroke="#ffcf7a" stroke-width="3" stroke-linejoin="round"/>
    <path d="M100 66v28" stroke="#0b1230" stroke-width="7" stroke-linecap="round"/><circle cx="100" cy="106" r="4.5" fill="#0b1230"/>`,
  'lost-contact': `<path d="M70 110a42 42 0 0 1 60 0M80 98a28 28 0 0 1 40 0M90 86a14 14 0 0 1 20 0" fill="none" stroke="#e9f0ff" stroke-width="4" stroke-linecap="round" opacity=".55"/>
    <circle cx="100" cy="118" r="6" fill="#e9f0ff"/><path d="M64 52l72 72" stroke="#ff9f9f" stroke-width="5" stroke-linecap="round"/>`,
  end: `<path d="M84 128V40" stroke="#e9f0ff" stroke-width="4" stroke-linecap="round"/>
    <path d="M86 42h50l-10 16 10 16H86z" fill="url(#pg)" stroke="#e9f0ff" stroke-width="2"/>
    <path d="M60 128h80" stroke="#cfd6e6" stroke-width="3" stroke-linecap="round"/>`,
};

export function placeholderArt(type = 'milestone', accent = '#7fa6ff', label = STRINGS.noPhoto) {
  return `<div class="placeholder-art" role="img" aria-label="${esc(label)}">
    <svg viewBox="0 0 200 160" aria-hidden="true">
      <defs>
        <linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}" stop-opacity=".85"/><stop offset="1" stop-color="#1b2450" stop-opacity=".9"/></linearGradient>
        <pattern id="pdots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#fff" opacity=".18"/></pattern>
      </defs>
      <rect width="200" height="160" fill="url(#pdots)"/>
      ${ART[type] || ART.milestone}
    </svg>
    <span class="placeholder-caption">${esc(label)}</span>
  </div>`;
}

export const BODY_ACCENT = { moon: '#9fd8ff', mars: '#ff9a6b', 'deep-space': '#b9a5ff' };
