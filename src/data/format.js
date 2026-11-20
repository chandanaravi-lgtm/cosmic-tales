import { STRINGS } from '../config/app.config.js';

/** Value of a data field or the graceful fallback (Hard Rule #1). */
export function fieldValue(field) {
  return field && field.value != null && field.value !== '' ? field.value : null;
}

export function displayValue(field) {
  return fieldValue(field) ?? STRINGS.dataNotAvailable;
}

/** Escape text before putting it into innerHTML templates. */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** "Year abandoned" if the data has one, otherwise the status line. */
export function abandonedLine(machine) {
  const a = machine.abandoned;
  if (a?.value) return { label: STRINGS.card.abandoned, value: a.note ? `${a.value} · ${a.note}` : a.value, status: a.status };
  if (a?.status) return { label: STRINGS.card.status, value: STRINGS.status[a.status] || a.status, status: a.status };
  return { label: STRINGS.card.status, value: STRINGS.dataNotAvailable, status: null };
}

export function statusLabel(machine) {
  const s = machine.abandoned?.status;
  return s ? STRINGS.status[s] || s : STRINGS.dataNotAvailable;
}

/** Short machine code printed on the card, e.g. "CT-MOON-SURV3-67". */
export function machineCode(m) {
  const body = { moon: 'MOON', mars: 'MARS', 'deep-space': 'DEEP' }[m.body] || 'SPCE';
  const nm = m.id.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
  const yr = (m.launchDate?.iso || '').slice(2, 4) || '00';
  return `CT-${body}-${nm}-${yr}`;
}

export function launchYear(m) {
  return (m.launchDate?.iso || '').slice(0, 4) || null;
}
