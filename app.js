'use strict';
/** Dieu phoi trung tam: header/nav, chuyen man hinh (crossfade, khong xe khung), phien lam bai. */

window.addEventListener('error', (e) => console.error('window.onerror:', e.message, e.filename + ':' + e.lineno));
window.addEventListener('unhandledrejection', (e) => console.error('unhandledrejection:', e.reason && (e.reason.stack || e.reason)));

const NAV_ITEMS = [
  { key: 'start', label: 'Trang chủ', icon: 'home' },
  { key: 'hub', label: 'Trắc nghiệm', icon: 'check' },
  { key: 'fillhub', label: 'Điền chỗ trống', icon: 'pencil' },
  { key: 'gradehub', label: 'Bảng điểm', icon: 'chart' },
  { key: 'banks', label: 'Ngân hàng đề', icon: 'book' },
  { key: 'history', label: 'Lịch sử', icon: 'clock' },
  { key: 'sync', label: 'Đồng bộ', icon: 'upload' },
  { key: 'guide', label: 'Hướng dẫn', icon: 'notes' },
];

let activeLayer = 'a';
// Khoa tuan tu: 2 lan goi mountScreen() gan nhau (bam 2 lan, hoac card + nut
// con cung kich hoat navigate gan nhu dong thoi) khong duoc phep chay xen ke
// nhau — neu khong ca hai se cung nham vao 1 lop man hinh (vi activeLayer
// chi cap nhat SAU khi render xong) va noi dung 2 man bi ve chong len nhau,
// nhin nhu giao dien bi nhan doi. Hang doi promise nay ep chung chay noi tiep.
let _mountQueue = Promise.resolve();

function mountScreen(renderFn) {
  _mountQueue = _mountQueue.then(() => mountScreenNow(renderFn), () => mountScreenNow(renderFn));
  return _mountQueue;
}

async function mountScreenNow(renderFn) {
  const current = document.getElementById(`screen-${activeLayer}`);
  const nextId = activeLayer === 'a' ? 'b' : 'a';
  const next = document.getElementById(`screen-${nextId}`);
  next.innerHTML = '';
  try {
    await renderFn(next);
  } catch (err) {
    next.appendChild(el('div', { class: 'panel', text: `Lỗi hiển thị: ${err.message}` }));
    console.error(err);
  }
  next.scrollTop = 0;
  next.classList.add('visible');
  current.classList.remove('visible');
  activeLayer = nextId;
  setTimeout(() => { if (!current.classList.contains('visible')) current.innerHTML = ''; }, 220);
}

const App = {
  api: window.api,
  toast,
  session: null,
  fillSession: null,
  // Bản web: thí sinh tự do — chỉ có TÊN, không có đơn vị/lớp.
  candidateName: '',

  setChrome(visible) {
    document.getElementById('app-shell').classList.toggle('chromeless', !visible);
    document.getElementById('app-container').classList.toggle('chromeless', !visible);
  },

  setActiveNav(name) {
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.key === name));
  },

  async navigate(name, params = {}) {
    this.screen = name;
    updateDesktopContext(this,name);
    this.setChrome(true);
    this.setActiveNav(name);
    const renderers = {
      start: (c) => renderModeHub(c, App),
      hub: (c) => renderMcqHub(c, App),
      setup: (c) => renderMcqSetup(c, App, params.bankId),
      banks: (c) => (params.openBank ? renderBankEditor(c, App, params.openBank) : renderBanksList(c, App, Boolean(params.importNow))),
      history: (c) => renderHistory(c, App),
      fillhub: (c) => renderFillHub(c, App),
      fillsetup: (c) => renderFillSetup(c, App, params.bankId),
      filleditor: (c) => renderFillEditor(c, App, params.bankId),
      guide: (c) => renderGuide(c),
      sync: (c) => renderSyncScreen(c, App),
      gradehub: (c) => renderGradeHub(c, App),
      gradeboard: (c) => renderGradeBoard(c, App, { kind: params.kind, bankId: params.bankId }),
    };
    const fn = renderers[name];
    if (!fn) return;
    await mountScreen(fn);
  },

  async startQuiz(bankId, count, mode, shuffleOptions, autoNext, student) {
    updateDesktopContext(this,'quiz');
    const bank = await this.api.getBank(bankId);
    if (!bank || !bank.questions.length) { toast('Môn học này chưa có câu hỏi nào', 'err'); return; }
    const session = createMcqSession(bank, count, mode, shuffleOptions, autoNext, student.name);
    session.studentId = student.id || 'free';
    this.session = session;
    this.setActiveNav(null);
    if (mode === 'stage') {
      this.setChrome(false);
      await mountScreen((c) => renderStage(c, App, session));
    } else {
      this.setChrome(true);
      await mountScreen((c) => renderPersonal(c, App, session));
    }
  },

  async finishQuiz(session) {
    await saveMcqResult(this.api, session);
    this.setChrome(true);
    await mountScreen((c) => renderMcqResult(c, App, session));
  },

  async startFillQuiz(bankId, count, fillMode, student) {
    updateDesktopContext(this,'quiz');
    const bank = await this.api.getFillBank(bankId);
    if (!bank || !bank.questions.length) { toast('Bộ đề này chưa có câu hỏi nào', 'err'); return; }
    const session = await createFillSession(this.api, bank, count, fillMode, student.name);
    session.studentId = student.id || 'free';
    this.fillSession = session;
    this.setActiveNav(null);
    this.setChrome(true);
    await mountScreen((c) => renderFillQuiz(c, App, session));
  },

  async finishFillQuiz(session) {
    await saveFillResult(this.api, session);
    this.setChrome(true);
    await mountScreen((c) => renderFillResult(c, App, session));
  },
};

// ---------------------------------------------------------------- phien MCQ
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function sampleArray(arr, n) { return shuffleArray(arr.slice()).slice(0, n); }

// Mot so file .txt nguon co cau hoi trung noi dung (khac id). Loc trung theo
// noi dung TRUOC khi bo vao 1 lan lam bai, de khong bao gio ra 2 cau y het
// nhau trong cung 1 de — ngan hang van giu nguyen, chi loc luc bat dau lam.
function uniqueByText(questions) {
  const seen = new Set();
  const out = [];
  for (const q of questions) {
    const key = q.text.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

function shuffleQuestionOptions(q) {
  const pairs = q.options.map((text, i) => [i, text]);
  shuffleArray(pairs);
  return { id: q.id, text: q.text, options: pairs.map((p) => p[1]), answer: pairs.findIndex((p) => p[0] === q.answer) };
}

function createMcqSession(bank, count, mode, shuffleOptions, autoNext, studentName) {
  const pool = uniqueByText(bank.questions);
  const picked = sampleArray(pool, Math.min(count, pool.length));
  const questions = shuffleOptions ? picked.map(shuffleQuestionOptions) : picked;
  return {
    bank, mode, autoNext, studentName, questions,
    answers: new Array(questions.length).fill(null),
    index: 0, page: 0, startedAt: Date.now(), seconds: 0, total: questions.length,
    answered() { return this.answers.filter((a) => a !== null).length; },
    correct() { return this.answers.reduce((n, a, i) => n + (a === this.questions[i].answer ? 1 : 0), 0); },
  };
}

async function saveMcqResult(api, session) {
  const seconds = session.mode === 'personal' ? session.seconds : Math.round((Date.now() - session.startedAt) / 1000);
  session.seconds = seconds;
  await api.addHistory({
    bankId: session.bank.id, bankName: session.bank.name, mode: session.mode, studentName: session.studentName,
    studentId: session.studentId || 'free',
    total: session.total, correct: session.correct(), seconds, at: Date.now(),
  });
}

// --------------------------------------------------------------- phien Fill
async function createFillSession(api, bank, count, fillMode, studentName) {
  const picked = sampleArray(bank.questions, Math.min(count, bank.questions.length));
  const questions = [];
  for (const q of picked) {
    const isAuto = q.auto === undefined ? !q.blanks.length : q.auto;
    if (isAuto) {
      const made = await api.autoBlank(q.text);
      questions.push({ id: q.id, text: made.text, blanks: made.blanks });
    } else {
      questions.push({ id: q.id, text: q.text, blanks: q.blanks.slice() });
    }
  }
  return {
    bank, fillMode, studentName, mode: 'fill', questions,
    answers: questions.map((q) => new Array(q.blanks.length).fill(null)),
    index: 0, startedAt: Date.now(), seconds: 0, total: questions.length,
    norm(v) { return v ? v.trim().toLowerCase().replace(/\s+/g, ' ') : ''; },
    blankCorrect(qi, bi) { return this.norm(this.answers[qi][bi]) === this.norm(this.questions[qi].blanks[bi]); },
    questionCorrect(qi) { return this.questions[qi].blanks.every((_, bi) => this.blankCorrect(qi, bi)); },
    correct() { let n = 0; for (let i = 0; i < this.total; i += 1) if (this.questionCorrect(i)) n += 1; return n; },
  };
}

async function saveFillResult(api, session) {
  const seconds = Math.round((Date.now() - session.startedAt) / 1000);
  session.seconds = seconds;
  await api.addHistory({
    bankId: session.bank.id, bankName: session.bank.name, mode: 'fill', studentName: session.studentName,
    studentId: session.studentId || 'free',
    total: session.total, correct: session.correct(), seconds, at: Date.now(),
  });
}

// ------------------------------------------------------------------- khoi dong
function buildNav() {
  const nav = document.getElementById('app-nav');
  NAV_ITEMS.forEach((item) => {
    const b = el('button', { class: 'nav-btn', attrs: { 'data-key': item.key, title:item.label, 'aria-label':item.label }, html: `${icon(item.icon, 15)}<span>${item.label}</span>` });
    b.addEventListener('click', () => App.navigate(item.key));
    nav.appendChild(b);
  });
  fitHeaderNav();
}

window.App = App;
window.__appReady = new Promise((resolve) => { window.__resolveAppReady = resolve; });

document.addEventListener('DOMContentLoaded', async () => {
  buildDesktopChrome(App);
  buildNav();
  document.getElementById('brand').addEventListener('click', () => App.navigate('start'));
  const logoImg = document.getElementById('brand-logo');
  if (logoImg) {
    logoImg.addEventListener('error', () => {
      logoImg.remove();
      document.getElementById('brand-mark').textContent = 'TN';
    });
  }
  document.getElementById(`screen-${activeLayer}`).classList.add('visible');

  let seedResult = { added: 0, issues: [] };
  try {
    seedResult = await App.api.seedSamples();
  } catch (err) {
    console.error(err);
  }
  try {
    const prefs = await App.api.prefs();
    App.candidateName = String(prefs.studentName || '').trim();
  } catch (err) { /* chưa có tuỳ chọn */ }
  await App.navigate('start');
  if (seedResult.added) toast(`Đã nạp ${seedResult.added} môn học từ file .txt trong thư mục`, 'ok');
  if (seedResult.issues && seedResult.issues.length) {
    App.api.log('Câu hỏi bị bỏ qua (thiếu đáp án hoặc thiếu lựa chọn):', seedResult.issues.join(' | '));
  }
  window.__resolveAppReady();
});
