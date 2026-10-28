/**
 * desktop-web.js — Thay cho desktop.js của bản Electron.
 *
 * Bản desktop có thanh tiêu đề hệ điều hành, nút thu nhỏ/phóng to/đóng và menu
 * ứng dụng của Windows. Bản web không có những thứ đó, nên tệp này dựng phần
 * "chrome" tương đương cho trình duyệt:
 *   · bộ chuyển giao diện (giữ nguyên như bản desktop)
 *   · nút "Dữ liệu" mở bảng quản lý dữ liệu trong trình duyệt
 *   · nút "Cài đặt app" khi trình duyệt cho phép cài đặt PWA
 *   · đăng ký service worker để mở lại khi không có mạng
 */
'use strict';

function buildDesktopChrome(App) {
  buildThemeSwitcher(App);

  document.getElementById('desktop-menu').innerHTML = icon('notes', 16);
  document.getElementById('desktop-menu').addEventListener('click', () => openDataMenu(App));

  // Vùng #window-controls của bản desktop được dùng lại cho nút cài đặt PWA.
  const host = document.getElementById('window-controls');
  if (host) host.innerHTML = '';
  let installEvent = null;
  const installBtn = el('button', {
    class: 'web-install',
    attrs: { type: 'button', title: 'Cài app vào máy để mở nhanh như ứng dụng' },
    html: icon('download', 14) + '<span>Cài đặt app</span>',
    on: {
      click: async () => {
        if (!installEvent) return;
        installEvent.prompt();
        const choice = await installEvent.userChoice;
        if (choice && choice.outcome === 'accepted') installBtn.remove();
        installEvent = null;
      },
    },
  });
  installBtn.hidden = true;
  if (host) host.appendChild(installBtn);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installEvent = event;
    installBtn.hidden = false;
  });
  window.addEventListener('appinstalled', () => installBtn.remove());

  App.api.onNavigate((key) => App.navigate(key));

  const nav = document.getElementById('app-nav');
  new ResizeObserver(fitHeaderNav).observe(nav);
  document.fonts.ready.then(fitHeaderNav);

  App.api.info().then((info) => {
    document.getElementById('header-version').textContent = `Phiên bản ${info.version} · Web · Offline`;
  }).catch(() => {});

  registerServiceWorker();
}

function fitHeaderNav() {
  const nav = document.getElementById('app-nav');
  if (!nav) return;
  const buttons = [...nav.querySelectorAll('.nav-btn')];
  buttons.forEach((b) => b.classList.remove('nav-compact'));
  const gap = parseFloat(getComputedStyle(nav).gap) || 0;
  const width = () => buttons.reduce((sum, b) => sum + b.getBoundingClientRect().width, 0) + gap * Math.max(0, buttons.length - 1);
  for (const key of ['guide', 'sync', 'start', 'banks', 'gradehub', 'fillhub', 'hub', 'history']) {
    if (width() <= nav.clientWidth) break;
    nav.querySelector(`[data-key="${key}"]`)?.classList.add('nav-compact');
  }
}

function updateDesktopContext(App, name) {
  const label = {
    start: 'Ôn luyện', hub: 'Trắc nghiệm', setup: 'Thiết lập bài',
    fillhub: 'Điền chỗ trống', fillsetup: 'Thiết lập bài', banks: 'Ngân hàng đề', filleditor: 'Biên soạn đề',
    history: 'Lịch sử', gradehub: 'Bảng điểm', gradeboard: 'Bảng điểm',
    sync: 'Đồng bộ', guide: 'Hướng dẫn',
  };
  const node = document.getElementById('desktop-context');
  // Bản web: chỉ có tên thí sinh, không có lớp/đơn vị.
  if (node) node.textContent = [App.candidateName || '', label[name] || 'Làm bài'].filter(Boolean).join(' / ');
}

/* ------------------------------------------------------------- menu dữ liệu */
async function openDataMenu(App) {
  const estimate = await App.api.web.storageEstimate();
  const used = formatBytes(estimate.usage);
  const quota = formatBytes(estimate.quota);

  const open = (fn) => () => { close(); fn(); };
  let close = () => {};

  const body = el('div', { class: 'col g10' }, [
    el('div', { class: 'data-meter' }, [
      el('div', { class: 'data-meter-label', text: 'Dữ liệu đang lưu trên máy này' }),
      el('div', { class: 'data-meter-value', text: `${used} / ${quota}` }),
      el('div', { class: 'data-meter-hint', text: 'Toàn bộ đề, học viên và lịch sử nằm trong bộ nhớ của trình duyệt (IndexedDB) trên chính máy này. Không có dữ liệu nào gửi lên mạng.' }),
    ]),
    el('div', { class: 'data-actions' }, [
      btn('Xuất / nhập dữ liệu', open(() => App.navigate('sync')), { kind: 'primary', iconName: 'download', block: true }),
      btn('Nạp lại đề mẫu', open(async () => {
        const result = await App.api.seedSamples();
        App.navigate('banks');
        toast(result.added ? `Đã nạp ${result.added} đề mẫu` : 'Đề mẫu đã có đủ', 'ok');
      }), { kind: 'ghost', iconName: 'book', block: true }),
      btn('Xoá toàn bộ dữ liệu', open(async () => {
        const ok = await confirmDialog(
          'Xoá toàn bộ dữ liệu?',
          'Toàn bộ đề trắc nghiệm, đề điền chỗ trống, danh sách học viên và lịch sử làm bài sẽ bị xoá khỏi trình duyệt này. Nên "Xuất dữ liệu" để sao lưu trước.',
          { confirmLabel: 'Xoá hết', danger: true }
        );
        if (!ok) return;
        await App.api.web.wipe();
        const result = await App.api.seedSamples();
        toast(`Đã xoá dữ liệu và nạp lại ${result.added} đề mẫu`, 'ok');
        App.navigate('start');
      }), { kind: 'danger', iconName: 'trash', block: true }),
    ]),
    el('div', { class: 'data-note' }, [
      el('b', { text: 'Lưu ý: ' }),
      document.createTextNode('xoá dữ liệu trình duyệt (cookie/trang web) cũng làm mất dữ liệu app. Hãy xuất file .txt để sao lưu định kỳ, và mang file đó sang máy khác để làm việc tiếp.'),
    ]),
  ]);

  openModal({
    title: 'Dữ liệu của app',
    subtitle: 'Bản web lưu dữ liệu ngay trong trình duyệt của bạn.',
    width: 520,
    body,
    footer: (footer, done) => {
      close = done;
      footer.appendChild(btn('Đóng', done, { kind: 'ghost' }));
    },
  });
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------- service worker */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Chỉ bật khi chạy qua http(s): mở file:// trực tiếp sẽ không đăng ký được.
  if (!/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js').catch((err) => {
    console.warn('Không đăng ký được service worker:', err.message);
  });
}
