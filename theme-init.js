'use strict';
/**
 * theme-init.js (bản web) — chạy trong <head> TRƯỚC khi vẽ trang để không bị
 * "nháy" sang nền tối rồi mới đổi màu. Bản Electron nhận màu đã lưu qua
 * window.api.initialTheme; trình duyệt thì đọc thẳng localStorage.
 */
(function () {
  var THEMES = ['light', 'dark', 'purple', 'ocean', 'teal', 'amber', 'rose'];
  var BG = {
    light: '#F4F6FA', dark: '#101722', purple: '#080C18', ocean: '#0B1725',
    teal: '#0B1B1A', amber: '#1B1510', rose: '#1D121A',
  };
  var saved = null;
  try { saved = localStorage.getItem('tn-theme'); } catch (err) { /* chế độ riêng tư */ }
  var theme = THEMES.indexOf(saved) >= 0 ? saved : 'dark';
  document.documentElement.dataset.theme = theme;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', BG[theme]);
})();
