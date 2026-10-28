'use strict';
/** Hai che do lam bai trac nghiem (giang duong / ca nhan) va man hinh ket qua. */

const LETTERS = ['A', 'B', 'C', 'D'];
const PAGE_SIZE = 10;
const CREDIT = 'Thực hiện bởi Đại Đội 5 · NVQYc43.A9-A10';

let _activeKeyHandler = null;
let _activeTimerId = null;
function unbindKeys() { if (_activeKeyHandler) { document.removeEventListener('keydown', _activeKeyHandler); _activeKeyHandler = null; } }
function bindKeys(fn) { unbindKeys(); _activeKeyHandler = fn; document.addEventListener('keydown', fn); }
function stopTimer() { if (_activeTimerId) { clearInterval(_activeTimerId); _activeTimerId = null; } }

// ======================================================== che do giang duong
async function renderStage(root, App, session) {
  unbindKeys(); stopTimer();
  root.style.padding = '0';
  const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } });

  const head = el('div', { class: 'stage-head', style: { padding: '18px 26px 0' } });
  const counter = el('span', { class: 'counter' });
  const subject = el('span', { class: 'subject' });
  const scoreOk = el('span', { class: 'score-ok' });
  const scoreBad = el('span', { class: 'score-bad' });
  head.append(counter, subject, el('div', { class: 'spacer' }), scoreOk, scoreBad,
    btn('Thoát', () => confirmExit(), { kind: 'ghost', small: true, iconName: 'close' }));
  wrap.appendChild(head);

  const progress = el('div', { class: 'progress-track', style: { margin: '14px 26px 0' } }, [el('div', { class: 'progress-fill' })]);
  wrap.appendChild(progress);

  const qPanel = panel([], { classes: 'stage-question', });
  qPanel.style.margin = '16px 26px 0';
  wrap.appendChild(qPanel);

  const optionArea = el('div', { class: 'stage-options', style: { flex: '1', padding: '16px 26px' } });
  wrap.appendChild(optionArea);

  const foot = el('div', { class: 'stage-foot' });
  const hint = el('div', { class: 'hint', text: 'Bấm A B C D hoặc 1 2 3 4 để chọn · Enter: câu tiếp · Esc: thoát' });
  const prevBtn = btn('Câu trước', () => prevQuestion(), { kind: 'ghost' });
  const nextBtn = btn('Câu tiếp theo', () => nextQuestion(), { kind: 'primary' });
  foot.append(el('div', { class: 'credit', text: CREDIT }), el('div', { class: 'spacer' }), prevBtn, nextBtn);
  wrap.appendChild(foot);

  root.appendChild(wrap);

  function render() {
    const q = session.questions[session.index];
    const picked = session.answers[session.index];
    counter.textContent = `Câu ${session.index + 1} / ${session.total}`;
    subject.textContent = session.bank.name;
    const right = session.correct();
    scoreOk.textContent = `✓ ${right}`;
    scoreBad.textContent = `✕ ${session.answered() - right}`;
    qPanel.textContent = q.text;
    progress.firstChild.style.width = `${(session.index / Math.max(1, session.total)) * 100}%`;

    optionArea.innerHTML = '';
    q.options.forEach((text, i) => {
      const opt = el('div', { class: 'big-option' }, [
        el('div', { class: 'badge', text: LETTERS[i] }),
        el('div', { class: 'text', text }),
        el('div', { class: 'mark' }),
      ]);
      opt.addEventListener('click', () => pick(i));
      optionArea.appendChild(opt);
    });
    if (picked !== null) paintAnswer(picked, q.answer);

    prevBtn.disabled = session.index === 0;
    nextBtn.disabled = picked === null;
    nextBtn.querySelector('span').textContent = session.index === session.total - 1 ? 'Xem kết quả' : 'Câu tiếp theo';
  }

  function paintAnswer(picked, answer) {
    const opts = optionArea.querySelectorAll('.big-option');
    opts.forEach((opt, i) => {
      opt.classList.remove('correct', 'wrong', 'dim');
      const mark = opt.querySelector('.mark');
      if (i === answer) { opt.classList.add('correct'); mark.textContent = '✓'; }
      else if (i === picked) { opt.classList.add('wrong'); mark.textContent = '✕'; }
      else opt.classList.add('dim');
    });
  }

  let autoTimeout = null;
  function pick(i) {
    if (session.answers[session.index] !== null) return;
    session.answers[session.index] = i;
    const answer = session.questions[session.index].answer;
    paintAnswer(i, answer);
    const right = session.correct();
    scoreOk.textContent = `✓ ${right}`;
    scoreBad.textContent = `✕ ${session.answered() - right}`;
    nextBtn.disabled = false;
    if (session.autoNext) {
      autoTimeout = setTimeout(() => nextQuestion(), i === answer ? 1200 : 2400);
    }
  }

  function nextQuestion() {
    if (autoTimeout) { clearTimeout(autoTimeout); autoTimeout = null; }
    if (session.index >= session.total - 1) { finish(); return; }
    session.index += 1;
    render();
  }
  function prevQuestion() {
    if (autoTimeout) { clearTimeout(autoTimeout); autoTimeout = null; }
    if (session.index > 0) { session.index -= 1; render(); }
  }
  async function confirmExit() {
    if (autoTimeout) { clearTimeout(autoTimeout); autoTimeout = null; }
    if (await confirmDialog('Thoát bài làm?', 'Kết quả của phiên này sẽ không được lưu.', { confirmLabel: 'Thoát', danger: true })) {
      unbindKeys();
      App.navigate('hub');
    }
  }
  function finish() { unbindKeys(); App.finishQuiz(session); }

  bindKeys((e) => {
    const key = e.key.toLowerCase();
    if ('abcd'.includes(key)) pick('abcd'.indexOf(key));
    else if ('1234'.includes(key)) pick('1234'.indexOf(key));
    else if (key === 'enter' || key === ' ') { if (session.answers[session.index] !== null) nextQuestion(); }
    else if (key === 'arrowright') { if (session.answers[session.index] !== null) nextQuestion(); }
    else if (key === 'arrowleft') prevQuestion();
    else if (key === 'escape') confirmExit();
  });

  render();
}

// ========================================================= che do ca nhan
async function renderPersonal(root, App, session) {
  unbindKeys(); stopTimer();
  const layout = el('div', { class: 'personal-layout' });
  const main = el('div', { class: 'personal-main' });
  const side = el('div', { class: 'personal-side' });
  layout.append(main, side);
  root.appendChild(layout);

  const timerPanel = panel([
    el('div', { class: 'muted-line', text: '⏱ THỜI GIAN' }),
    el('div', { class: 'timer-value' }),
  ]);
  const donePanel = el('div', { class: 'muted-line mt10' });
  timerPanel.appendChild(donePanel);
  side.appendChild(timerPanel);

  const dotPanel = panel([el('div', { class: 'muted-line', text: 'DANH SÁCH CÂU' })]);
  dotPanel.style.marginTop = '12px';
  const dotGrid = el('div', { class: 'dot-grid' });
  dotPanel.appendChild(dotGrid);
  side.appendChild(dotPanel);

  const cancelBtn = btn('Huỷ bài làm', () => confirmQuit(), { kind: 'danger', block: true, iconName: 'close' });
  cancelBtn.style.marginTop = '12px';
  side.appendChild(cancelBtn);

  const timerEl = timerPanel.querySelector('.timer-value');
  const dots = [];
  for (let i = 0; i < session.total; i += 1) {
    const d = el('div', { class: 'dot', text: String(i + 1) });
    d.addEventListener('click', () => jumpTo(i));
    dots.push(d);
    dotGrid.appendChild(d);
  }
  function drawDot(i) { dots[i].classList.toggle('answered', session.answers[i] !== null); }
  dots.forEach((_, i) => drawDot(i));

  function renderMain() {
    main.innerHTML = '';
    root.scrollTop = 0; // sang trang la nhay len dau, khong bat nguoi dung phai tu keo
    const pages = Math.max(1, Math.ceil(session.total / PAGE_SIZE));
    const start = session.page * PAGE_SIZE;
    main.appendChild(pageTitle({ eyebrow: 'Chế độ cá nhân', title: session.bank.name, subtitle: `Chọn đáp án cho tất cả ${session.total} câu rồi bấm Nộp bài để xem kết quả.` }));

    session.questions.slice(start, start + PAGE_SIZE).forEach((q, offset) => {
      main.appendChild(questionCard(q, start + offset));
    });

    const pager = el('div', { class: 'pager-row' });
    const prevP = btn('Trang trước', () => { session.page -= 1; renderMain(); }, { kind: 'ghost', small: true, iconName: 'arrowLeft' });
    prevP.disabled = session.page === 0;
    pager.appendChild(prevP);
    pager.appendChild(el('span', { class: 'muted-line', text: `Trang ${session.page + 1} / ${pages}` }));
    if (session.page >= pages - 1) {
      pager.appendChild(btn('NỘP BÀI', trySubmit, { kind: 'primary', small: true, iconName: 'flag' }));
    } else {
      pager.appendChild(btn('Trang sau', () => { session.page += 1; renderMain(); }, { kind: 'primary', small: true, iconName: 'arrowRight' }));
    }
    main.appendChild(pager);
    updateSide();
  }

  function questionCard(q, index) {
    const card = panel([], { classes: 'q-card' });
    const head = el('div', { class: 'head' });
    head.append(el('div', { class: 'q-badge', text: String(index + 1) }), el('div', { class: 'q-text', text: q.text }));
    card.appendChild(head);
    q.options.forEach((text, oi) => {
      const row = el('div', { class: `option-row${session.answers[index] === oi ? ' picked' : ''}` }, [
        el('div', { class: 'letter', text: LETTERS[oi] }), el('div', { class: 'text', text }),
      ]);
      row.addEventListener('click', () => pick(index, oi));
      card.appendChild(row);
    });
    return card;
  }

  function pick(qi, oi) {
    session.answers[qi] = oi;
    renderMain();
    drawDot(qi);
  }

  function updateSide() {
    donePanel.textContent = `Đã làm ${session.answered()} / ${session.total} câu`;
  }

  function jumpTo(i) {
    const page = Math.floor(i / PAGE_SIZE);
    if (page !== session.page) { session.page = page; renderMain(); }
  }

  function tick() {
    session.seconds = Math.floor((Date.now() - session.startedAt) / 1000);
    timerEl.textContent = fmtTime(session.seconds);
  }
  stopTimer();
  tick();
  _activeTimerId = setInterval(tick, 1000);

  async function trySubmit() {
    const missing = session.total - session.answered();
    if (missing && !(await confirmDialog(`Còn ${missing} câu chưa làm`, 'Các câu bỏ trống sẽ bị tính là sai. Vẫn nộp bài?', { confirmLabel: 'Nộp bài' }))) return;
    stopTimer();
    App.finishQuiz(session);
  }
  async function confirmQuit() {
    if (await confirmDialog('Huỷ bài làm?', 'Toàn bộ đáp án đã chọn sẽ bị xoá.', { confirmLabel: 'Huỷ bài', danger: true })) {
      stopTimer();
      App.navigate('hub');
    }
  }

  renderMain();
}

// ================================================================= KET QUA
async function renderMcqResult(root, App, session) {
  unbindKeys(); stopTimer();
  const right = session.correct();
  const percent = Math.round((right / session.total) * 100);
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
  const chips = el('div', { class: 'result-chips' });
  chips.append(
    chipEl(`✓ Đúng ${right}`, { tone: 'ok' }),
    chipEl(`✕ Sai ${session.total - right}`),
    chipEl(`⏱ ${fmtTime(session.seconds)}`),
    chipEl(session.mode === 'stage' ? 'Giảng đường' : 'Cá nhân'),
  );
  info.appendChild(chips);
  const actions = el('div', { class: 'result-actions' });
  actions.append(
    btn('Làm đề khác', () => App.navigate('setup', { bankId: session.bank.id }), { kind: 'primary', iconName: 'download' }),
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

  const reviewArea = el('div', { class: 'mt0' });
  root.appendChild(reviewArea);

  function renderReview() {
    reviewArea.innerHTML = '';
    filterBtn.querySelector('span').textContent = onlyWrong ? 'Xem tất cả' : `Chỉ câu sai (${session.total - right})`;
    let shown = 0;
    session.questions.forEach((q, i) => {
      const picked = session.answers[i];
      const isRight = picked === q.answer;
      if (onlyWrong && isRight) return;
      shown += 1;
      const card = panel([], { classes: 'q-card' });
      const head2 = el('div', { class: 'head' });
      head2.append(el('div', { class: `q-badge ${isRight ? 'tone-ok' : 'tone-bad'}`, text: String(i + 1) }), el('div', { class: 'q-text', text: q.text }));
      card.appendChild(head2);
      q.options.forEach((text, oi) => {
        const row = el('div', { class: 'option-row', style: { cursor: 'default' } }, [el('div', { class: 'letter', text: LETTERS[oi] }), el('div', { class: 'text', text })]);
        if (oi === q.answer) { row.classList.add('correct'); row.appendChild(el('div', { class: 'tail', text: 'Đáp án đúng' })); }
        else if (oi === picked) { row.classList.add('wrong'); row.appendChild(el('div', { class: 'tail', text: 'Bạn chọn' })); }
        card.appendChild(row);
      });
      if (picked === null) card.appendChild(el('div', { class: 'muted-line mt8', text: 'Bạn đã bỏ trống câu này.' }));
      reviewArea.appendChild(card);
    });
    if (!shown) reviewArea.appendChild(emptyState('check', 'Không có câu nào sai', 'Bạn đã trả lời đúng toàn bộ đề. Rất tốt!'));
  }
  renderReview();
  root.appendChild(el('div', { style: { height: '20px' } }));
}

function scoreRing(percent, right, total, color) {
  const R = 79; const C = 2 * Math.PI * R;
  const offset = C - (C * percent) / 100;
  const svg = `<svg viewBox="0 0 190 190">
    <circle cx="95" cy="95" r="${R}" fill="none" stroke="var(--surface-2)" stroke-width="14"/>
    <circle cx="95" cy="95" r="${R}" fill="none" stroke="${color}" stroke-width="14" stroke-linecap="round"
      stroke-dasharray="${C}" stroke-dashoffset="${offset}"/>
  </svg>`;
  return el('div', { class: 'ring-wrap', html: svg }, [
    el('div', { class: 'ring-center' }, [
      el('div', { class: 'ring-percent', text: `${percent}%`, style: { color } }),
      el('div', { class: 'ring-sub', text: `${right} / ${total} câu đúng` }),
    ]),
  ]);
}
