'use strict';
/**
 * Bo icon SVG ve tay — khong dung emoji nen khong bao gio vo/thieu glyph
 * tren bat ky may nao, nhin nhat quan va "chuan" hon.
 */
const ICONS = {
  home: '<path d="M4 11.5 12 4l8 7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  check: '<path d="M4 12.5 9.5 18 20 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  pencil: '<path d="M4 20l.9-4.2L15.6 5.1a1.5 1.5 0 0 1 2.1 0l1.2 1.2a1.5 1.5 0 0 1 0 2.1L8.2 19.1 4 20Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 7l3 3" stroke="currentColor" stroke-width="1.8"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5v-13Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5a2.5 2.5 0 0 0 2.5-2.5v-13Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  chart: '<path d="M4 20V10M11 20V4M18 20v-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  download: '<path d="M12 4v12M7 11l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  trash: '<path d="M5 7h14M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7 7l1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>',
  play: '<path d="M6 4.5v15l14-7.5Z" fill="currentColor"/>',
  close: '<path d="M5 5l14 14M19 5 5 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 20l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  plus: '<path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/>',
  clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.5V12l3.2 2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  target: '<circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="1.1" fill="currentColor"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M6.5 10h.01M9.5 10h.01M12.5 10h.01M15.5 10h.01M6.5 14h11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  cursor: '<path d="M6 4l12 6.2-5 1.3-1.3 5L6 4Z" fill="currentColor"/>',
  screen: '<rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M9 20h6M12 16v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  notes: '<rect x="4" y="3" width="16" height="18" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>',
  flag: '<path d="M6 3v18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M6 4h11l-2.5 3.5L17 11H6Z" fill="currentColor"/>',
  stethoscope: '<path d="M6 3v6a4 4 0 0 0 8 0V3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10 13v2a5 5 0 0 0 10 0v-1.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="20.5" cy="12.7" r="1.6" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="6" cy="3" r="1.2" fill="currentColor"/><circle cx="10" cy="3" r="1.2" fill="currentColor"/>',
  folder: '<path d="M3 7a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>',
};

function icon(name, size = 16) {
  const body = ICONS[name] || ICONS.notes;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none">${body}</svg>`;
}
