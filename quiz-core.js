/**
 * quiz-core.js (bản WEB) — toàn bộ logic xử lý đề, chạy trực tiếp trong trình duyệt.
 * Chỉ khác bản Electron ở chỗ sinh id: dùng crypto.getRandomValues thay cho
 * require('crypto'). Phần phân tích đề / xuất đề GIỮ NGUYÊN 1:1 để file .txt
 * đang dùng vẫn đọc được y hệt bản desktop.
 */
'use strict';

/* Bọc trong IIFE: bản web nạp bằng <script> nên mọi khai báo ở cấp cao nhất
   đều thành biến toàn cục và sẽ đụng tên với các tệp màn hình (ví dụ LETTERS
   cũng được khai báo trong screens.mcq.js). Chỉ để lộ đúng window.QuizCore. */
(function () {

const __crypto = (typeof crypto !== 'undefined' && crypto) ? crypto : window.crypto;
function __randHex(bytes) {
  const buf = new Uint8Array(bytes);
  __crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

const LETTERS = ['A', 'B', 'C', 'D'];

const OPTION_RE = /^\s*([A-Da-d])\s*[).:\-]\s*(.+)$/;
const ANSWER_RE = /^\s*(?:ANSWER|ĐÁP\s*ÁN|DAP\s*AN)\s*[:.\-]?\s*([A-Da-d])\s*$/i;
const ANSWER_EMPTY_RE = /^\s*(?:ANSWER|ĐÁP\s*ÁN|DAP\s*AN)\s*[:.\-]?\s*$/i;
const NUMBERING_RE = /^\s*(?:C[âa]u\s*)?\d+\s*[.):\-]\s*/i;
const BLANK_RE = /\{\{\s*(.+?)\s*\}\}/g;

function newId(prefix = 'q') {
  return prefix + __randHex(6);
}

const COMBINING_MARKS_RE = new RegExp('[̀-ͯ]', 'g');

function slugify(value) {
  const noAccent = value
    .normalize('NFD')
    .replace(COMBINING_MARKS_RE, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
  const slug = noAccent.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || 'de-thi';
}

function parseQuestions(raw) {
  const questions = [];
  const issues = [];
  let qText = [];
  let options = [];

  function flush(answerIndex, lineNo) {
    let joined = qText.map((s) => s.trim()).join(' ').trim();
    joined = joined.replace(NUMBERING_RE, '').trim();
    if (joined && options.length === 4 && answerIndex >= 0 && answerIndex < 4) {
      questions.push({ id: newId(), text: joined, options: options.slice(), answer: answerIndex });
    } else if (joined) {
      issues.push(`Dòng ${lineNo}: ${joined.slice(0, 70)}`);
    }
    qText = [];
    options = [];
  }

  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    const stripped = line.trim();
    if (!stripped) return;

    const answerMatch = stripped.match(ANSWER_RE);
    if (answerMatch) {
      flush(LETTERS.indexOf(answerMatch[1].toUpperCase()), lineNo);
      return;
    }
    if (ANSWER_EMPTY_RE.test(stripped)) {
      flush(-1, lineNo);
      return;
    }
    const optionMatch = stripped.match(OPTION_RE);
    if (optionMatch && qText.length && options.length < 4) {
      options.push(optionMatch[2].trim());
      return;
    }
    if (options.length) {
      options[options.length - 1] = `${options[options.length - 1]} ${stripped}`;
    } else {
      qText.push(stripped);
    }
  });

  return { questions, issues };
}

function loadTxtBank(name, raw) {
  const { questions, issues } = parseQuestions(raw);
  return { id: slugify(name), name, source: 'sample', questions, issues };
}

function exportTxt(bank) {
  const chunks = bank.questions.map((q) => {
    const lines = [q.text, ...q.options.map((opt, i) => `${LETTERS[i]}) ${opt}`), `ANSWER: ${LETTERS[q.answer]}`];
    return lines.join('\n');
  });
  return chunks.join('\n') + '\n';
}

// ---------------------------------------------------------------- dien vao cho trong

function parseFillQuestions(raw) {
  const questions = [];
  const issues = [];
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;

    const blanks = [];
    let m;
    BLANK_RE.lastIndex = 0;
    while ((m = BLANK_RE.exec(line)) !== null) {
      const val = m[1].trim();
      if (val) blanks.push(val);
    }
    if (blanks.length) {
      const display = line.replace(BLANK_RE, '___').replace(NUMBERING_RE, '').trim();
      questions.push({ id: newId('f'), text: display, blanks, auto: false });
      return;
    }
    const text = line.replace(NUMBERING_RE, '').trim();
    if (text.split(/\s+/).filter(Boolean).length < 3) {
      if (text) issues.push(`Dòng ${lineNo}: ${text.slice(0, 70)}`);
      return;
    }
    questions.push({ id: newId('f'), text, blanks: [], auto: true });
  });

  return { questions, issues };
}

const FILL_STOPWORDS = new Set([
  'là', 'và', 'của', 'có', 'được', 'trong', 'cho', 'các', 'những', 'với',
  'để', 'khi', 'này', 'đó', 'một', 'hay', 'hoặc', 'thì', 'đã', 'sẽ',
  'không', 'như', 'theo', 'về', 'cũng', 'tại', 'từ', 'đến', 'nên', 'nếu',
  'mà', 'rất', 'chỉ', 'còn', 'nhưng', 'vì', 'do', 'nào', 'gì', 'ai', 'bị',
  'bởi', 'ở', 'ra', 'vào', 'lên', 'xuống', 'đi', 'lại', 'trên', 'dưới',
  'sau', 'trước', 'cả', 'mỗi', 'từng', 'người', 'cái', 'con',
]);
const FILL_PUNCT = '.,;:!?()[]{}"\'“”‘’…«»';

function wordCore(token) {
  let start = 0;
  let end = token.length;
  while (start < end && FILL_PUNCT.includes(token[start])) start += 1;
  while (end > start && FILL_PUNCT.includes(token[end - 1])) end -= 1;
  return token.slice(start, end);
}

function sample(array, count, rng = Math.random) {
  const pool = array.slice();
  const out = [];
  for (let i = 0; i < count && pool.length; i += 1) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function autoBlank(text, rng = Math.random) {
  const tokens = text.split(' ');
  let eligible = tokens
    .map((t, i) => [i, t])
    .filter(([, t]) => wordCore(t).length >= 2 && !FILL_STOPWORDS.has(wordCore(t).toLowerCase()))
    .map(([i]) => i);
  if (!eligible.length) {
    eligible = tokens.map((t, i) => [i, t]).filter(([, t]) => wordCore(t)).map(([i]) => i);
  }
  if (!eligible.length) return { text, blanks: [] };

  let count = eligible.length <= 6 ? 1 : eligible.length <= 14 ? 2 : 3;
  count = Math.min(count, eligible.length);
  const chosen = sample(eligible, count, rng).sort((a, b) => a - b);

  const blanks = [];
  const out = tokens.slice();
  chosen.forEach((i) => {
    const token = tokens[i];
    const core = wordCore(token);
    const start = token.indexOf(core);
    blanks.push(core);
    out[i] = token.slice(0, start) + '___' + token.slice(start + core.length);
  });
  return { text: out.join(' '), blanks };
}

function exportFillTxt(bank) {
  const lines = bank.questions.map((q) => {
    if (q.auto === undefined ? !q.blanks.length : q.auto) return q.text;
    let text = q.text;
    q.blanks.forEach((answer) => {
      text = text.replace('___', `{{${answer}}}`);
    });
    return text;
  });
  return lines.join('\n') + '\n';
}

const FILL_TEMPLATE = `# MẪU ĐỀ ĐIỀN VÀO CHỖ TRỐNG
# - Mỗi DÒNG là MỘT câu, cứ dán câu bình thường, KHÔNG cần đánh dấu gì cả.
# - App sẽ TỰ ĐỘNG bốc ngẫu nhiên 1-3 từ quan trọng trong mỗi câu làm chỗ
#   trống — mỗi lượt làm bài có thể ra từ khác nhau, soạn đề không lo lộ đáp án.
# - Muốn ép đúng từ cần hỏi thì bọc quanh nó bằng {{ }}, ví dụ:
#     Huyết áp bình thường là {{120}}/{{80}} mmHg.
# - Xoá các dòng bắt đầu bằng # này đi cũng được, chỉ là ghi chú thôi.
# - Lưu file bằng định dạng .txt, mã hoá UTF-8 rồi tải lên trong app.

Tim người bình thường có 4 ngăn.
Đơn vị cấu trúc và chức năng cơ bản của thận là nephron.
Da là cơ quan có diện tích lớn nhất trên cơ thể người.
Huyết áp bình thường ở người trưởng thành là {{120}}/{{80}} mmHg.
`;

// ------------------------------------------------------- danh sach hoc vien
// Dinh dang 1 dong / 1 hoc vien: "Tieu doan | Dai doi | Lop | Ho ten"
function parseRoster(raw) {
  const students = [];
  const issues = [];
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length !== 4 || parts.some((p) => !p)) {
      issues.push(`Dòng ${idx + 1}: ${line.slice(0, 70)}`);
      return;
    }
    const [battalion, company, className, name] = parts;
    students.push({ id: newId('s'), battalion, company, className, name });
  });
  return { students, issues };
}

function exportRosterTxt(students) {
  const lines = students.map((s) => `${s.battalion} | ${s.company} | ${s.className} | ${s.name}`);
  return lines.join('\n') + '\n';
}

const ROSTER_TEMPLATE = `# MẪU DANH SÁCH HỌC VIÊN
# Mỗi DÒNG là một học viên, 4 phần cách nhau bằng dấu | theo đúng thứ tự:
#   Tiểu đoàn | Đại đội | Lớp | Họ và tên
# Ví dụ:

Tiểu đoàn 1 | Đại đội 2 | A9 | Nguyễn Văn A
Tiểu đoàn 1 | Đại đội 2 | A9 | Trần Thị B
Tiểu đoàn 1 | Đại đội 3 | A10 | Lê Văn C
`;

window.QuizCore = {
  LETTERS, newId, parseRoster, exportRosterTxt, ROSTER_TEMPLATE, slugify,
  parseQuestions, loadTxtBank, exportTxt, parseFillQuestions, autoBlank,
  exportFillTxt, FILL_TEMPLATE,
};
})();
