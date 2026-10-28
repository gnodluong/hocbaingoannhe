'use strict';
/** Trang chu chon che do, hub trac nghiem, thiet lap bai lam, lich su. */

const COUNT_CHOICES = [50, 70, 90];

// ================================================================= MODE HUB
async function renderModeHub(root, App) {
  if (!(await requireOrg(App))) return;
  const banks = await App.api.allBanks();
  const fillBanks = await App.api.allFillBanks();
  const history = await App.api.history();

  const { battalion, company, className } = App.org;
  const crumbs = el('div', { class: 'row gap8 wrap mt8', style: { marginBottom: '4px' } });
  const changeChip = chipEl('Đổi lớp', { onClick: () => App.navigate('orgpick') });
  changeChip.classList.add('clickable');
  crumbs.append(
    chipEl(App.role === 'student' ? 'Học viên' : 'Giảng viên', { tone: 'active' }),
    chipEl(`${battalion} · ${company} · ${className}`),
    changeChip,
  );
  root.appendChild(crumbs);

  root.appendChild(pageTitle({
    eyebrow: '🩺 Ôn luyện quân y · NVQYc43', title: 'Chọn', hl: 'hình thức ôn luyện',
    subtitle: 'Chọn một trong hai hình thức bên dưới. Toàn bộ dữ liệu lưu ngay trong thư mục app, không cần Internet.',
  }));

  const grid = el('div', { class: 'mode-hub-grid' });
  grid.appendChild(modeCard('check', 'var(--accent)', 'Trắc nghiệm', `${banks.length} môn học sẵn sàng`,
    'Chọn đáp án đúng A · B · C · D. Có chế độ trình chiếu giảng đường và chế độ tự luyện cá nhân có tính giờ.',
    () => App.navigate('hub')));
  grid.appendChild(modeCard('pencil', 'var(--accent-2)', 'Điền vào chỗ trống', `${fillBanks.length} bộ đề sẵn sàng`,
    'Gõ đáp án bằng bàn phím hoặc kéo thả từ có sẵn vào đúng chỗ trống. Lọc đề theo môn học, tự tải đề lên bằng file mẫu.',
    () => App.navigate('fillhub')));
  root.appendChild(grid);

  root.appendChild(sectionHead('Tổng quan'));
  const stats = el('div', { class: 'stat-grid', style: { gridTemplateColumns: '1fr 1fr' } });
  stats.appendChild(statCard(String(banks.length + fillBanks.length), 'Tổng số môn / bộ đề', 'var(--accent)'));
  stats.appendChild(statCard(String(history.length), 'Lượt làm bài đã lưu', 'var(--accent-2)'));
  root.appendChild(stats);
}

function modeCard(iconName, color, title, subtitle, desc, onClick) {
  const card = panel([], { classes: 'mode-card', accent: color, onClick });
  card.appendChild(el('div', { class: 'icon-box', html: icon(iconName, 28), style: { background: `color-mix(in srgb, ${color} 20%, var(--surface))`, border: `1px solid ${color}` } }));
  card.appendChild(el('h3', { text: title }));
  card.appendChild(el('div', { class: 'subtitle', text: subtitle, style: { color } }));
  card.appendChild(el('div', { class: 'desc', text: desc }));
  card.appendChild(btn('Bắt đầu', onClick, { kind: 'primary', iconName: 'arrowRight' }));
  return card;
}

function statCard(value, label, color) {
  return panel([
    el('div', { class: 'value', text: value }),
    el('div', { class: 'label', text: label }),
  ], { classes: 'stat-card', accent: color });
}

// ====================================================================== HUB
async function renderMcqHub(root, App) {
  const banks = await App.api.allBanks();
  const history = await App.api.history();
  const totalQuestions = banks.reduce((n, b) => n + b.questions.length, 0);
  const avg = history.length ? Math.round(history.reduce((s, h) => s + (h.correct / h.total) * 100, 0) / history.length) : 0;

  root.appendChild(pageTitle({
    eyebrow: '🩺 Ôn luyện quân y · NVQYc43', title: 'Làm bài', hl: 'trắc nghiệm thử',
    subtitle: 'Chọn môn học, chọn số câu, rồi chọn chế độ trình chiếu giảng đường hoặc làm bài cá nhân. Đề được xáo ngẫu nhiên mỗi lần làm.',
  }));

  const stats = el('div', { class: 'stat-grid', style: { gridTemplateColumns: 'repeat(4, 1fr)' } });
  [[String(banks.length), 'Môn học', 'var(--accent)'], [totalQuestions.toLocaleString('vi-VN'), 'Câu hỏi trong kho', 'var(--accent-2)'],
   [String(history.length), 'Lượt làm bài', 'var(--accent)'], [history.length ? `${avg}%` : '—', 'Điểm trung bình', 'var(--accent-2)']]
    .forEach(([v, l, c]) => stats.appendChild(statCard(v, l, c)));
  root.appendChild(stats);

  root.appendChild(sectionHead('Chọn môn học', `${banks.length} môn khả dụng`));
  if (!banks.length) {
    root.appendChild(emptyState('folder', 'Chưa có môn học nào', 'Đặt các file .txt vào cùng thư mục với app rồi khởi động lại.'));
  } else {
    const grid = el('div', { class: 'card-grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } });
    banks.forEach((bank) => grid.appendChild(subjectCard(App, bank, history)));
    root.appendChild(grid);
  }

  root.appendChild(sectionHead('Công cụ'));
  const tools = el('div', { class: 'card-grid', style: { gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: '20px' } });
  [
    ['upload', 'Nhập đề từ file', 'Đọc file .txt theo mẫu ANSWER hoặc dán trực tiếp nội dung đề.', () => App.navigate('banks', { importNow: true })],
    ['pencil', 'Chỉnh sửa câu hỏi', 'Sửa nội dung, đổi đáp án đúng, thêm hoặc xoá câu, xuất lại .txt.', () => App.navigate('banks')],
    ['chart', 'Lịch sử làm bài', 'Xem lại điểm số các lần làm trước theo từng môn và chế độ.', () => App.navigate('history')],
  ].forEach(([ic, title, desc, action]) => {
    const card = panel([], { classes: 'tool-card panel-soft', onClick: action });
    card.appendChild(el('div', { class: 'icon-box', html: icon(ic, 18), style: { background: 'var(--surface-3)', width: '38px', height: '38px', borderRadius: '11px' } }));
    card.appendChild(el('div', {}, [el('div', { class: 'title', text: title }), el('div', { class: 'desc', text: desc })]));
    tools.appendChild(card);
  });
  root.appendChild(tools);
}

function subjectCard(App, bank, history) {
  const total = bank.questions.length;
  const ready = COUNT_CHOICES.filter((n) => total >= n);
  const last = history.find((h) => h.bankId === bank.id);
  const color = bank.color;

  const card = panel([], { classes: 'subject-card', accent: color, onClick: () => App.navigate('setup', { bankId: bank.id }) });
  const top = el('div', { class: 'top' });
  top.appendChild(el('div', { class: 'icon-box', html: icon(subjectIcon(bank.name), 20), style: { background: `color-mix(in srgb, ${color} 18%, var(--surface))`, border: `1px solid ${color}` } }));
  const textWrap = el('div', {}, [el('div', { class: 'name', text: bank.name })]);
  const chips = el('div', { class: 'chips' });
  chips.appendChild(chipEl(`${total} câu`));
  if (ready.length) chips.appendChild(chipEl(`Đủ đề ${ready.join('/')}`, { tone: 'ok' }));
  else chips.appendChild(chipEl('Dưới 50 câu', { tone: 'warn' }));
  textWrap.appendChild(chips);
  top.appendChild(textWrap);
  card.appendChild(top);

  const bar = el('div', { class: 'bar-track' });
  const fillWidth = Math.max(4, Math.min(100, (total / 300) * 100));
  bar.appendChild(el('div', { class: 'bar-fill', style: { width: fillWidth + '%', background: color } }));
  card.appendChild(bar);

  card.appendChild(el('div', {
    class: 'muted-line',
    text: last ? `Lần gần nhất: ${last.correct}/${last.total} câu đúng · ${fmtDate(last.at)}` : 'Bạn chưa làm bài môn này',
  }));

  const actions = el('div', { class: 'card-actions' });
  actions.appendChild(btn('Bắt đầu làm bài', (e) => { e.stopPropagation(); App.navigate('setup', { bankId: bank.id }); }, { kind: 'primary', iconName: 'play' }));
  actions.appendChild(btn('', (e) => { e.stopPropagation(); App.navigate('banks', { openBank: bank.id }); }, { kind: 'ghost', iconName: 'pencil' }));
  card.appendChild(actions);
  return card;
}

// ==================================================================== SETUP
async function renderMcqSetup(root, App, bankId) {
  const bank = await App.api.getBank(bankId);
  if (!bank) { App.navigate('hub'); return; }
  const prefs = await App.api.prefs();
  const total = bank.questions.length;

  const state = {
    count: COUNT_CHOICES.includes(prefs.count) && total >= prefs.count ? prefs.count : Math.min(50, total),
    mode: prefs.mode === 'personal' ? 'personal' : 'stage',
    shuffleOptions: Boolean(prefs.shuffleOptions),
    autoNext: Boolean(prefs.autoNext),
  };

  const back = el('div', { class: 'mt8' }, [btn('Chọn môn khác', () => App.navigate('hub'), { kind: 'ghost', small: true, iconName: 'arrowLeft' })]);
  root.appendChild(back);
  root.appendChild(pageTitle({
    eyebrow: `📘 ${bank.name}`, title: 'Thiết lập', hl: 'bài thi thử',
    subtitle: `Kho đề có ${total} câu. Mỗi lần bắt đầu, app xáo toàn bộ đề rồi bốc ngẫu nhiên đúng số câu bạn chọn.`,
  }));

  // 1. so cau
  const p1 = panel([]);
  p1.appendChild(el('div', { class: 'title', style: { fontSize: '12px', fontWeight: 700 }, text: '1 · Số câu hỏi' }));
  p1.appendChild(el('div', { class: 'muted-line', style: { marginBottom: '14px' }, text: 'Chọn độ dài bài thi thử.' }));
  const countGrid = el('div', { class: 'choice-grid', style: { gridTemplateColumns: `repeat(${COUNT_CHOICES.length + 1}, 1fr)` } });
  const choices = COUNT_CHOICES.map((n) => [n, total >= n ? 'câu trắc nghiệm' : 'không đủ câu']);
  choices.push([total, 'toàn bộ kho đề']);
  const countCards = [];
  choices.forEach(([value, caption]) => {
    const enabled = total >= value;
    const card = el('div', { class: `count-card${enabled ? ' enabled' : ''}${state.count === value ? ' selected' : ''}` }, [
      el('div', { class: 'num', text: String(value) }),
      el('div', { class: 'cap', text: caption }),
    ]);
    if (state.count === value) card.appendChild(el('div', { class: 'check-badge', html: icon('check', 11) }));
    if (enabled) card.addEventListener('click', () => {
      state.count = value;
      countCards.forEach((c) => c.el.classList.toggle('selected', c.value === value));
      redrawChecks(countGrid);
    });
    countCards.push({ el: card, value });
    countGrid.appendChild(card);
  });
  p1.appendChild(countGrid);
  root.appendChild(p1);

  // 2. che do
  const p2 = el('div', { class: 'mt14' });
  const p2card = panel([]);
  p2card.appendChild(el('div', { class: 'title', style: { fontSize: '12px', fontWeight: 700 }, text: '2 · Chế độ làm bài' }));
  p2card.appendChild(el('div', { class: 'muted-line', style: { marginBottom: '14px' }, text: 'Trình chiếu cả lớp cùng làm, hoặc tự luyện từng người.' }));
  const modeGrid = el('div', { class: 'choice-grid', style: { gridTemplateColumns: '1fr 1fr' } });
  const modeCards = [];
  [
    ['stage', 'screen', 'Bảng lớn giảng đường', 'Mỗi màn hình một câu chữ rất to, 4 đáp án lớn. Chọn xong hiện đúng/sai ngay.'],
    ['personal', 'notes', 'Làm bài cá nhân', 'Hiển thị 10 câu mỗi trang, có đồng hồ bấm giờ. Chỉ chấm điểm sau khi nộp bài.'],
  ].forEach(([mode, ic, title, desc]) => {
    const card = el('div', { class: `mc-mode-card${state.mode === mode ? ' selected' : ''}` }, [
      el('div', { class: 'head' }, [el('span', { html: icon(ic, 18) }), el('span', { text: title })]),
      el('div', { class: 'desc', text: desc }),
    ]);
    if (state.mode === mode) card.appendChild(el('div', { class: 'check-badge', html: icon('check', 11) }));
    card.addEventListener('click', () => {
      state.mode = mode;
      modeCards.forEach((c) => c.el.classList.toggle('selected', c.mode === mode));
      redrawChecks(modeGrid);
    });
    modeCards.push({ el: card, mode });
    modeGrid.appendChild(card);
  });
  p2card.appendChild(modeGrid);
  p2.appendChild(p2card);
  root.appendChild(p2);

  // 3. tuy chon
  const p3 = el('div', { class: 'mt14' });
  const p3card = panel([]);
  p3card.appendChild(el('div', { class: 'title', style: { fontSize: '12px', fontWeight: 700 }, text: '3 · Tuỳ chọn' }));
  p3card.appendChild(el('div', { class: 'muted-line', style: { marginBottom: '4px' }, text: 'Được ghi nhớ cho những lần làm bài sau.' }));
  p3card.appendChild(switchRow('Xáo thứ tự đáp án', 'Đảo vị trí A B C D để tránh học vẹt theo vị trí', state.shuffleOptions, (v) => { state.shuffleOptions = v; }));
  p3card.appendChild(switchRow('Tự chuyển câu tiếp theo', 'Chế độ giảng đường: tự sang câu mới sau vài giây', state.autoNext, (v) => { state.autoNext = v; }));
  p3.appendChild(p3card);
  root.appendChild(p3);

  const startBtn = btn('BẮT ĐẦU LÀM BÀI', async () => {
    if (!(await requireOrg(App))) return;
    const student = await promptStudentPicker(App);
    if (!student) return;
    await App.api.setPrefs({ count: state.count, mode: state.mode, shuffleOptions: state.shuffleOptions, autoNext: state.autoNext });
    await App.startQuiz(bank.id, state.count, state.mode, state.shuffleOptions, state.autoNext, student);
  }, { kind: 'primary', block: true });
  startBtn.style.height = '52px';
  startBtn.style.fontSize = '13px';
  startBtn.style.marginTop = '4px';
  root.appendChild(startBtn);
  root.appendChild(el('div', { style: { height: '22px' } }));
}

function redrawChecks(gridEl) {
  gridEl.querySelectorAll('.count-card, .mc-mode-card').forEach((card) => {
    const existing = card.querySelector('.check-badge');
    if (existing) existing.remove();
    if (card.classList.contains('selected')) card.appendChild(el('div', { class: 'check-badge', html: icon('check', 11) }));
  });
}

// ================================================================== HISTORY
async function renderHistory(root, App) {
  const [items, roster] = await Promise.all([App.api.history(), App.api.allStudents()]);
  root.appendChild(pageTitle({ title: 'Lịch sử', hl: 'làm bài', subtitle: `${items.length} lượt làm gần nhất được lưu trong thư mục data của app.` }));

  if (!items.length) {
    root.appendChild(emptyState('chart', 'Chưa có lượt làm bài nào', 'Hãy chọn một môn học ở trang chủ và làm thử một đề.',
      btn('Làm bài ngay', () => App.navigate('start'), { kind: 'primary' })));
    return;
  }

  const index = HistoryFilter.buildHistoryIndex(items, roster);
  const filters = { classKey: '', studentKey: '', query: '' };
  const filterPanel = panel([], { classes: 'history-filters' });
  filterPanel.appendChild(el('div', { class: 'muted-line', text: 'Chọn lớp rồi chọn học viên, hoặc gõ tên để tìm lượt làm bài. Có thể tìm tên không dấu.' }));
  const fields = el('div', { class: 'history-filter-fields' });
  const classSelect = el('select', { class: 'text-input history-class', attrs: { id: 'history-class' } });
  const studentSelect = el('select', { class: 'text-input history-student', attrs: { id: 'history-student' } });
  const searchInput = el('input', { class: 'text-input history-search', attrs: {
    id: 'history-search', type: 'search', placeholder: 'Ví dụ: Nguyễn Văn An', autocomplete: 'off',
  } });
  [
    ['Lớp', 'history-class', classSelect],
    ['Học viên', 'history-student', studentSelect],
    ['Tìm theo tên', 'history-search', searchInput],
  ].forEach(([label, id, input]) => fields.appendChild(el('div', { class: 'history-filter-field' }, [
    el('label', { class: 'field-label', text: label, attrs: { for: id } }), input,
  ])));
  classSelect.appendChild(el('option', { text: 'Tất cả lớp', attrs: { value: '' } }));
  index.classes.forEach(cls => classSelect.appendChild(el('option', { text: cls.label, attrs: { value: cls.key } })));

  function updateStudentOptions() {
    studentSelect.replaceChildren(el('option', { text: 'Tất cả học viên', attrs: { value: '' } }));
    HistoryFilter.studentOptions(index, filters.classKey).forEach(student => studentSelect.appendChild(
      el('option', { text: student.label, attrs: { value: student.key } }),
    ));
    studentSelect.value = filters.studentKey;
  }
  updateStudentOptions();
  filterPanel.appendChild(fields);
  const resetFilters = btn('Xoá bộ lọc', () => {
    filters.classKey = '';
    filters.studentKey = '';
    filters.query = '';
    classSelect.value = '';
    searchInput.value = '';
    updateStudentOptions();
    renderResults();
  }, { kind: 'ghost', small: true });
  resetFilters.classList.add('history-clear-filters');
  filterPanel.appendChild(resetFilters);
  root.appendChild(filterPanel);

  const count = el('div', { class: 'muted-line history-count', attrs: { id: 'history-count', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' } });
  const tools = el('div', { class: 'row history-tools', style: { justifyContent: 'space-between', marginTop: '14px', marginBottom: '12px' } });
  tools.appendChild(count);
  tools.appendChild(btn('Xoá lịch sử', async () => {
    if (await confirmDialog('Xoá toàn bộ lịch sử?', 'Các kết quả đã lưu trong thư mục data sẽ bị xoá.', { confirmLabel: 'Xoá', danger: true })) {
      await App.api.clearHistory();
      toast('Đã xoá lịch sử', 'ok');
      App.navigate('history');
    }
  }, { kind: 'danger', small: true, iconName: 'trash' }));
  root.appendChild(tools);

  const results = el('div', { class: 'history-results', attrs: { id: 'history-results', 'aria-label': 'Kết quả lịch sử làm bài' } });
  root.appendChild(results);

  function renderResults() {
    const filtered = HistoryFilter.filterHistory(index, filters);
    count.textContent = `Hiển thị ${filtered.length} / ${items.length} lượt làm bài`;
    resetFilters.disabled = !filters.classKey && !filters.studentKey && !filters.query;
    results.replaceChildren();
    if (!filtered.length) {
      results.appendChild(emptyState('chart', 'Không có lượt làm bài phù hợp', 'Thử đổi lớp, học viên hoặc tên tìm kiếm. Chọn Xoá bộ lọc để xem toàn bộ lịch sử.'));
      return;
    }
    const table = el('table', { class: 'history-table' });
    table.appendChild(el('thead', {}, [el('tr', {}, ['THỜI GIAN', 'HỌC VIÊN', 'LỚP', 'MÔN HỌC', 'CHẾ ĐỘ', 'KẾT QUẢ', 'TỈ LỆ', 'THỜI LƯỢNG'].map((h) => el('th', { text: h, attrs: { scope: 'col' } })))]));
    const body = el('tbody');
    const modeLabel = { stage: 'Giảng đường', personal: 'Cá nhân', fill: 'Điền chỗ trống' };
    filtered.forEach((item) => {
      const percent = item.total ? Math.round((item.correct / item.total) * 100) : 0;
      const color = percent >= 75 ? 'var(--ok)' : percent >= 50 ? 'var(--warn)' : 'var(--bad)';
      const tr = el('tr', {}, [
        el('td', { text: fmtDate(item.at) }),
        el('td', { class: 'history-row-name', text: item.studentName || '—' }),
        el('td', { text: item.className || '—', attrs: { title: [item.battalion, item.company, item.className].filter(Boolean).join(' · ') } }),
        el('td', { text: item.bankName, style: { fontWeight: 700 } }),
        el('td', { text: modeLabel[item.mode] || item.mode }),
        el('td', { text: `${item.correct} / ${item.total}` }),
        el('td', { text: `${percent}%`, style: { color, fontWeight: 700 } }),
        el('td', { text: fmtTime(item.seconds) }),
      ]);
      body.appendChild(tr);
    });
    table.appendChild(body);
    results.appendChild(el('div', { class: 'panel history-table-wrap', style: { padding: '4px 8px' } }, [table]));
  }

  classSelect.addEventListener('change', () => {
    filters.classKey = classSelect.value;
    filters.studentKey = '';
    updateStudentOptions();
    renderResults();
  });
  studentSelect.addEventListener('change', () => {
    filters.studentKey = studentSelect.value;
    renderResults();
  });
  searchInput.addEventListener('input', () => {
    filters.query = searchInput.value;
    renderResults();
  });
  renderResults();
  root.appendChild(el('div', { style: { height: '20px' } }));
}
