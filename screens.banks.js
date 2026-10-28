'use strict';
/** Danh sach ngan hang de va man hinh sua cau hoi. */

const ROWS_PER_PAGE = 20;

// ======================================================== danh sach mon hoc
async function renderBanksList(root, App, importNow) {
  const banks = await App.api.allBanks();
  root.appendChild(pageTitle({
    eyebrow: '📚 Ngân hàng đề', title: 'Quản lý', hl: 'câu hỏi',
    subtitle: 'Nhập đề từ file .txt, sửa nội dung câu hỏi và đáp án, hoặc xuất đề ra file để chia sẻ cho lớp.',
  }));

  const tools = el('div', { class: 'row gap8', style: { marginBottom: '16px' } });
  tools.appendChild(btn('Nhập đề mới', () => importDialogMcq(App, () => App.navigate('banks')), { kind: 'primary', iconName: 'upload' }));
  tools.appendChild(btn('Nạp lại đề mẫu từ thư mục', async () => {
    const { added, issues } = await App.api.seedSamples();
    toast(added ? `Đã nạp thêm ${added} môn từ file .txt` : 'Các môn mẫu đã có sẵn', added ? 'ok' : 'info');
    if (issues && issues.length) App.api.log('Câu hỏi bị bỏ qua:', issues.join(' | '));
    App.navigate('banks');
  }, { kind: 'ghost', small: true, iconName: 'download' }));
  root.appendChild(tools);

  if (!banks.length) {
    root.appendChild(emptyState('folder', 'Chưa có ngân hàng đề nào', 'Đặt file .txt vào cùng thư mục với app rồi bấm "Nạp lại đề mẫu".'));
    if (importNow) setTimeout(() => importDialogMcq(App, () => App.navigate('banks')), 100);
    return;
  }

  const grid = el('div', { class: 'card-grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } });
  for (const bank of banks) grid.appendChild(await bankCard(App, bank));
  root.appendChild(grid);
  root.appendChild(el('div', { style: { height: '20px' } }));

  if (importNow) setTimeout(() => importDialogMcq(App, () => App.navigate('banks')), 100);
}

async function bankCard(App, bank) {
  const color = bank.color;
  const isSample = await App.api.hasSample(bank.id);
  const card = panel([], { classes: 'subject-card', accent: color, onClick: () => App.navigate('banks', { openBank: bank.id }) });
  const top = el('div', { class: 'top' });
  top.appendChild(el('div', { class: 'icon-box', html: icon(isSample ? 'book' : 'pencil', 20), style: { background: `color-mix(in srgb, ${color} 18%, var(--surface))`, border: `1px solid ${color}` } }));
  const textWrap = el('div', {}, [el('div', { class: 'name', text: bank.name })]);
  const chips = el('div', { class: 'chips' });
  chips.append(chipEl(`${bank.questions.length} câu`), chipEl(isSample ? 'Đề mẫu' : 'Tự nhập', { tone: isSample ? 'active' : '' }));
  textWrap.appendChild(chips);
  top.appendChild(textWrap);
  card.appendChild(top);
  card.appendChild(el('div', { class: 'muted-line mt12', text: `Cập nhật ${fmtDate(bank.updatedAt)}` }));

  const actions = el('div', { class: 'card-actions' });
  actions.appendChild(btn('Sửa câu hỏi', (e) => { e.stopPropagation(); App.navigate('banks', { openBank: bank.id }); }, { kind: 'primary', small: true, iconName: 'pencil' }));
  actions.appendChild(btn('', (e) => { e.stopPropagation(); exportBank(App, bank.id); }, { kind: 'ghost', small: true, iconName: 'download' }));
  actions.appendChild(btn('', async (e) => {
    e.stopPropagation();
    const note = isSample ? ' Bạn có thể nạp lại từ file .txt sau.' : '';
    if (await confirmDialog(`Xoá môn "${bank.name}"?`, `Toàn bộ ${bank.questions.length} câu hỏi của môn này sẽ bị xoá khỏi app.${note}`, { confirmLabel: 'Xoá môn học', danger: true })) {
      await App.api.removeBank(bank.id);
      toast('Đã xoá môn học', 'ok');
      App.navigate('banks');
    }
  }, { kind: 'ghost', small: true, iconName: 'trash' }));
  card.appendChild(actions);
  return card;
}

function importDialogMcq(App, refresh) {
  const nameInput = el('input', { class: 'text-input' });
  const textArea = el('textarea', { class: 'text-area', attrs: { rows: 8 } });
  const body = el('div', {}, [
    el('div', { class: 'row gap8' }, [btn('Chọn file .txt từ máy', pickFiles, { kind: 'primary', block: true })]),
    el('div', { class: 'field-label mt16', text: 'HOẶC DÁN NỘI DUNG ĐỀ' }),
    el('label', { class: 'field-label mt10', text: 'Tên môn học' }), nameInput,
    el('label', { class: 'field-label mt10', text: 'Nội dung đề' }), textArea,
  ]);
  const modal = openModal({
    title: 'Nhập đề mới',
    subtitle: 'File .txt theo mẫu: dòng câu hỏi, 4 dòng đáp án A) B) C) D) và dòng ANSWER: X.',
    body, width: 600,
    footer: (footer, close) => {
      footer.appendChild(btn('Đóng', close, { kind: 'ghost' }));
      footer.appendChild(btn('Thêm môn học', savePasted, { kind: 'primary', iconName: 'check' }));
    },
  });

  async function savePasted() {
    const name = nameInput.value.trim();
    if (!name) { toast('Hãy nhập tên môn học', 'err'); return; }
    const { questions, issues } = await App.api.parseQuestions(textArea.value);
    if (!questions.length) { toast('Không đọc được câu hỏi nào từ nội dung đã dán', 'err'); return; }
    await saveMcqBank(App, name, questions, issues);
    modal.close();
    refresh();
  }
  async function pickFiles() {
    const files = await App.api.openTxtFiles();
    if (!files.length) return;
    let imported = 0;
    for (const file of files) {
      const { questions, issues } = await App.api.parseQuestions(file.content);
      if (!questions.length) { toast(`File "${file.name}" không có câu hỏi hợp lệ`, 'err'); continue; }
      await saveMcqBank(App, file.name, questions, issues);
      imported += 1;
    }
    if (imported) { modal.close(); refresh(); }
  }
}

async function saveMcqBank(App, name, questions, issues) {
  const id = await App.api.uniqueId(await App.api.slugify(name));
  const bank = await App.api.upsertBank({ id, name, source: 'import', questions });
  toast(`Đã thêm "${name}" · ${bank.questions.length} câu`, 'ok');
  if (issues && issues.length) App.api.log(`${name}: bỏ qua ${issues.length} câu lỗi:`, issues.join(' | '));
}

async function exportBank(App, bankId) {
  const bank = await App.api.getBank(bankId);
  if (!bank) return;
  const content = await App.api.exportTxt(bank);
  const path = await App.api.saveTxt(`${bank.name}.txt`, content);
  if (path) toast(`Đã xuất ${path.split(/[\\/]/).pop()}`, 'ok');
}

// ============================================================ sua cau hoi
async function renderBankEditor(root, App, bankId) {
  const state = { keyword: '', page: 0 };
  await build();

  async function build() {
    root.innerHTML = '';
    const bank = await App.api.getBank(bankId);
    if (!bank) { App.navigate('banks'); return; }

    root.appendChild(el('div', { class: 'mt8' }, [btn('Danh sách môn học', () => App.navigate('banks'), { kind: 'ghost', small: true, iconName: 'arrowLeft' })]));
    root.appendChild(pageTitle({
      eyebrow: `📘 ${bank.name}`, title: 'Chỉnh sửa', hl: 'câu hỏi',
      subtitle: `Tổng cộng ${bank.questions.length} câu hỏi. Bấm nút sửa ở mỗi dòng để sửa nội dung và đáp án đúng.`,
    }));

    const tools = el('div', { class: 'row gap8 wrap', style: { marginBottom: '14px' } });
    const searchInput = el('input', { class: 'text-input', style: { width: '260px' }, attrs: { placeholder: 'Tìm câu hỏi hoặc đáp án rồi bấm Enter...' } });
    searchInput.value = state.keyword;
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.keyword = searchInput.value; state.page = 0; build(); } });
    tools.append(searchInput, btn('', () => { state.keyword = searchInput.value; state.page = 0; build(); }, { kind: 'ghost', iconName: 'search' }));
    tools.appendChild(btn('Thêm câu', () => editQuestion(App, bank, -1, build), { kind: 'primary', small: true, iconName: 'plus' }));
    tools.appendChild(btn('Đổi tên môn', () => renameBank(App, bank, build), { kind: 'ghost', small: true, iconName: 'pencil' }));
    tools.appendChild(btn('Xuất .txt', () => exportBank(App, bank.id), { kind: 'ghost', small: true, iconName: 'download' }));
    const isSample = await App.api.hasSample(bank.id);
    if (isSample) tools.appendChild(btn('Khôi phục đề gốc', () => restoreSample(App, bank, build), { kind: 'ghost', small: true }));
    root.appendChild(tools);

    const keyword = state.keyword.toLowerCase().trim();
    const items = bank.questions
      .map((q, i) => [i, q])
      .filter(([, q]) => !keyword || q.text.toLowerCase().includes(keyword) || q.options.some((o) => o.toLowerCase().includes(keyword)));

    const pages = Math.max(1, Math.ceil(items.length / ROWS_PER_PAGE));
    state.page = Math.min(state.page, pages - 1);
    const windowItems = items.slice(state.page * ROWS_PER_PAGE, (state.page + 1) * ROWS_PER_PAGE);

    if (!items.length) {
      root.appendChild(emptyState('search', 'Không tìm thấy câu hỏi phù hợp', 'Thử từ khoá khác hoặc xoá ô tìm kiếm.'));
      return;
    }

    windowItems.forEach(([index, q]) => root.appendChild(questionRow(App, bank, index, q, build)));

    const pager = el('div', { class: 'pager-row' });
    const prevP = btn('Trước', () => { state.page -= 1; build(); }, { kind: 'ghost', small: true, iconName: 'arrowLeft' });
    prevP.disabled = state.page === 0;
    pager.appendChild(prevP);
    pager.appendChild(el('span', { class: 'muted-line', text: `Trang ${state.page + 1} / ${pages} · ${items.length} câu${keyword ? ' khớp từ khoá' : ''}` }));
    const nextP = btn('Sau', () => { state.page += 1; build(); }, { kind: 'ghost', small: true, iconName: 'arrowRight' });
    nextP.disabled = state.page >= pages - 1;
    pager.appendChild(nextP);
    root.appendChild(pager);
    root.appendChild(el('div', { style: { height: '20px' } }));
  }
}

function questionRow(App, bank, index, q, refresh) {
  const row = panel([], { classes: 'q-card' });
  const head = el('div', { class: 'head', style: { justifyContent: 'space-between' } });
  const left = el('div', { class: 'row gap10' });
  left.appendChild(el('div', { class: 'q-badge', style: { background: 'var(--surface-2)', color: 'var(--dim)' }, text: String(index + 1) }));
  const textWrap = el('div', {}, [
    el('div', { class: 'q-text', text: q.text }),
    el('div', { class: 'row gap6 mt8' }, [
      el('span', { style: { color: 'var(--ok-text)', fontWeight: 700, fontSize: '9px' }, text: `${LETTERS[q.answer]})` }),
      el('span', { class: 'muted-line', text: q.options[q.answer] }),
    ]),
  ]);
  left.appendChild(textWrap);
  head.appendChild(left);
  const actions = el('div', { class: 'row gap6' });
  actions.appendChild(btn('', () => editQuestion(App, bank, index, refresh), { kind: 'ghost', small: true, iconName: 'pencil' }));
  actions.appendChild(btn('', async () => {
    if (await confirmDialog(`Xoá câu ${index + 1}?`, q.text.slice(0, 140), { confirmLabel: 'Xoá', danger: true })) {
      const fresh = await App.api.getBank(bank.id);
      fresh.questions.splice(index, 1);
      await App.api.upsertBank(fresh);
      toast('Đã xoá câu hỏi', 'ok');
      refresh();
    }
  }, { kind: 'ghost', small: true, iconName: 'trash' }));
  head.appendChild(actions);
  row.appendChild(head);
  return row;
}

function editQuestion(App, bank, index, refresh) {
  const isNew = index < 0;
  const question = isNew ? { text: '', options: ['', '', '', ''], answer: 0 } : { ...bank.questions[index] };

  const textArea = el('textarea', { class: 'text-area', attrs: { rows: 4, style: 'font-size:13px;min-height:100px' } });
  textArea.value = question.text;
  const optionInputs = question.options.map((v) => {
    const inp = el('input', { class: 'text-input field-gap' });
    inp.value = v;
    return inp;
  });
  let chosen = question.answer;
  const pickerRow = el('div', { class: 'row gap8' });
  const pickerButtons = LETTERS.map((letter, i) => {
    const b = btn(letter, () => { chosen = i; pickerButtons.forEach((pb, pi) => pb.className = `btn ${pi === i ? 'ok' : 'ghost'}`); }, { kind: i === chosen ? 'ok' : 'ghost' });
    pickerRow.appendChild(b);
    return b;
  });

  const body = el('div', {}, [
    el('label', { class: 'field-label', text: 'Nội dung câu hỏi' }), textArea,
    ...question.options.flatMap((_, i) => [el('label', { class: 'field-label mt10', text: `Đáp án ${LETTERS[i]}` }), optionInputs[i]]),
    el('label', { class: 'field-label mt10', text: 'Đáp án đúng' }), pickerRow,
  ]);

  const modal = openModal({
    title: isNew ? 'Thêm câu hỏi' : `Sửa câu ${index + 1}`, subtitle: `Môn: ${bank.name}`, body, width: 720,
    footer: (footer, close) => {
      footer.appendChild(btn('Huỷ', close, { kind: 'ghost' }));
      footer.appendChild(btn('Lưu lại', save, { kind: 'primary', iconName: 'check' }));
    },
  });

  async function save() {
    const text = textArea.value.trim();
    const options = optionInputs.map((i) => i.value.trim());
    if (!text) { toast('Chưa nhập nội dung câu hỏi', 'err'); return; }
    if (options.some((o) => !o)) { toast('Phải nhập đủ 4 đáp án', 'err'); return; }
    const fresh = await App.api.getBank(bank.id);
    const payload = { id: question.id || undefined, text, options, answer: chosen };
    if (isNew) fresh.questions.push(payload);
    else fresh.questions[index] = payload;
    await App.api.upsertBank(fresh);
    modal.close();
    toast(isNew ? 'Đã thêm câu hỏi mới' : 'Đã lưu thay đổi', 'ok');
    refresh();
  }
}

function renameBank(App, bank, refresh) {
  const input = el('input', { class: 'text-input' });
  input.value = bank.name;
  const modal = openModal({
    title: 'Đổi tên môn học', subtitle: `Tên hiện tại: ${bank.name}`, body: input,
    footer: (footer, close) => {
      footer.appendChild(btn('Huỷ', close, { kind: 'ghost' }));
      footer.appendChild(btn('Lưu', save, { kind: 'primary' }));
    },
  });
  async function save() {
    const name = input.value.trim();
    if (!name) { toast('Tên môn không được để trống', 'err'); return; }
    const fresh = await App.api.getBank(bank.id);
    fresh.name = name;
    await App.api.upsertBank(fresh);
    modal.close();
    toast('Đã đổi tên môn học', 'ok');
    refresh();
  }
}

async function restoreSample(App, bank, refresh) {
  if (await confirmDialog('Khôi phục đề gốc?', `Mọi chỉnh sửa ở môn "${bank.name}" sẽ bị thay bằng nội dung file .txt ban đầu.`, { confirmLabel: 'Khôi phục', danger: true })) {
    await App.api.restoreSample(bank.id);
    toast('Đã khôi phục đề gốc', 'ok');
    refresh();
  }
}
