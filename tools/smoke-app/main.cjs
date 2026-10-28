/**
 * smoke-main.cjs — Cửa sổ Chromium (Electron chạy như trình duyệt thuần, KHÔNG
 * bật Node cho trang web) mở bản TracNghiem-Web và tự chạy một kịch bản kiểm
 * thử đầu-cuối, in kết quả ra stdout để tools/web-smoke.mjs đọc.
 *
 * Dùng tham số: electron tools/smoke-main.cjs <url>
 */
'use strict';

const { app, BrowserWindow } = require('electron');

// Hồ sơ trình duyệt riêng cho mỗi lần kiểm thử: IndexedDB + cache service worker
// nằm trong thư mục tạm này, KHÔNG đụng dữ liệu thật và không tích luỹ giữa các lần chạy.
if (process.env.TN_PROFILE_DIR) {
  try {
    app.setPath('userData', process.env.TN_PROFILE_DIR);
    app.setPath('sessionData', process.env.TN_PROFILE_DIR);
  } catch (err) {
    console.log('SMOKE_WARN không đặt được thư mục hồ sơ: ' + err.message);
  }
}

const url = process.argv.find((a) => a.startsWith('http://') || a.startsWith('https://'));
const consoleErrors = [];

const TEST_SCRIPT = `
(async () => {
  const results = [];
  const ok = (name, pass, extra) => results.push({ name, pass: !!pass, extra: extra === undefined ? '' : String(extra) });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const screenText = () => {
    const vis = document.querySelector('.screen-layer.visible');
    return vis ? vis.textContent.trim() : '';
  };

  await window.__appReady;
  await document.fonts.ready;

  // ---------------------------------------------------------------- 1. nền tảng
  ok('api trình duyệt tồn tại', typeof window.api === 'object' && typeof api.allBanks === 'function');
  ok('quiz-core nạp được', typeof window.QuizCore === 'object' && typeof QuizCore.parseQuestions === 'function');
  ok('store nạp được', !!window.TNStore && typeof TNStore.allBanks === 'function');

  // ------------------------------------------------------- 2. nạp đề mẫu .txt
  const banks = await api.allBanks();
  ok('nạp đề mẫu', banks.length >= 7, 'banks=' + banks.length);
  ok('mỗi đề có câu hỏi', banks.every((b) => b.questions.length > 0), banks.map((b) => b.id + ':' + b.questions.length).join(' '));
  ok('câu hỏi đủ 4 lựa chọn', banks.every((b) => b.questions.every((q) => q.options.length === 4 && q.options.every((o) => String(o).trim()))));

  // ------------------------------------------------------------ 3. giao diện
  const setOcean = await api.theme.set('ocean');
  ok('đổi giao diện', setOcean === 'ocean' && document.documentElement.dataset.theme === 'ocean');
  ok('giao diện được lưu', (await api.prefs()).desktopTheme === 'ocean');
  await api.theme.set('dark');

  // ------------------------------------------------------------ 4. mọi màn hình
  App.role = 'student';
  App.org = { battalion: 'Tiểu Đoàn 2', company: 'Đại Đội 5', className: 'NVQYc43.A9' };
  const screens = ['start', 'hub', 'fillhub', 'gradehub', 'banks', 'roster', 'history', 'sync', 'guide'];
  for (const name of screens) {
    await App.navigate(name);
    await wait(30);
    ok('màn ' + name, screenText().length > 20, screenText().length);
  }

  // --------------------------------------------------- 5. làm bài trắc nghiệm
  const bank = banks[0];
  await App.navigate('start');
  await App.startQuiz(bank.id, 5, 'personal', true, false, { name: 'ZZ Web Test', id: 's-zz-web' });
  await wait(60);
  const session = App.session;
  ok('tạo được phiên làm bài', !!session && session.questions.length > 0, session ? session.questions.length : 0);
  if (session) {
    session.questions.forEach((q, i) => { session.answers[i] = q.answer; });
    await App.finishQuiz(session);
    await wait(60);
    ok('màn kết quả trắc nghiệm', /kết quả/i.test(screenText()), screenText().slice(0, 60));
  }
  const history = await api.history();
  ok('ghi lịch sử bài trắc nghiệm', history.length >= 1 && history[0].studentName === 'ZZ Web Test', history.length && history[0].studentName);

  // ------------------------------------------------------ 6. điền vào chỗ trống
  const fillBank = await api.upsertFillBank({
    name: 'ZZ Web Fill',
    subject: 'Kiểm thử',
    questions: [
      { text: 'Huyết áp bình thường là {{120}}/{{80}} mmHg.' },
      { text: 'Tim người bình thường có {{4}} ngăn.' },
    ],
  });
  await App.startFillQuiz(fillBank.id, 2, 'type', { name: 'ZZ Web Fill Test', id: 's-zz-fill' });
  await wait(60);
  const fillSession = App.fillSession;
  ok('tạo được phiên điền chỗ trống', !!fillSession && fillSession.total === 2, fillSession ? fillSession.total : 0);
  if (fillSession) {
    fillSession.questions.forEach((q, qi) => q.blanks.forEach((ans, bi) => { fillSession.answers[qi][bi] = ans; }));
    ok('chấm điểm chỗ trống đúng', fillSession.correct() === fillSession.total, fillSession.correct() + '/' + fillSession.total);
    await App.finishFillQuiz(fillSession);
    await wait(60);
    ok('màn kết quả điền chỗ trống', screenText().length > 20, screenText().slice(0, 60));
  }
  await api.removeFillBank(fillBank.id);

  // ------------------------------------------------------------- 7. CRUD ngân hàng
  const made = await api.upsertBank({ name: 'ZZ Web Bank', questions: [{ text: '1 + 1 = ?', options: ['1', '2', '3', '4'], answer: 1 }] });
  ok('tạo đề mới', !!made.id && (await api.getBank(made.id)).name === 'ZZ Web Bank');
  ok('slug id tiếng Việt', made.id === 'zz-web-bank', made.id);
  await api.removeBank(made.id);
  ok('xoá đề', !(await api.getBank(made.id)));

  // ------------------------------------------------------------ 8. học viên
  const parsed = await api.parseRoster('Tiểu Đoàn 2 | Đại Đội 5 | ZZ.Lop | Học viên Web');
  const addedStudents = await api.importStudents(parsed.students);
  ok('nhập danh sách học viên', addedStudents === 1, addedStudents);
  const inClass = await api.studentsIn('Tiểu Đoàn 2', 'Đại Đội 5', 'ZZ.Lop');
  ok('lọc học viên theo lớp', inClass.length === 1, inClass.length);
  const again = await api.importStudents(parsed.students);
  ok('nhập trùng không nhân bản', again === 0, again);

  // ------------------------------------------------- 9. xuất / nhập toàn bộ dữ liệu
  const dump = await api.exportAll();
  let parsedDump = null;
  try { parsedDump = JSON.parse(dump); } catch (err) { parsedDump = null; }
  ok('xuất dữ liệu ra chuỗi', !!parsedDump && parsedDump.kind === 'tracnghiem-backup' && parsedDump.banks.length >= 7, parsedDump ? dump.length : 0);
  const imported = await api.importAll(dump);
  ok('nhập lại dữ liệu', imported.ok === true, JSON.stringify(imported));
  const bad = await api.importAll('khong-phai-json');
  ok('chặn file sai định dạng', bad.ok === false && !!bad.error);

  // ------------------------------------------------------ 10. hàm tệp của trình duyệt
  ok('có hàm chọn tệp / lưu tệp', typeof api.openTxtFiles === 'function' && typeof api.saveTxt === 'function');

  // ------------------------------------------------------------- 11. PWA
  ok('có manifest', !!document.querySelector('link[rel="manifest"]'));
  let swOk = false;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    swOk = regs.length > 0;
  } catch (err) { swOk = false; }
  ok('đăng ký service worker', swOk);
  ok('có icon cài đặt', !!document.querySelector('link[rel="apple-touch-icon"]'));

  // --------------------------------------------- 12. bố cục header của bản web
  // Bản web gộp công cụ vào header thay vì thanh tiêu đề Windows.
  const header = document.querySelector('#app-header').getBoundingClientRect();
  const nav = document.querySelector('#app-nav').getBoundingClientRect();
  const tools = document.querySelector('#web-tools').getBoundingClientRect();
  const navButtons = [...document.querySelectorAll('#app-nav .nav-btn')];
  ok('không còn thanh tiêu đề giả', !document.querySelector('#desktop-titlebar'));
  ok('đủ 9 nút điều hướng', navButtons.length >= 9, navButtons.length);
  ok('nút điều hướng nằm trong khung nhìn', navButtons.every((b) => {
    const r = b.getBoundingClientRect();
    return r.width > 0 && r.left >= 0 && r.right <= innerWidth + 0.5;
  }));
  ok('công cụ web không đè lên menu', nav.right <= tools.left + 1, Math.round(nav.right) + ' <= ' + Math.round(tools.left));
  ok('header và công cụ cùng một hàng',
    Math.abs((header.top + header.height / 2) - (tools.top + tools.height / 2)) < 8 &&
      tools.bottom <= header.bottom + 1 && tools.top >= header.top - 1,
    [Math.round(tools.top), Math.round(tools.bottom), Math.round(header.top), Math.round(header.bottom)].join(','));
  ok('có công tắc giao diện', document.querySelectorAll('#theme-switcher .theme-choice').length >= 3);
  ok('không tràn ngang', document.documentElement.scrollWidth <= innerWidth + 1, document.documentElement.scrollWidth + '/' + innerWidth);
  ok('nút trong header đủ to để bấm', [...document.querySelectorAll('#app-nav .nav-btn, #theme-switcher .theme-choice, #desktop-menu')]
    .every((b) => { const r = b.getBoundingClientRect(); return r.height >= 28 && r.width >= 30; }));
  ok('tiêu đề tab đúng tên app', /Trắc Nghiệm/.test(document.title) && document.title.includes('Đại Đội 5'), document.title);

  // ------------------------------------------------------- 13. không lỗi hiển thị
  ok('không có lỗi hiển thị', !window.__lastRenderError, window.__lastRenderError || '');

  return results;
})()
`;

const MOBILE_SCRIPT = `
(async () => {
  const results = [];
  const ok = (name, pass, extra) => results.push({ name, pass: !!pass, extra: extra === undefined ? '' : String(extra) });
  await window.__appReady;
  await document.fonts.ready;
  App.role = 'student';
  App.org = { battalion: 'Tiểu Đoàn 2', company: 'Đại Đội 5', className: 'NVQYc43.A9' };
  await App.navigate('start');
  await new Promise((r) => setTimeout(r, 80));

  const vw = innerWidth;
  const header = document.querySelector('#app-header').getBoundingClientRect();
  const tools = document.querySelector('#web-tools').getBoundingClientRect();
  const nav = document.querySelector('#app-nav').getBoundingClientRect();
  const screen = document.querySelector('.screen-layer.visible');

  ok('bề rộng đúng khổ điện thoại', vw <= 420, vw);
  ok('header không tràn ngang', header.right <= vw + 1, Math.round(header.right) + '/' + vw);
  ok('công cụ web nằm trong màn hình', tools.right <= vw + 1 && tools.width > 40, Math.round(tools.right));
  ok('menu chuyển xuống hàng riêng', nav.top >= tools.bottom - 2 || nav.width > vw * 0.8, Math.round(nav.top) + ' / ' + Math.round(tools.bottom));
  ok('menu cuộn ngang được thay vì tràn', getComputedStyle(document.querySelector('#app-nav')).overflowX !== 'visible');
  ok('không tràn ngang toàn trang', document.documentElement.scrollWidth <= vw + 1, document.documentElement.scrollWidth + '/' + vw);
  ok('nội dung chính đọc được', !!screen && screen.textContent.trim().length > 20, screen ? screen.textContent.trim().length : 0);
  ok('nút đủ to để bấm bằng ngón tay', [...document.querySelectorAll('#app-nav .nav-btn, #theme-switcher .theme-choice, #desktop-menu')]
    .every((b) => { const r = b.getBoundingClientRect(); return r.height >= 28 && r.width >= 28; }));
  ok('chữ không tràn ra ngoài thẻ', [...document.querySelectorAll('.screen-layer.visible .panel, .screen-layer.visible .mode-card')]
    .every((n) => n.scrollWidth <= n.clientWidth + 2));

  await App.navigate('banks');
  await new Promise((r) => setTimeout(r, 120));
  ok('màn ngân hàng đề không tràn ngang', document.documentElement.scrollWidth <= vw + 1, document.documentElement.scrollWidth + '/' + vw);

  return results;
})()
`;

const OFFLINE_SCRIPT = `
(async () => {
  const results = [];
  const ok = (name, pass, extra) => results.push({ name, pass: !!pass, extra: extra === undefined ? '' : String(extra) });
  await window.__appReady;
  await document.fonts.ready;
  ok('mở được khi KHÔNG có mạng', true);
  const banks = await api.allBanks();
  ok('đề vẫn còn trong máy', banks.length >= 7, 'banks=' + banks.length);
  ok('giao diện vẫn dựng đủ', document.querySelectorAll('#app-nav .nav-btn').length >= 9, document.querySelectorAll('#app-nav .nav-btn').length);
  ok('font Fraunces vẫn nạp', document.fonts.check('600 32px Fraunces', 'Học viên'));
  ok('service worker đang điều khiển trang', !!navigator.serviceWorker.controller);
  const cached = await caches.open('tracnghiem-web-v1.1.3');
  const keys = await cached.keys();
  ok('cache offline có vỏ app', keys.some((r) => r.url.endsWith('index.html')));
  ok('cache offline có đề mẫu', keys.some((r) => r.url.includes('/samples/') && r.url.endsWith('.txt')), keys.filter((r) => r.url.includes('/samples/')).length);
  await App.navigate('start');
  await new Promise((r) => setTimeout(r, 120));
  const vis = document.querySelector('.screen-layer.visible');
  ok('điều hướng màn hình khi offline', !!vis && vis.textContent.trim().length > 20);
  return results;
})()
`;

function run() {
  const phase = process.env.TN_SMOKE_PHASE === 'offline' ? 'offline' : process.env.TN_SMOKE_PHASE === 'mobile' ? 'mobile' : 'full';
  const win = new BrowserWindow({
    width: phase === 'mobile' ? 390 : 1440,
    height: phase === 'mobile' ? 844 : 900,
    show: Boolean(process.env.TN_SHOTS),
    backgroundColor: '#101722',
    webPreferences: {
      // Cố tình KHÔNG bật nodeIntegration / preload: đây phải là môi trường
      // trình duyệt thuần, đúng như người dùng mở bằng Chrome hay Edge.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  win.webContents.on('console-message', (_event, level, message) => {
    if (level >= 2) consoleErrors.push(message);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.log('SMOKE_FATAL ' + JSON.stringify({ reason: 'render-process-gone', details }));
    app.exit(1);
  });
  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.log('SMOKE_FATAL ' + JSON.stringify({ reason: 'did-fail-load', code, desc }));
    app.exit(1);
  });

  win.loadURL(url);

  win.webContents.on('did-finish-load', async () => {
    try {
      const script = phase === 'offline' ? OFFLINE_SCRIPT : phase === 'mobile' ? MOBILE_SCRIPT : TEST_SCRIPT;
      const results = await win.webContents.executeJavaScript(script, true);
      if (phase === 'full' && process.env.TN_SHOTS) {
        try { await captureScreens(win); } catch (err) { console.log('SHOT_ERROR capture ' + String((err && err.message) || err)); }
      }
      const failed = results.filter((r) => !r.pass);
      console.log(
        'SMOKE_RESULT ' +
          JSON.stringify({
            phase,
            total: results.length,
            passed: results.length - failed.length,
            failed,
            results,
            consoleErrors,
          })
      );
      app.exit(failed.length ? 1 : 0);
    } catch (err) {
      console.log('SMOKE_FATAL ' + JSON.stringify({ reason: 'script', message: String(err && err.stack ? err.stack : err), consoleErrors }));
      app.exit(1);
    }
  });
}

/** Chụp vài màn hình chính để rà giao diện (dùng khi đặt biến TN_SHOTS). */
async function captureScreens(win) {
  const fs = require('fs');
  const path = require('path');
  const { app } = require('electron');
  const dir = process.env.TN_SHOTS;
  fs.mkdirSync(dir, { recursive: true });
  const js = (code) => win.webContents.executeJavaScript(code, true);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const shot = async (name) => {
    await wait(450);
    const image = await win.webContents.capturePage();
    const file = path.join(dir, `${name}.png`);
    fs.writeFileSync(file, image.toPNG());
    console.log('SHOT ' + file);
  };
  const steps = [
    ['01-vai-tro', `App.navigate('role')`],
    ['02-chon-lop', `App.navigate('orgpick')`],
    ['03-trang-chu', `App.navigate('start')`],
    ['04-trac-nghiem', `App.navigate('hub')`],
    ['05-ngan-hang-de', `App.navigate('banks')`],
    ['06-hoc-vien', `App.navigate('roster')`],
    ['07-lich-su', `App.navigate('history')`],
    ['08-dong-bo', `App.navigate('sync')`],
    ['09-huong-dan', `App.navigate('guide')`],
  ];
  for (const [name, code] of steps) {
    try {
      await js(`(async()=>{ if(!App.role) App.role='student'; if(!App.org) App.org={battalion:'Tiểu Đoàn 2',company:'Đại Đội 5',className:'NVQYc43.A9'}; await ${code}; })()`);
      await shot(name);
    } catch (err) {
      console.log('SHOT_ERROR ' + name + ' ' + String((err && err.message) || err));
    }
  }
  try {
    // Bề rộng điện thoại để kiểm tra bố cục nhỏ
    win.setSize(390, 844);
    await js(`App.navigate('start')`);
    await shot('10-dien-thoai-trang-chu');
    await js(`App.navigate('banks')`);
    await shot('11-dien-thoai-ngan-hang');
    win.setSize(1440, 900);

    // Giao diện SÁNG (một trong 7 bảng màu của app)
    await js(`api.theme.set('light')`);
    await js(`App.navigate('start')`);
    await shot('12-giao-dien-sang-trang-chu');
    await js(`App.navigate('hub')`);
    await shot('13-giao-dien-sang-trac-nghiem');
    await js(`api.theme.set('dark')`);
    await js(`App.navigate('start')`);
  } catch (err) {
    console.log('SHOT_ERROR nhom-cuoi ' + String((err && err.message) || err));
  }
}

app.whenReady().then(run);
