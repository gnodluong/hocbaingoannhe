'use strict';
/** Che do dien vao cho trong: hub theo mon, thiet lap, lam bai (go/keo tha), ket qua. */

const FILL_COUNT_CHOICES = [10, 20, 30];

// ==================================================================== HUB
async function renderFillHub(root, App) {
  const state = { subject: 'Tất cả' };
  await build();

  async function build() {
    root.innerHTML = '';
    const banks = await App.api.allFillBanks();
    const subjects = await App.api.fillSubjects();

    root.appendChild(pageTitle({
      eyebrow: '✏ Điền vào chỗ trống', title: 'Ôn luyện', hl: 'theo kiểu điền từ',
      subtitle: 'Đề được lọc theo môn học. Chỉ cần dán câu bình thường, app tự động bốc ngẫu nhiên từ để ẩn thành chỗ trống — mỗi lượt làm bài có thể ra từ khác nhau. Gõ tay hoặc kéo thả từ có sẵn để trả lời. Toàn bộ chạy offline.',
    }));

    const tools = el('div', { class: 'row gap8 wrap mt8', style: { marginBottom: '16px' } });
    tools.appendChild(btn('Tạo bộ đề mới', () => createBankDialog(App), { kind: 'primary', iconName: 'plus' }));
    tools.appendChild(btn('Tải đề lên', () => importDialog(App, build), { kind: 'ghost', small: true, iconName: 'upload' }));
    tools.appendChild(btn('Tải file mẫu', () => downloadTemplate(App), { kind: 'ghost', small: true, iconName: 'download' }));
    root.appendChild(tools);

    if (!banks.length) {
      root.appendChild(emptyState('folder', 'Chưa có bộ đề điền chỗ trống nào',
        'Bấm "Tạo bộ đề mới" để tự soạn từng câu ngay trong app, hoặc tải file mẫu về soạn sẵn rồi tải lên.'));
      return;
    }

    if (subjects.length) {
      root.appendChild(sectionHead('Lọc theo môn'));
      const filters = el('div', { class: 'subject-filter-row' });
      ['Tất cả', ...subjects].forEach((name) => {
        const c = chipEl(name, { tone: state.subject === name ? 'active' : '', onClick: () => { state.subject = name; build(); } });
        c.classList.add('clickable');
        filters.appendChild(c);
      });
      root.appendChild(filters);
    }

    const visible = banks.filter((b) => state.subject === 'Tất cả' || b.subject === state.subject);
    root.appendChild(sectionHead('Chọn bộ đề', `${visible.length} bộ khả dụng`));
    if (!visible.length) {
      root.appendChild(emptyState('search', 'Không có bộ đề nào trong môn này', ''));
      return;
    }
    const grid = el('div', { class: 'card-grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } });
    visible.forEach((bank) => grid.appendChild(fillBankCard(App, bank, build)));
    root.appendChild(grid);
  }
}

function fillBankCard(App, bank, refresh) {
  const total = bank.questions.length;
  const color = bank.color;
  const card = panel([], { classes: 'subject-card', accent: color, onClick: () => App.navigate('fillsetup', { bankId: bank.id }) });
  const top = el('div', { class: 'top' });
  top.appendChild(el('div', { class: 'icon-box', html: icon(subjectIcon(bank.name), 20), style: { background: `color-mix(in srgb, ${color} 18%, var(--surface))`, border: `1px solid ${color}` } }));
  const textWrap = el('div', {}, [el('div', { class: 'name', text: bank.name })]);
  const chips = el('div', { class: 'chips' });
  chips.append(chipEl(bank.subject, { tone: 'active' }), chipEl(`${total} câu`));
  textWrap.appendChild(chips);
  top.appendChild(textWrap);
  card.appendChild(top);

  const actions = el('div', { class: 'card-actions' });
  actions.appendChild(btn('Bắt đầu làm bài', (e) => { e.stopPropagation(); App.navigate('fillsetup', { bankId: bank.id }); }, { kind: 'primary', iconName: 'play' }));
  actions.appendChild(btn('', (e) => { e.stopPropagation(); App.navigate('filleditor', { bankId: bank.id }); }, { kind: 'ghost', iconName: 'pencil' }));
  actions.appendChild(btn('', async (e) => {
    e.stopPropagation();
    if (await confirmDialog(`Xoá bộ đề "${bank.name}"?`, `Toàn bộ ${total} câu điền chỗ trống sẽ bị xoá.`, { confirmLabel: 'Xoá', danger: true })) {
      await App.api.removeFillBank(bank.id);
      toast('Đã xoá bộ đề', 'ok');
      refresh();
    }
  }, { kind: 'ghost', iconName: 'trash' }));
  card.appendChild(actions);
  return card;
}

async function downloadTemplate(App) {
  const content = await App.api.fillTemplate();
  const path = await App.api.saveTxt('Mau_De_Dien_Cho_Trong.txt', content);
  if (path) toast('Đã lưu file mẫu', 'ok');
}

function createBankDialog(App) {
  const nameInput = el('input', { class: 'text-input' });
  const subjectInput = el('input', { class: 'text-input' });
  const body = el('div', {}, [
    el('label', { class: 'field-label', text: 'Tên bộ đề' }), nameInput,
    el('label', { class: 'field-label mt10', text: 'Môn học' }), subjectInput,
  ]);
  const modal = openModal({
    title: 'Tạo bộ đề mới', subtitle: 'Đặt tên xong sẽ mở màn soạn câu — thêm từng câu một, không cần file .txt.',
    body,
    footer: (footer, close) => {
      footer.appendChild(btn('Huỷ', close, { kind: 'ghost' }));
      footer.appendChild(btn('Tạo và soạn câu', create, { kind: 'primary', iconName: 'arrowRight' }));
    },
  });
  async function create() {
    const name = nameInput.value.trim();
    if (!name) { toast('Hãy nhập tên bộ đề', 'err'); return; }
    const subject = subjectInput.value.trim() || 'Chung';
    const id = await App.api.uniqueFillId(await App.api.slugify(name));
    const bank = await App.api.upsertFillBank({ id, name, subject, questions: [] });
    modal.close();
    App.navigate('filleditor', { bankId: bank.id });
  }
}

function importDialog(App, refresh) {
  const subjectInput = el('input', { class: 'text-input', attrs: { placeholder: 'VD: Y Học Cổ Truyền (dùng để lọc sau này)' } });
  const nameInput = el('input', { class: 'text-input' });
  const textArea = el('textarea', { class: 'text-area', attrs: { rows: 7 } });

  const body = el('div', {}, [
    el('label', { class: 'field-label', text: 'Môn học' }), subjectInput,
    el('div', { class: 'row gap8 mt12' }, [btn('Chọn file .txt từ máy', pickFiles, { kind: 'primary', block: true })]),
    el('div', { class: 'field-label mt16', text: 'HOẶC DÁN NỘI DUNG ĐỀ' }),
    el('label', { class: 'field-label mt10', text: 'Tên bộ đề' }), nameInput,
    el('label', { class: 'field-label mt10', text: 'Nội dung đề (mỗi dòng một câu)' }), textArea,
  ]);

  const modal = openModal({
    title: 'Tải đề điền vào chỗ trống',
    subtitle: 'File .txt: mỗi dòng một câu bình thường — không cần đánh dấu gì. Muốn ép đúng từ thì bọc quanh nó bằng {{...}}.',
    body, width: 600,
    footer: (footer, close) => {
      footer.appendChild(btn('Đóng', close, { kind: 'ghost' }));
      footer.appendChild(btn('Thêm bộ đề', savePasted, { kind: 'primary', iconName: 'check' }));
    },
  });

  async function savePasted() {
    const name = nameInput.value.trim();
    const subject = subjectInput.value.trim() || 'Chung';
    if (!name) { toast('Hãy nhập tên bộ đề', 'err'); return; }
    const { questions, issues } = await App.api.parseFillQuestions(textArea.value);
    if (!questions.length) { toast('Không đọc được câu nào — mỗi dòng một câu, ít nhất 3 từ', 'err'); return; }
    await saveBank(App, name, subject, questions, issues);
    modal.close();
    refresh();
  }

  async function pickFiles() {
    const files = await App.api.openTxtFiles();
    if (!files.length) return;
    const subject = subjectInput.value.trim() || 'Chung';
    let imported = 0;
    for (const file of files) {
      const { questions, issues } = await App.api.parseFillQuestions(file.content);
      if (!questions.length) { toast(`File "${file.name}" không đọc được câu nào`, 'err'); continue; }
      await saveBank(App, file.name, subject, questions, issues);
      imported += 1;
    }
    if (imported) { modal.close(); refresh(); }
  }
}

async function saveBank(App, name, subject, questions, issues) {
  const id = await App.api.uniqueFillId(await App.api.slugify(name));
  const bank = await App.api.upsertFillBank({ id, name, subject, questions });
  toast(`Đã thêm "${name}" · ${bank.questions.length} câu`, 'ok');
  if (issues && issues.length) App.api.log(`${name}: bỏ qua ${issues.length} câu không đủ từ:`, issues.join(' | '));
}

// ================================================================== SETUP
async function renderFillSetup(root, App, bankId) {
  const bank = await App.api.getFillBank(bankId);
  if (!bank) { App.navigate('fillhub'); return; }
  const total = bank.questions.length;
  const state = { count: FILL_COUNT_CHOICES.find((n) => total >= n) || total, fillMode: 'type' };

  root.appendChild(el('div', { class: 'mt8' }, [btn('Chọn bộ đề khác', () => App.navigate('fillhub'), { kind: 'ghost', small: true, iconName: 'arrowLeft' })]));
  root.appendChild(pageTitle({
    eyebrow: `📘 ${bank.name}`, title: 'Thiết lập', hl: 'bài điền chỗ trống',
    subtitle: `Bộ đề có ${total} câu, môn ${bank.subject}.`,
  }));

  const p1 = panel([]);
  p1.appendChild(el('div', { style: { fontSize: '12px', fontWeight: 700 }, text: '1 · Số câu hỏi' }));
  p1.appendChild(el('div', { class: 'muted-line', style: { marginBottom: '14px' }, text: 'Chọn số câu cho lượt làm bài này.' }));
  const countGrid = el('div', { class: 'choice-grid', style: { gridTemplateColumns: `repeat(${FILL_COUNT_CHOICES.length + 1}, 1fr)` } });
  const choices = [...FILL_COUNT_CHOICES.map((n) => [n, 'câu']), [total, 'toàn bộ']];
  choices.forEach(([value, caption]) => {
    const enabled = total >= value;
    const card = el('div', { class: `count-card${enabled ? ' enabled' : ''}${state.count === value ? ' selected' : ''}` }, [
      el('div', { class: 'num', text: String(value) }), el('div', { class: 'cap', text: caption }),
    ]);
    if (state.count === value) card.appendChild(el('div', { class: 'check-badge', html: icon('check', 11) }));
    if (enabled) card.addEventListener('click', () => {
      state.count = value;
      countGrid.querySelectorAll('.count-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      redrawChecks(countGrid);
    });
    countGrid.appendChild(card);
  });
  p1.appendChild(countGrid);
  root.appendChild(p1);

  const p2 = panel([]);
  p2.style.marginTop = '14px';
  p2.appendChild(el('div', { style: { fontSize: '12px', fontWeight: 700 }, text: '2 · Cách điền' }));
  p2.appendChild(el('div', { class: 'muted-line', style: { marginBottom: '14px' }, text: 'Gõ trực tiếp bằng bàn phím, hoặc kéo thả từ có sẵn.' }));
  const modeGrid = el('div', { class: 'choice-grid', style: { gridTemplateColumns: '1fr 1fr' } });
  [
    ['type', 'keyboard', 'Gõ đáp án', 'Bàn phím thường, gõ đúng từ/cụm từ vào từng chỗ trống. Chấm không phân biệt hoa thường.'],
    ['drag', 'cursor', 'Kéo thả từ', 'Các từ đúng được xáo sẵn phía dưới, giữ chuột kéo đúng từ thả vào ô trống tương ứng.'],
  ].forEach(([mode, ic, title, desc]) => {
    const card = el('div', { class: `mc-mode-card${state.fillMode === mode ? ' selected' : ''}` }, [
      el('div', { class: 'head' }, [el('span', { html: icon(ic, 18) }), el('span', { text: title })]),
      el('div', { class: 'desc', text: desc }),
    ]);
    if (state.fillMode === mode) card.appendChild(el('div', { class: 'check-badge', html: icon('check', 11) }));
    card.addEventListener('click', () => {
      state.fillMode = mode;
      modeGrid.querySelectorAll('.mc-mode-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      redrawChecks(modeGrid);
    });
    modeGrid.appendChild(card);
  });
  p2.appendChild(modeGrid);
  root.appendChild(p2);

  const startBtn = btn('BẮT ĐẦU LÀM BÀI', async () => {
    const who = await promptCandidateName(App);
    if (!who) return;
    await App.startFillQuiz(bank.id, state.count, state.fillMode, who);
  }, { kind: 'primary', block: true });
  startBtn.style.height = '52px'; startBtn.style.fontSize = '13px'; startBtn.style.marginTop = '18px';
  root.appendChild(startBtn);
  root.appendChild(el('div', { style: { height: '22px' } }));
}

// ================================================================ LAM BAI
function numberedText(text) {
  const parts = text.split('___');
  let out = parts[0];
  for (let i = 1; i < parts.length; i += 1) out += ` ⟦${i}⟧ ` + parts[i];
  return out;
}

async function renderFillQuiz(root, App, session) {
  unbindKeys(); stopTimer();
  const head = el('div', { class: 'stage-head' });
  const counter = el('span', { class: 'counter' });
  const subject = el('span', { class: 'subject' });
  const timerEl = el('span', { style: { fontWeight: 700, color: 'var(--accent-2)', marginRight: '16px' } });
  head.append(counter, subject, el('div', { class: 'spacer' }), timerEl,
    btn('Thoát', confirmExit, { kind: 'ghost', small: true, iconName: 'close' }));
  root.appendChild(head);

  const progress = el('div', { class: 'progress-track', style: { margin: '14px 0 0' } }, [el('div', { class: 'progress-fill', style: { background: 'var(--accent-2)' } })]);
  root.appendChild(progress);

  const body = el('div', { class: 'mt16' });
  root.appendChild(body);

  const foot = el('div', { class: 'row gap10 mt18' });
  const prevBtn = btn('Câu trước', () => nav(-1), { kind: 'ghost' });
  const nextBtn = btn('Câu tiếp theo', () => nav(1), { kind: 'primary' });
  foot.append(el('div', { class: 'credit', text: CREDIT }), el('div', { class: 'spacer' }), prevBtn, nextBtn);
  root.appendChild(foot);
  root.appendChild(el('div', { style: { height: '18px' } }));

  function render() {
    const q = session.questions[session.index];
    const given = session.answers[session.index];
    counter.textContent = `Câu ${session.index + 1} / ${session.total}`;
    subject.textContent = session.bank.name;
    progress.firstChild.style.width = `${(session.index / Math.max(1, session.total)) * 100}%`;

    body.innerHTML = '';
    const sentencePanel = panel([el('div', { class: 'fill-sentence', html: numberedText(q.text).replace(/⟦(\d+)⟧/g, '<span class="mark">⟦$1⟧</span>') })]);
    sentencePanel.style.padding = '0';
    body.appendChild(sentencePanel);

    const blanksPanel = panel([]);
    blanksPanel.style.marginTop = '14px';
    blanksPanel.appendChild(el('div', { class: 'muted-line', style: { marginBottom: '10px' }, text: 'CHỖ TRỐNG CẦN ĐIỀN' }));
    q.blanks.forEach((_, bi) => {
      const row = el('div', { class: 'blank-row' });
      row.appendChild(el('div', { class: 'blank-num', text: String(bi + 1) }));
      if (session.fillMode === 'type') {
        const input = el('input', { class: 'text-input', style: { flex: '1' } });
        input.value = given[bi] || '';
        input.addEventListener('input', () => { session.answers[session.index][bi] = input.value; });
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') nav(1); });
        row.appendChild(input);
        if (bi === 0) setTimeout(() => input.focus(), 20);
      } else {
        const slot = el('div', { class: `drop-slot${given[bi] ? ' filled' : ''}`, text: given[bi] || 'kéo thả vào đây' });
        slot.dataset.blankIndex = String(bi);
        slot.addEventListener('dragover', (e) => { e.preventDefault(); slot.classList.add('dragover'); });
        slot.addEventListener('dragleave', () => slot.classList.remove('dragover'));
        slot.addEventListener('drop', (e) => {
          e.preventDefault();
          slot.classList.remove('dragover');
          if (slot.classList.contains('filled')) return;
          const word = e.dataTransfer.getData('text/plain');
          const chipId = e.dataTransfer.getData('text/chip-id');
          fillSlot(slot, bi, word, chipId);
        });
        slot.addEventListener('click', () => { if (slot.classList.contains('filled')) clearSlot(slot, bi); });
        row.appendChild(slot);
      }
      blanksPanel.appendChild(row);
    });
    body.appendChild(blanksPanel);

    if (session.fillMode === 'drag') {
      const poolPanel = panel([]);
      poolPanel.style.marginTop = '14px';
      poolPanel.appendChild(el('div', { class: 'muted-line', style: { marginBottom: '10px' }, text: 'TỪ CÓ SẴN — KÉO VÀO Ô TRỐNG PHÍA TRÊN' }));
      const pool = el('div', { class: 'chip-pool' });
      const words = shuffleArray(q.blanks.slice());
      const takenWords = given.filter(Boolean).slice();
      words.forEach((word, wi) => {
        const chipId = `c${wi}`;
        const isUsed = takenWords.includes(word) && takenWords.splice(takenWords.indexOf(word), 1);
        const dragChip = el('div', { class: `drag-chip${isUsed ? ' used' : ''}`, text: word, attrs: { draggable: isUsed ? 'false' : 'true', 'data-chip-id': chipId } });
        dragChip.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', word);
          e.dataTransfer.setData('text/chip-id', chipId);
          dragChip.classList.add('dragging');
        });
        dragChip.addEventListener('dragend', () => dragChip.classList.remove('dragging'));
        pool.appendChild(dragChip);
      });
      poolPanel.appendChild(pool);
      body.appendChild(poolPanel);
    }

    prevBtn.disabled = session.index === 0;
    nextBtn.querySelector('span').textContent = session.index === session.total - 1 ? 'Xem kết quả' : 'Câu tiếp theo';
  }

  function fillSlot(slot, blankIndex, word, chipId) {
    session.answers[session.index][blankIndex] = word;
    slot.textContent = word;
    slot.classList.add('filled');
    const chipEl_ = body.querySelector(`.drag-chip[data-chip-id="${chipId}"]`);
    if (chipEl_) { chipEl_.classList.add('used'); chipEl_.draggable = false; }
  }
  function clearSlot(slot, blankIndex) {
    session.answers[session.index][blankIndex] = null;
    slot.textContent = 'kéo thả vào đây';
    slot.classList.remove('filled');
    render();
  }

  function nav(delta) {
    if (delta > 0 && session.index >= session.total - 1) { finish(); return; }
    session.index = Math.max(0, Math.min(session.total - 1, session.index + delta));
    render();
  }
  async function confirmExit() {
    if (await confirmDialog('Thoát bài làm?', 'Kết quả của phiên này sẽ không được lưu.', { confirmLabel: 'Thoát', danger: true })) {
      stopTimer();
      App.navigate('fillhub');
    }
  }
  function finish() { stopTimer(); App.finishFillQuiz(session); }

  function tick() {
    session.seconds = Math.floor((Date.now() - session.startedAt) / 1000);
    timerEl.textContent = fmtTime(session.seconds);
  }
  stopTimer(); tick();
  _activeTimerId = setInterval(tick, 1000);

  render();
}

// ================================================================= KET QUA
async function renderFillResult(root, App, session) {
  const right = session.correct();
  const percent = session.total ? Math.round((right / session.total) * 100) : 0;
  let verdict, color;
  if (percent >= 90) { verdict = 'Xuất sắc!'; color = 'var(--ok)'; }
  else if (percent >= 75) { verdict = 'Khá tốt!'; color = 'var(--accent-2)'; }
  else if (percent >= 50) { verdict = 'Trung bình'; color = 'var(--warn)'; }
  else { verdict = 'Cần cố gắng thêm'; color = 'var(--bad)'; }

  root.appendChild(pageTitle({ title: 'Kết quả', hl: session.bank.name }));
  const hero = panel([], { classes: 'result-hero' });
  hero.appendChild(scoreRing(percent, right, session.total, color));
  const info = el('div', {});
  info.appendChild(el('div', { class: 'result-verdict', text: verdict, style: { color } }));
  if (session.studentName) info.appendChild(el('div', { class: 'muted-line mt8', text: `Học viên: ${session.studentName}` }));
  const chips = el('div', { class: 'result-chips' });
  chips.append(
    chipEl(`✓ Đúng ${right}`, { tone: 'ok' }), chipEl(`✕ Sai ${session.total - right}`),
    chipEl(`⏱ ${fmtTime(session.seconds)}`), chipEl(session.fillMode === 'type' ? 'Gõ đáp án' : 'Kéo thả'),
  );
  info.appendChild(chips);
  const actions = el('div', { class: 'result-actions' });
  actions.append(
    btn('Làm bộ đề khác', () => App.navigate('fillsetup', { bankId: session.bank.id }), { kind: 'primary', iconName: 'download' }),
    btn('Về trang chủ', () => App.navigate('start'), { kind: 'ghost', iconName: 'home' }),
  );
  info.appendChild(actions);
  hero.appendChild(info);
  root.appendChild(hero);

  const head = sectionHead('Xem lại bài làm');
  let onlyWrong = false;
  const filterBtn = btn(`Chỉ câu sai (${session.total - right})`, () => { onlyWrong = !onlyWrong; renderReview(); }, { kind: 'ghost', small: true });
  head.appendChild(filterBtn);
  root.appendChild(head);
  const reviewArea = el('div');
  root.appendChild(reviewArea);

  function renderReview() {
    reviewArea.innerHTML = '';
    filterBtn.querySelector('span').textContent = onlyWrong ? 'Xem tất cả' : `Chỉ câu sai (${session.total - right})`;
    let shown = 0;
    session.questions.forEach((q, qi) => {
      const isRight = session.questionCorrect(qi);
      if (onlyWrong && isRight) return;
      shown += 1;
      const card = panel([], { classes: 'q-card' });
      const head2 = el('div', { class: 'head' });
      head2.append(el('div', { class: `q-badge ${isRight ? 'tone-ok' : 'tone-bad'}`, text: String(qi + 1) }),
        el('div', { class: 'q-text', html: numberedText(q.text).replace(/⟦(\d+)⟧/g, '<span style="color:var(--accent-2)">⟦$1⟧</span>') }));
      card.appendChild(head2);
      q.blanks.forEach((correctWord, bi) => {
        const given = session.answers[qi][bi];
        const ok = session.blankCorrect(qi, bi);
        const row = el('div', { class: 'review-blank row gap10' }, [
          el('span', { style: { color: 'var(--muted)', fontWeight: 700 }, text: `⟦${bi + 1}⟧` }),
          el('span', { style: { color: ok ? 'var(--ok-text)' : 'var(--dim)' }, text: `Đáp án đúng: ${correctWord}` }),
        ]);
        if (!ok) row.appendChild(el('span', { style: { color: 'var(--bad-text)' }, text: `Bạn điền: ${given || '(bỏ trống)'}` }));
        card.appendChild(row);
      });
      reviewArea.appendChild(card);
    });
    if (!shown) reviewArea.appendChild(emptyState('check', 'Không có câu nào sai', 'Bạn đã điền đúng toàn bộ đề. Rất tốt!'));
  }
  renderReview();
  root.appendChild(el('div', { style: { height: '20px' } }));
}

// ============================================================ SOAN CAU
const FILL_ROWS_PER_PAGE = 20;

async function renderFillEditor(root, App, bankId) {
  const state = { keyword: '', page: 0 };
  await build();

  async function build() {
    root.innerHTML = '';
    const bank = await App.api.getFillBank(bankId);
    if (!bank) { App.navigate('fillhub'); return; }

    root.appendChild(el('div', { class: 'mt8' }, [btn('Danh sách bộ đề', () => App.navigate('fillhub'), { kind: 'ghost', small: true, iconName: 'arrowLeft' })]));
    root.appendChild(pageTitle({
      eyebrow: `📘 ${bank.name}`, title: 'Soạn câu', hl: 'điền chỗ trống',
      subtitle: `Môn ${bank.subject} · ${bank.questions.length} câu. Câu không đánh dấu {{...}} sẽ được app tự bốc từ ngẫu nhiên mỗi lượt làm.`,
    }));

    const tools = el('div', { class: 'row gap8 wrap', style: { marginBottom: '14px' } });
    const searchInput = el('input', { class: 'text-input', style: { width: '260px' }, attrs: { placeholder: 'Tìm câu... rồi bấm Enter' } });
    searchInput.value = state.keyword;
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.keyword = searchInput.value; state.page = 0; build(); } });
    tools.append(searchInput, btn('', () => { state.keyword = searchInput.value; state.page = 0; build(); }, { kind: 'ghost', iconName: 'search' }));
    tools.appendChild(btn('Thêm câu', () => editFillQuestion(App, bank, -1, build), { kind: 'primary', small: true, iconName: 'plus' }));
    tools.appendChild(btn('Đổi tên / môn', () => renameFillBank(App, bank, build), { kind: 'ghost', small: true, iconName: 'pencil' }));
    tools.appendChild(btn('Xuất .txt', () => exportFillBank(App, bank.id), { kind: 'ghost', small: true, iconName: 'download' }));
    root.appendChild(tools);

    const keyword = state.keyword.toLowerCase().trim();
    const items = bank.questions
      .map((q, i) => [i, q])
      .filter(([, q]) => !keyword || q.text.toLowerCase().includes(keyword) || q.blanks.some((b) => b.toLowerCase().includes(keyword)));

    const pages = Math.max(1, Math.ceil(items.length / FILL_ROWS_PER_PAGE));
    state.page = Math.min(state.page, pages - 1);
    const windowItems = items.slice(state.page * FILL_ROWS_PER_PAGE, (state.page + 1) * FILL_ROWS_PER_PAGE);

    if (!items.length) {
      root.appendChild(emptyState('search', bank.questions.length ? 'Không tìm thấy câu phù hợp' : 'Chưa có câu nào',
        bank.questions.length ? 'Thử từ khoá khác hoặc xoá ô tìm kiếm.' : 'Bấm "Thêm câu" để soạn câu đầu tiên.'));
      return;
    }

    windowItems.forEach(([index, q]) => root.appendChild(fillQuestionRow(App, bank, index, q, build)));

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

function fillLineFromQuestion(q) {
  const isAuto = q.auto === undefined ? !q.blanks.length : q.auto;
  if (isAuto) return q.text;
  let text = q.text;
  q.blanks.forEach((b) => { text = text.replace('___', `{{${b}}}`); });
  return text;
}

function fillQuestionRow(App, bank, index, q, refresh) {
  const isAuto = q.auto === undefined ? !q.blanks.length : q.auto;
  const row = panel([], { classes: 'q-card' });
  const head = el('div', { class: 'head', style: { justifyContent: 'space-between' } });
  const left = el('div', { class: 'row gap10' });
  left.appendChild(el('div', { class: 'q-badge', style: { background: 'var(--surface-2)', color: 'var(--dim)' }, text: String(index + 1) }));
  const textWrap = el('div', {}, [
    el('div', { class: 'q-text', html: numberedText(q.text).replace(/⟦(\d+)⟧/g, '<span style="color:var(--accent-2)">⟦$1⟧</span>') }),
    el('div', { class: 'row gap6 mt8' }, [
      chipEl(isAuto ? 'Tự động bốc từ' : `Thủ công · ${q.blanks.length} chỗ trống`, { tone: isAuto ? '' : 'active' }),
    ]),
  ]);
  left.appendChild(textWrap);
  head.appendChild(left);
  const actions = el('div', { class: 'row gap6' });
  actions.appendChild(btn('', () => editFillQuestion(App, bank, index, refresh), { kind: 'ghost', small: true, iconName: 'pencil' }));
  actions.appendChild(btn('', async () => {
    if (await confirmDialog(`Xoá câu ${index + 1}?`, q.text.slice(0, 140), { confirmLabel: 'Xoá', danger: true })) {
      const fresh = await App.api.getFillBank(bank.id);
      fresh.questions.splice(index, 1);
      await App.api.upsertFillBank(fresh);
      toast('Đã xoá câu', 'ok');
      refresh();
    }
  }, { kind: 'ghost', small: true, iconName: 'trash' }));
  head.appendChild(actions);
  row.appendChild(head);
  return row;
}

function editFillQuestion(App, bank, index, refresh) {
  const isNew = index < 0;
  const question = isNew ? null : bank.questions[index];
  const initialLine = isNew ? '' : fillLineFromQuestion(question);

  const input = el('textarea', { class: 'text-area', attrs: { rows: 4, style: 'font-size:13px;min-height:100px' } });
  input.value = initialLine;
  const hint = el('div', { class: 'muted-line mt10', text: 'Không đánh dấu gì: app tự bốc 1-3 từ ngẫu nhiên mỗi lượt làm. Muốn ép đúng từ thì bọc quanh nó bằng {{đáp án}}, có thể nhiều chỗ trong 1 câu. Enter để xuống dòng cho dễ nhìn, Ctrl+Enter để lưu.' });
  const body = el('div', {}, [
    el('label', { class: 'field-label', text: 'Nội dung câu (ít nhất 3 từ)' }), input, hint,
  ]);

  const modal = openModal({
    title: isNew ? 'Thêm câu' : `Sửa câu ${index + 1}`, subtitle: `Bộ đề: ${bank.name}`, body, width: 720,
    footer: (footer, close) => {
      footer.appendChild(btn('Huỷ', close, { kind: 'ghost' }));
      footer.appendChild(btn('Lưu lại', save, { kind: 'primary', iconName: 'check' }));
    },
  });
  setTimeout(() => { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }, 30);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.ctrlKey) save(); });

  async function save() {
    const raw = input.value.replace(/\s+/g, ' ').trim();
    if (!raw) { toast('Chưa nhập nội dung câu', 'err'); return; }
    const { questions, issues } = await App.api.parseFillQuestions(raw);
    if (questions.length !== 1) {
      toast(issues.length ? 'Câu quá ngắn hoặc không hợp lệ (cần ít nhất 3 từ, hoặc đủ cặp {{...}})' : 'Không đọc được câu này', 'err');
      return;
    }
    const payload = questions[0];
    if (!isNew) payload.id = question.id;
    const fresh = await App.api.getFillBank(bank.id);
    if (isNew) fresh.questions.push(payload);
    else fresh.questions[index] = payload;
    await App.api.upsertFillBank(fresh);
    modal.close();
    toast(isNew ? 'Đã thêm câu mới' : 'Đã lưu thay đổi', 'ok');
    refresh();
  }
}

function renameFillBank(App, bank, refresh) {
  const nameInput = el('input', { class: 'text-input' });
  nameInput.value = bank.name;
  const subjectInput = el('input', { class: 'text-input' });
  subjectInput.value = bank.subject;
  const body = el('div', {}, [
    el('label', { class: 'field-label', text: 'Tên bộ đề' }), nameInput,
    el('label', { class: 'field-label mt10', text: 'Môn học' }), subjectInput,
  ]);
  const modal = openModal({
    title: 'Đổi tên / môn học', body,
    footer: (footer, close) => {
      footer.appendChild(btn('Huỷ', close, { kind: 'ghost' }));
      footer.appendChild(btn('Lưu', save, { kind: 'primary' }));
    },
  });
  async function save() {
    const name = nameInput.value.trim();
    const subject = subjectInput.value.trim() || 'Chung';
    if (!name) { toast('Tên bộ đề không được để trống', 'err'); return; }
    const fresh = await App.api.getFillBank(bank.id);
    fresh.name = name;
    fresh.subject = subject;
    await App.api.upsertFillBank(fresh);
    modal.close();
    toast('Đã lưu thay đổi', 'ok');
    refresh();
  }
}

async function exportFillBank(App, bankId) {
  const bank = await App.api.getFillBank(bankId);
  if (!bank) return;
  const content = await App.api.exportFillTxt(bank);
  const path = await App.api.saveTxt(`${bank.name}.txt`, content);
  if (path) toast(`Đã xuất ${path.split(/[\\/]/).pop()}`, 'ok');
}
