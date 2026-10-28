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

  // ------------------------------------------- 4. thí sinh tự do + mọi màn hình
  ok('không còn màn chọn vai trò / đơn vị', typeof renderRolePick === 'undefined' && typeof renderOrgPicker === 'undefined' && typeof renderRosterManage === 'undefined');
  ok('có hộp nhập tên thí sinh', typeof promptCandidateName === 'function');
  ok('không còn danh sách học viên trên thanh menu', !document.querySelector('#app-nav [data-key="roster"]'));
  const screens = ['start', 'hub', 'fillhub', 'gradehub', 'banks', 'history', 'sync', 'guide'];
  for (const name of screens) {
    await App.navigate(name);
    await wait(30);
    ok('màn ' + name, screenText().length > 20, screenText().length);
  }
  await App.navigate('start');
  ok('trang chủ ghi "thí sinh tự do"', /thí sinh tự do/i.test(screenText()), screenText().slice(0, 60));

  // ---------------------------------- 5. hộp nhập tên + làm bài trắc nghiệm
  const bank = banks[0];
  await App.navigate('setup', { bankId: bank.id });
  await wait(80);
  const startBtn = [...document.querySelectorAll('.screen-layer.visible .btn')].find((b) => /BẮT ĐẦU LÀM BÀI/i.test(b.textContent));
  ok('có nút bắt đầu làm bài', !!startBtn);
  startBtn.click();
  await wait(200);
  const nameInput = document.querySelector('#candidate-name');
  ok('bấm bắt đầu thì hỏi tên', !!nameInput);
  nameInput.value = 'ZZ Thí Sinh Web';
  nameInput.dispatchEvent(new Event('input', { bubbles: true }));
  const goBtn = [...document.querySelectorAll('.modal-footer .btn')].find((b) => /Vào làm bài/i.test(b.textContent));
  ok('hộp nhập tên có nút xác nhận', !!goBtn);
  goBtn.click();
  await wait(400);
  ok('tên được ghi nhớ', App.candidateName === 'ZZ Thí Sinh Web' && (await api.prefs()).studentName === 'ZZ Thí Sinh Web', App.candidateName);
  const realSession = App.session;
  ok('vào làm bài ngay sau khi nhập tên', !!realSession && realSession.questions.length > 0, realSession ? realSession.questions.length : 0);
  if (realSession) {
    realSession.questions.forEach((q, i) => { realSession.answers[i] = q.answer; });
    await App.finishQuiz(realSession);
    await wait(80);
  }
  await App.navigate('start');
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
  ok('lịch sử lưu đúng tên đã gõ', history.length >= 1 && history[0].studentName === 'ZZ Thí Sinh Web', history.length && history[0].studentName);
  ok('lịch sử không còn lớp/đơn vị', history.every((h) => !h.className && !h.battalion && !h.company));
  await App.navigate('history');
  await wait(60);
  ok('màn lịch sử hiện tên thí sinh', screenText().includes('ZZ Thí Sinh Web'));
  ok('màn lịch sử không có cột lớp', !/LỚP/.test(document.querySelector('.screen-layer.visible table') ? document.querySelector('.screen-layer.visible table').textContent : ''));

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

  // ------------------------------------------- 8. bảng điểm theo tên thí sinh
  await App.navigate('gradeboard', { kind: 'mcq', bankId: bank.id });
  await wait(120);
  ok('mở được bảng điểm theo tên', /bảng điểm/i.test(screenText()), screenText().slice(0, 50));
  ok('bảng điểm có tên thí sinh đã làm bài', screenText().includes('ZZ Thí Sinh Web'));
  ok('bảng điểm không có cột lớp', !/LỚP/.test(document.querySelector('.screen-layer.visible table') ? document.querySelector('.screen-layer.visible table').textContent : ''));

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
  ok('đủ 8 nút điều hướng', navButtons.length === 8, navButtons.length);
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

  // Chế độ giảng đường trên máy tính: vẫn đúng 4 ô (2 × 2)
  await App.startQuiz(bank.id, 4, 'stage', false, false, { id: 'free', name: 'ZZ Desktop' });
  await wait(160);
  {
    const opts = [...document.querySelectorAll('.stage-options .big-option')].map((o) => o.getBoundingClientRect());
    const cols2 = getComputedStyle(document.querySelector('.stage-options')).gridTemplateColumns.split(' ').filter(Boolean);
    const tops = [...new Set(opts.map((r) => Math.round(r.top)))];
    ok('giảng đường (máy tính) 4 ô 2 × 2', opts.length === 4 && cols2.length === 2 && tops.length === 2,
      cols2.length + ' cột, ' + tops.length + ' hàng');
  }
  await App.navigate('start');

  return results;
})()
`;

const MOBILE_SCRIPT = `
(async () => {
  const results = [];
  const ok = (name, pass, extra) => results.push({ name, pass: !!pass, extra: extra === undefined ? '' : String(extra) });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const vw = () => innerWidth;
  const vh = () => innerHeight;
  const screenEl = () => document.querySelector('.screen-layer.visible');
  const screenText = () => (screenEl() ? screenEl().textContent.trim() : '');
  const noPageOverflow = () => document.documentElement.scrollWidth <= vw() + 1;

  await window.__appReady;
  await document.fonts.ready;
  const banks = await api.allBanks();

  // ------------------------------------------------------- 1. màn hình cơ bản
  ok('bề rộng đúng khổ điện thoại', vw() <= 420, vw());
  await App.navigate('start');
  await wait(80);
  const header = document.querySelector('#app-header').getBoundingClientRect();
  const tools = document.querySelector('#web-tools').getBoundingClientRect();
  const nav = document.querySelector('#app-nav').getBoundingClientRect();
  ok('header không tràn ngang', header.right <= vw() + 1, Math.round(header.right) + '/' + vw());
  ok('công cụ web nằm trong màn hình', tools.right <= vw() + 1 && tools.width > 40, Math.round(tools.right));
  ok('menu chuyển xuống hàng riêng', nav.top >= tools.bottom - 2, Math.round(nav.top) + ' / ' + Math.round(tools.bottom));
  ok('menu cuộn ngang được thay vì tràn', getComputedStyle(document.querySelector('#app-nav')).overflowX !== 'visible');
  ok('không tràn ngang toàn trang', noPageOverflow(), document.documentElement.scrollWidth + '/' + vw());
  ok('nội dung chính đọc được', screenText().length > 20, screenText().length);
  ok('nút đủ to để bấm bằng ngón tay', [...document.querySelectorAll('#app-nav .nav-btn, #theme-switcher .theme-choice, #desktop-menu')]
    .every((b) => { const r = b.getBoundingClientRect(); return r.height >= 28 && r.width >= 28; }));

  // ------------------------------------- 2. CHẾ ĐỘ GIẢNG ĐƯỜNG: 4 ô, 2 × 2
  await App.startQuiz(banks[0].id, 4, 'stage', true, false, { id: 'free', name: 'ZZ Mobile' });
  await wait(220);
  const opts = [...document.querySelectorAll('.stage-options .big-option')];
  ok('giảng đường đủ 4 đáp án', opts.length === 4, opts.length);
  const cols = getComputedStyle(document.querySelector('.stage-options')).gridTemplateColumns.split(' ').filter(Boolean);
  ok('giảng đường dùng 2 cột (không xếp dọc)', cols.length === 2, cols.join(' | '));
  const rects = opts.map((o) => o.getBoundingClientRect());
  const rows = [...new Set(rects.map((r) => Math.round(r.top)))].sort((a, b) => a - b);
  ok('4 đáp án thành 2 hàng × 2 cột', rows.length === 2 && rects.filter((r) => Math.round(r.top) === rows[0]).length === 2,
    JSON.stringify(rects.map((r) => [Math.round(r.left), Math.round(r.top)])));
  ok('cả 4 đáp án nằm trong màn hình', rects.every((r) => r.right <= vw() + 1 && r.left >= -1 && r.bottom <= vh() + 1),
    JSON.stringify(rects.map((r) => [Math.round(r.bottom), vh()])));
  ok('giảng đường không phải cuộn dọc', document.documentElement.scrollHeight <= vh() + 2,
    document.documentElement.scrollHeight + '/' + vh());
  ok('ô đáp án đủ to để bấm', rects.every((r) => r.height >= 44 && r.width >= 60),
    JSON.stringify(rects.map((r) => Math.round(r.height) + 'x' + Math.round(r.width))));
  ok('chữ câu hỏi không tràn', document.querySelector('.stage-question').scrollWidth <= document.querySelector('.stage-question').clientWidth + 2);

  // Chữ đáp án: đủ lớn và nằm GIỮA ô (đúng yêu cầu người dùng)
  const textNodes = [...document.querySelectorAll('.stage-options .big-option .text')];
  const fontPx = parseFloat(getComputedStyle(textNodes[0]).fontSize);
  ok('chữ đáp án đủ lớn trên điện thoại', fontPx >= 16, fontPx + 'px');
  ok('chữ đáp án canh giữa', textNodes.every((n) => getComputedStyle(n).textAlign === 'center'));
  ok('chữ đáp án nằm giữa ô theo chiều dọc', textNodes.every((n, i) => {
    const tile = n.closest('.big-option').getBoundingClientRect();
    const box = n.getBoundingClientRect();
    return Math.abs((box.top + box.height / 2) - (tile.top + tile.height / 2)) <= 14;
  }), textNodes.map((n, i) => {
    const tile = n.closest('.big-option').getBoundingClientRect();
    const box = n.getBoundingClientRect();
    return Math.round(Math.abs((box.top + box.height / 2) - (tile.top + tile.height / 2)));
  }).join(','));
  ok('không tràn ngang ở chế độ giảng đường', noPageOverflow(), document.documentElement.scrollWidth + '/' + vw());

  // bấm một đáp án rồi sang câu tiếp — kiểm tra vẫn 2 cột
  opts[0].click();
  await wait(120);
  ok('bấm đáp án không làm vỡ bố cục', [...document.querySelectorAll('.big-option')].length === 4);
  const nextBtn = [...document.querySelectorAll('.stage-foot .btn')].find((b) => /Câu tiếp|Xem kết quả/i.test(b.textContent));
  if (nextBtn && !nextBtn.disabled) { nextBtn.click(); await wait(160); }
  ok('sau khi sang câu vẫn 2 cột', getComputedStyle(document.querySelector('.stage-options')).gridTemplateColumns.split(' ').filter(Boolean).length === 2);

  // Câu hỏi + đáp án DÀI: cho phép cuộn dọc, nhưng không được cắt chữ hay tràn ngang
  document.querySelector('.stage-question').textContent =
    'Câu hỏi rất dài để kiểm tra bố cục trên điện thoại: bệnh nhân nam 65 tuổi, tiền sử tăng huyết áp và đái tháo đường type 2, nhập viện vì khó thở khi gắng sức, phù hai chân, ran ẩm hai đáy phổi. Hãy chọn chẩn đoán phù hợp nhất.';
  document.querySelectorAll('.stage-options .big-option .text').forEach((node) => {
    node.textContent = 'Suy tim sung huyết mất bù kèm theo biến chứng thận mạn tính giai đoạn 3b';
  });
  await wait(140);
  const longOpts = [...document.querySelectorAll('.stage-options .big-option')];
  ok('câu dài: chữ trong đáp án không bị cắt',
    longOpts.every((o) => { const x = o.querySelector('.text'); return x.scrollHeight <= x.clientHeight + 2; }));
  ok('câu dài: vẫn 2 cột', getComputedStyle(document.querySelector('.stage-options')).gridTemplateColumns.split(' ').filter(Boolean).length === 2);
  ok('câu dài: không tràn ngang', noPageOverflow(), document.documentElement.scrollWidth + '/' + vw());

  // ------------------------------------------------ 3. LÀM BÀI CÁ NHÂN
  await App.navigate('start');
  await App.startQuiz(banks[0].id, 3, 'personal', false, false, { id: 'free', name: 'ZZ Mobile' });
  await wait(200);
  ok('cá nhân: có câu hỏi', !!document.querySelector('.q-text'), document.querySelectorAll('.option-row').length + ' lựa chọn');
  ok('cá nhân: không tràn ngang', noPageOverflow(), document.documentElement.scrollWidth + '/' + vw());
  ok('cá nhân: hai cột xếp dọc', getComputedStyle(document.querySelector('.personal-layout')).flexDirection === 'column',
    getComputedStyle(document.querySelector('.personal-layout')).flexDirection);
  const rowsOpt = [...document.querySelectorAll('.option-row')].map((o) => o.getBoundingClientRect());
  ok('cá nhân: lựa chọn đủ to', rowsOpt.every((r) => r.height >= 40), JSON.stringify(rowsOpt.map((r) => Math.round(r.height))));
  {
    const rowText = document.querySelector('.option-row .text');
    const rowFont = parseFloat(getComputedStyle(rowText).fontSize);
    ok('cá nhân: chữ đáp án đủ lớn', rowFont >= 15, rowFont + 'px');
  }

  // ------------------------------------------------- 4. HỘP NHẬP TÊN
  const pending = promptCandidateName(App);
  await wait(200);
  const card = document.querySelector('.modal-card');
  const cr = card.getBoundingClientRect();
  ok('hộp nhập tên vừa màn hình', cr.left >= -1 && cr.right <= vw() + 1 && cr.width >= 240,
    Math.round(cr.left) + '..' + Math.round(cr.right) + ' / ' + vw());
  ok('ô nhập tên đủ to', document.querySelector('#candidate-name').getBoundingClientRect().height >= 38);
  document.querySelectorAll('.modal-footer .btn')[0].click();
  await pending;
  await wait(80);
  ok('huỷ hộp nhập tên không lỗi', true);

  // ------------------------------------------------- 5. MỌI MÀN HÌNH
  // Rà từng màn như bộ audit: tràn ngang, chữ bị cắt, nút quá nhỏ.
  function auditScreen() {
    const layer = screenEl();
    if (!layer) return { clipped: ['không có màn'], small: [] };
    const clipped = [];
    [...layer.querySelectorAll('*')].forEach((node) => {
      if (!node.textContent.trim()) return;
      if (node.children.length && ![...node.childNodes].some((c) => c.nodeType === 3 && c.textContent.trim())) return;
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden') return;
      if (cs.textOverflow === 'ellipsis') return;
      if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') return;
      if (node.closest('.history-table-wrap') || node.closest('.stage-options') || node.closest('.stage-question')) return;
      if (node.scrollWidth > node.clientWidth + 2 && node.clientWidth > 0) {
        clipped.push(node.tagName.toLowerCase() + '.' + (String(node.className).split(' ')[0] || '') + ' "' + node.textContent.trim().slice(0, 24) + '"');
      }
    });
    const small = [...layer.querySelectorAll('button.btn, .nav-btn, .theme-choice')]
      .filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 30; })
      .map((b) => (b.textContent.trim().slice(0, 20) || 'icon') + ':' + Math.round(b.getBoundingClientRect().height));
    return { clipped: [...new Set(clipped)], small: [...new Set(small)] };
  }

  const screens = ['start', 'hub', 'fillhub', 'gradehub', 'banks', 'history', 'sync', 'guide'];
  for (const name of screens) {
    await App.navigate(name);
    await wait(90);
    ok('màn ' + name + ' không tràn ngang', noPageOverflow(), document.documentElement.scrollWidth + '/' + vw());
    ok('màn ' + name + ' có nội dung', screenText().length > 15, screenText().length);
    const audit = auditScreen();
    ok('màn ' + name + ': không cắt chữ', audit.clipped.length === 0, audit.clipped.slice(0, 3).join(' | '));
    ok('màn ' + name + ': nút đủ cao', audit.small.length === 0, audit.small.slice(0, 3).join(' | '));
  }

  // --------------------------------------- 6. THIẾT LẬP BÀI (chọn số câu)
  await App.navigate('setup', { bankId: banks[0].id });
  await wait(140);
  const countCards = [...document.querySelectorAll('.count-card')];
  ok('thiết lập: đủ các lựa chọn số câu', countCards.length >= 4, countCards.length);
  ok('thiết lập: không tràn ngang', noPageOverflow(), document.documentElement.scrollWidth + '/' + vw());
  const cc = countCards[0].getBoundingClientRect();
  ok('thiết lập: ô chọn số câu đủ to', cc.width >= 100 && cc.height >= 56, Math.round(cc.width) + 'x' + Math.round(cc.height));

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
  ok('giao diện vẫn dựng đủ', document.querySelectorAll('#app-nav .nav-btn').length >= 8, document.querySelectorAll('#app-nav .nav-btn').length);
  ok('font Fraunces vẫn nạp', document.fonts.check('600 32px Fraunces', 'Học viên'));
  ok('service worker đang điều khiển trang', !!navigator.serviceWorker.controller);
  const cacheNames = await caches.keys();
  const cached = await caches.open(cacheNames.find((n) => n.startsWith('tracnghiem-web-')) || cacheNames[0]);
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
    ['06-bang-diem', `App.navigate('gradehub')`],
    ['07-lich-su', `App.navigate('history')`],
    ['08-dong-bo', `App.navigate('sync')`],
    ['09-huong-dan', `App.navigate('guide')`],
  ];
  for (const [name, code] of steps) {
    try {
      await js(`(async()=>{ await ${code}; })()`);
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
