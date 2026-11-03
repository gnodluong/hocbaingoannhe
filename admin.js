'use strict';
/** Trang quan tri (/admin): dang nhap roi bat/tat bo de dang dung.
 *  Luu y: day la app tinh (GitHub Pages) nen mat khau chi kiem tra ngay tren trinh duyet
 *  (so sanh ma bam SHA-256) — chi la lop chan nguoi dung thuong, khong phai bao mat that su. */

const ADMIN_HASH = '95f0584a75d7774fdd04471cef27c685fa7d5c1616395905acd46090f6404ffe';
const ADMIN_SALT = 'tnthu-admin:';
const ADMIN_SESSION_KEY = 'tn-admin';

function isAdminRoute() {
  return location.hash.replace(/\/+$/, '') === '#/admin' || /\/admin\/?$/.test(location.pathname);
}

function adminSignedIn() {
  try { return sessionStorage.getItem(ADMIN_SESSION_KEY) === ADMIN_HASH; } catch (err) { return false; }
}

function adminSignOut() {
  try { sessionStorage.removeItem(ADMIN_SESSION_KEY); } catch (err) { /* bo qua */ }
}

async function adminSha256(text) {
  if (!(window.crypto && crypto.subtle)) throw new Error('Trình duyệt cần mở bằng https để đăng nhập.');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function renderAdmin(root, App) {
  root.appendChild(pageTitle({
    eyebrow: '🔐 Quản trị', title: 'Trang', hl: 'admin',
    subtitle: adminSignedIn()
      ? 'Chọn bộ đề đang dùng. Bật công tắc nào thì các môn của bộ đó được nạp vào máy này.'
      : 'Nhập mật khẩu admin để tiếp tục.',
  }));
  if (!adminSignedIn()) return renderAdminLogin(root, App);
  return renderAdminSets(root, App);
}

function renderAdminLogin(root, App) {
  const input = el('input', { class: 'input', attrs: { type: 'password', placeholder: 'Mật khẩu admin', autocomplete: 'current-password', 'aria-label': 'Mật khẩu admin' } });
  const msg = el('div', { class: 'muted-line mt8', style: { minHeight: '18px' } });
  const submit = async () => {
    try {
      const hash = await adminSha256(ADMIN_SALT + input.value);
      if (hash !== ADMIN_HASH) { msg.textContent = 'Sai mật khẩu.'; input.select(); return; }
      try { sessionStorage.setItem(ADMIN_SESSION_KEY, hash); } catch (err) { /* bo qua */ }
      App.navigate('admin');
    } catch (err) { msg.textContent = err.message; }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  const box = panel([
    el('div', { style: { fontSize: '13px', fontWeight: 800 }, text: 'Đăng nhập admin' }),
    el('div', { class: 'mt12' }, [input]),
    msg,
    el('div', { class: 'mt12' }, [btn('Đăng nhập', submit, { kind: 'primary' })]),
  ]);
  box.style.maxWidth = '420px';
  root.appendChild(box);
  setTimeout(() => input.focus(), 50);
}

async function renderAdminSets(root, App) {
  const info = await App.api.sampleSets();
  const active = await App.api.activeSampleSet();
  const banks = await App.api.allBanks();

  const list = el('div', { class: 'mt14' });
  let busy = false;

  info.sets.forEach((set) => {
    const count = banks.filter((b) => b.source === 'sample' && (b.sampleSet || 'goc') === set.id).length;
    const isActive = set.id === active;
    const node = el('div', {
      class: `toggle${isActive ? ' on' : ''}`,
      attrs: { role: 'switch', tabindex: '0', 'aria-checked': String(isActive), 'aria-label': `Dùng ${set.name}` },
    }, [el('div', { class: 'knob' })]);
    const choose = async () => {
      if (busy || isActive) return;
      busy = true;
      try {
        const res = await App.api.switchSampleSet(set.id);
        toast(`Đã chuyển sang "${set.name}" (nạp ${res.added} môn, gỡ ${res.removed} môn của bộ cũ)`, 'ok');
        await App.navigate('admin');
      } catch (err) {
        toast(err.message, 'err');
      }
      busy = false;
    };
    node.addEventListener('click', choose);
    node.addEventListener('keydown', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); choose(); } });
    list.appendChild(panel([
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '14px' } }, [
        node,
        el('div', { style: { flex: '1' } }, [
          el('div', { style: { fontSize: '14px', fontWeight: 800 }, text: set.name + (isActive ? ' · đang dùng' : '') }),
          el('div', { class: 'muted-line mt4', text: set.desc || '' }),
        ]),
        chipEl(isActive ? `${count} môn đang nạp` : 'Tắt'),
      ]),
    ], { classes: 'mt10' }));
  });
  root.appendChild(list);
  root.appendChild(el('div', { class: 'muted-line mt14',
    text: 'Công tắc chỉ đổi bộ đề trên trình duyệt/thiết bị đang mở trang này (môn bạn tự nhập vẫn được giữ). Điểm và lịch sử cũ không bị xoá.' }));
  root.appendChild(el('div', { class: 'mt14', style: { display: 'flex', gap: '8px' } }, [
    btn('Đăng xuất', () => { adminSignOut(); App.navigate('admin'); }, { kind: 'ghost', small: true }),
    btn('Về trang chủ', () => {
      history.replaceState(null, '', location.pathname.replace(/admin\/?$/, '') + location.search);
      App.navigate('start');
    }, { kind: 'ghost', small: true }),
  ]));
}
