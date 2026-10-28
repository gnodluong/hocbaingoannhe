/**
 * store.js — Lưu trữ của bản WEB.
 *
 * Bản desktop ghi ra các file JSON trong thư mục data/ cạnh app. Trình duyệt
 * không có thư mục, nên toàn bộ dữ liệu nằm trong IndexedDB (dung lượng lớn
 * hơn localStorage rất nhiều — ngân hàng đề đã ~1 MB, cộng đề điền chỗ trống,
 * học viên và lịch sử), giữ nguyên tên khoá giống hệt bản desktop:
 *   banks · fillBanks · roster · history · prefs
 *
 * Toàn bộ luật chuẩn hoá/ghép dữ liệu dưới đây được port 1:1 từ storage.js của
 * bản Electron để hai bản cho ra kết quả giống nhau.
 */
'use strict';

const TN_HUES = ['#6C7DFF', '#22D3EE', '#B57BFF', '#F59E0B', '#34D399', '#FB7185', '#38BDF8'];
const TN_DEFAULT_PREFS = { count: 50, mode: 'stage', shuffleOptions: true, autoNext: false, studentName: '' };
const TN_MAX_HISTORY = 100;
const TN_DB_NAME = 'tracnghiem-dd5';
const TN_DB_VERSION = 1;
const TN_SAMPLE_MANIFEST = 'samples/manifest.json';

class Store {
  constructor() {
    this.data = { banks: [], fillBanks: [], roster: [], history: [], prefs: { ...TN_DEFAULT_PREFS } };
    this.logs = [];
    this._sampleCache = null;
    this._db = null;
    this.ready = this._init();
  }

  /* ------------------------------------------------------------------ nền tảng */
  async _init() {
    this._db = await this._openDb();
    const keys = ['banks', 'fillBanks', 'roster', 'history', 'prefs'];
    for (const key of keys) {
      const value = await this._read(key, null);
      if (value !== null && value !== undefined) this.data[key] = value;
    }
    this.data.prefs = { ...TN_DEFAULT_PREFS, ...(this.data.prefs && typeof this.data.prefs === 'object' ? this.data.prefs : {}) };
    return true;
  }

  _openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('Trình duyệt này không hỗ trợ IndexedDB.'));
        return;
      }
      const request = indexedDB.open(TN_DB_NAME, TN_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Không mở được cơ sở dữ liệu trình duyệt.'));
    });
  }

  _read(key, fallback) {
    return new Promise((resolve) => {
      try {
        const tx = this._db.transaction('kv', 'readonly');
        const req = tx.objectStore('kv').get(key);
        req.onsuccess = () => resolve(req.result === undefined ? fallback : req.result);
        req.onerror = () => resolve(fallback);
      } catch (err) {
        resolve(fallback);
      }
    });
  }

  _write(key, payload) {
    this.data[key] = payload;
    return new Promise((resolve) => {
      try {
        const tx = this._db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(payload, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch (err) {
        resolve(false);
      }
    });
  }

  log(...parts) {
    const line = `[${new Date().toLocaleString('vi-VN')}] ${parts.join(' ')}`;
    this.logs.unshift(line);
    if (this.logs.length > 500) this.logs.pop();
    try { console.log('[TN]', ...parts); } catch (err) { /* bỏ qua */ }
  }

  colorFor(id) {
    let sum = 0;
    for (const ch of String(id)) sum += ch.charCodeAt(0);
    return TN_HUES[sum % TN_HUES.length];
  }

  /* ---------------------------------------------------------------- MCQ banks */
  normalize(bank) {
    bank.id = bank.id || QuizCore.slugify(bank.name || 'de-thi');
    bank.name = bank.name || 'Đề chưa đặt tên';
    bank.source = bank.source || 'import';
    bank.createdAt = bank.createdAt || Date.now();
    bank.updatedAt = bank.updatedAt || Date.now();
    bank.color = bank.color || this.colorFor(bank.id);
    delete bank.issues;

    bank.questions = (bank.questions || []).map((item) => {
      const options = (item.options || []).slice(0, 4);
      while (options.length < 4) options.push('');
      return {
        id: item.id || QuizCore.newId(),
        text: item.text || '',
        options,
        answer: ((item.answer || 0) % 4 + 4) % 4,
      };
    });
    return bank;
  }

  async allBanks() {
    await this.ready;
    return Array.isArray(this.data.banks) ? this.data.banks.map((b) => this.normalize(b)) : [];
  }

  async saveBanks(banks) {
    return this._write('banks', banks.map((b) => this.normalize(b)));
  }

  async getBank(id) {
    return (await this.allBanks()).find((b) => b.id === id) || null;
  }

  async upsertBank(bank) {
    bank = this.normalize(bank);
    bank.updatedAt = Date.now();
    const banks = await this.allBanks();
    const idx = banks.findIndex((b) => b.id === bank.id);
    if (idx >= 0) banks[idx] = bank;
    else banks.push(bank);
    await this.saveBanks(banks);
    return bank;
  }

  async removeBank(id) {
    await this.saveBanks((await this.allBanks()).filter((b) => b.id !== id));
  }

  async uniqueId(baseId) {
    const taken = new Set((await this.allBanks()).map((b) => b.id));
    if (!taken.has(baseId)) return baseId;
    let n = 2;
    while (taken.has(`${baseId}-${n}`)) n += 1;
    return `${baseId}-${n}`;
  }

  // -------------------------------------------------------- de mau .txt (MCQ)
  async sampleBanks() {
    if (this._sampleCache) return this._sampleCache;
    let names = [];
    try {
      const res = await fetch(TN_SAMPLE_MANIFEST, { cache: 'no-cache' });
      if (res.ok) names = await res.json();
    } catch (err) {
      this.log('Không đọc được danh mục đề mẫu:', err.message);
    }
    if (!Array.isArray(names)) names = [];
    const banks = [];
    for (const entry of names) {
      const file = typeof entry === 'string' ? entry : entry.file;
      if (!file) continue;
      try {
        const res = await fetch(`samples/${encodeURIComponent(file)}`);
        if (!res.ok) continue;
        const raw = await res.text();
        const name = (typeof entry === 'string' ? file : entry.name || file).replace(/\.txt$/i, '');
        const bank = QuizCore.loadTxtBank(name, raw);
        if (bank.questions.length) banks.push(bank);
      } catch (err) {
        this.log(`Không đọc được đề mẫu ${file}:`, err.message);
      }
    }
    this._sampleCache = banks;
    return banks;
  }

  async seedSamples() {
    const banks = await this.allBanks();
    const known = new Set(banks.map((b) => b.id));
    let added = 0;
    const issues = [];
    for (const sample of await this.sampleBanks()) {
      for (const msg of sample.issues || []) issues.push(`${sample.name} — ${msg}`);
      if (known.has(sample.id)) continue;
      banks.push(this.normalize(JSON.parse(JSON.stringify(sample))));
      added += 1;
    }
    if (added) await this.saveBanks(banks);
    return { added, issues };
  }

  async restoreSample(id) {
    const sample = (await this.sampleBanks()).find((b) => b.id === id);
    if (!sample) return null;
    return this.upsertBank(this.normalize(JSON.parse(JSON.stringify(sample))));
  }

  async hasSample(id) {
    return (await this.sampleBanks()).some((b) => b.id === id);
  }

  // ---------------------------------------------------------- fill-in-blank
  normalizeFill(bank) {
    bank.id = bank.id || QuizCore.slugify(bank.name || 'de-dien');
    bank.name = bank.name || 'Đề chưa đặt tên';
    bank.subject = bank.subject || 'Chung';
    bank.createdAt = bank.createdAt || Date.now();
    bank.updatedAt = bank.updatedAt || Date.now();
    bank.color = bank.color || this.colorFor(bank.id);

    bank.questions = (bank.questions || [])
      .map((item) => {
        const text = String(item.text || '').trim();
        if (!text) return null;
        const blanks = (item.blanks || []).map(String).filter((b) => b.trim());
        const auto = item.auto === undefined ? !blanks.length : Boolean(item.auto);
        if (!auto && !blanks.length) return null;
        return { id: item.id || QuizCore.newId('f'), text, blanks: auto ? [] : blanks, auto };
      })
      .filter(Boolean);
    return bank;
  }

  async allFillBanks() {
    await this.ready;
    return Array.isArray(this.data.fillBanks) ? this.data.fillBanks.map((b) => this.normalizeFill(b)) : [];
  }

  async saveFillBanks(banks) {
    return this._write('fillBanks', banks.map((b) => this.normalizeFill(b)));
  }

  async getFillBank(id) {
    return (await this.allFillBanks()).find((b) => b.id === id) || null;
  }

  async upsertFillBank(bank) {
    bank = this.normalizeFill(bank);
    bank.updatedAt = Date.now();
    const banks = await this.allFillBanks();
    const idx = banks.findIndex((b) => b.id === bank.id);
    if (idx >= 0) banks[idx] = bank;
    else banks.push(bank);
    await this.saveFillBanks(banks);
    return bank;
  }

  async removeFillBank(id) {
    await this.saveFillBanks((await this.allFillBanks()).filter((b) => b.id !== id));
  }

  async uniqueFillId(baseId) {
    const taken = new Set((await this.allFillBanks()).map((b) => b.id));
    if (!taken.has(baseId)) return baseId;
    let n = 2;
    while (taken.has(`${baseId}-${n}`)) n += 1;
    return `${baseId}-${n}`;
  }

  async fillSubjects() {
    const seen = [];
    for (const bank of await this.allFillBanks()) {
      if (!seen.includes(bank.subject)) seen.push(bank.subject);
    }
    return seen;
  }

  // -------------------------------------------------------- danh sach hoc vien
  async allStudents() {
    await this.ready;
    return Array.isArray(this.data.roster) ? this.data.roster : [];
  }

  async saveStudents(students) {
    return this._write('roster', students);
  }

  async upsertStudent(student) {
    const students = await this.allStudents();
    student.id = student.id || QuizCore.newId('s');
    const idx = students.findIndex((s) => s.id === student.id);
    if (idx >= 0) students[idx] = student;
    else students.push(student);
    await this.saveStudents(students);
    return student;
  }

  async removeStudent(id) {
    await this.saveStudents((await this.allStudents()).filter((s) => s.id !== id));
  }

  async importStudents(students) {
    const existing = await this.allStudents();
    const key = (s) => `${s.battalion}${s.company}${s.className}${s.name}`.toLowerCase();
    const known = new Set(existing.map(key));
    let added = 0;
    for (const s of students) {
      if (known.has(key(s))) continue;
      existing.push(s);
      known.add(key(s));
      added += 1;
    }
    await this.saveStudents(existing);
    return added;
  }

  async battalions() {
    const seen = [];
    for (const s of await this.allStudents()) if (!seen.includes(s.battalion)) seen.push(s.battalion);
    return seen;
  }

  async companies(battalion) {
    const seen = [];
    for (const s of await this.allStudents()) {
      if (s.battalion === battalion && !seen.includes(s.company)) seen.push(s.company);
    }
    return seen;
  }

  async classes(battalion, company) {
    const seen = [];
    for (const s of await this.allStudents()) {
      if (s.battalion === battalion && s.company === company && !seen.includes(s.className)) seen.push(s.className);
    }
    return seen;
  }

  async studentsIn(battalion, company, className) {
    return (await this.allStudents()).filter(
      (s) => s.battalion === battalion && s.company === company && s.className === className
    );
  }

  // ------------------------------------------------------------------ lich su
  async history() {
    await this.ready;
    return Array.isArray(this.data.history) ? this.data.history : [];
  }

  async addHistory(entry) {
    const items = await this.history();
    items.unshift(entry);
    await this._write('history', items.slice(0, TN_MAX_HISTORY));
  }

  async clearHistory() {
    await this._write('history', []);
  }

  // ------------------------------------------------------------------ tuy chon
  async prefs() {
    await this.ready;
    const value = this.data.prefs;
    return { ...TN_DEFAULT_PREFS, ...(typeof value === 'object' && value ? value : {}) };
  }

  async setPrefs(patch, { requireWrite = false } = {}) {
    const merged = { ...(await this.prefs()), ...patch };
    const saved = await this._write('prefs', merged);
    if (!saved && requireWrite) throw new Error('Không ghi được tuỳ chọn vào bộ nhớ trình duyệt.');
    return merged;
  }

  // -------------------------------------------------- dong bo giua cac may
  async exportAll() {
    return JSON.stringify(
      {
        kind: 'tracnghiem-backup',
        version: 1,
        exportedAt: Date.now(),
        banks: await this.allBanks(),
        fillBanks: await this.allFillBanks(),
        roster: await this.allStudents(),
        history: await this.history(),
      },
      null,
      1
    );
  }

  async importAll(raw) {
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      return { ok: false, error: 'File không đúng định dạng (không đọc được JSON).' };
    }
    if (!payload || payload.kind !== 'tracnghiem-backup') {
      return { ok: false, error: 'File này không phải file dữ liệu của app.' };
    }

    let banksAdded = 0; let fillAdded = 0; let studentsAdded = 0; let historyAdded = 0;

    if (Array.isArray(payload.banks)) {
      const existing = await this.allBanks();
      const merged = [...existing.filter((b) => !payload.banks.some((nb) => nb.id === b.id)), ...payload.banks];
      await this.saveBanks(merged);
      banksAdded = payload.banks.length;
    }

    if (Array.isArray(payload.fillBanks)) {
      const existing = await this.allFillBanks();
      const merged = [...existing.filter((b) => !payload.fillBanks.some((nb) => nb.id === b.id)), ...payload.fillBanks];
      await this.saveFillBanks(merged);
      fillAdded = payload.fillBanks.length;
    }

    if (Array.isArray(payload.roster)) {
      studentsAdded = await this.importStudents(payload.roster);
    }

    if (Array.isArray(payload.history)) {
      const existing = await this.history();
      const key = (h) => `${h.at}|${h.bankId}|${h.studentName}|${h.correct}|${h.total}`;
      const known = new Set(existing.map(key));
      const fresh = payload.history.filter((h) => !known.has(key(h)));
      historyAdded = fresh.length;
      const merged = [...fresh, ...existing].sort((a, b) => b.at - a.at).slice(0, TN_MAX_HISTORY);
      await this._write('history', merged);
    }

    return { ok: true, banksAdded, fillAdded, studentsAdded, historyAdded };
  }

  /**
   * Xoá sạch dữ liệu trong trình duyệt (dùng cho trang "Đặt lại" của bản web).
   * Không có trong bản desktop vì bản đó xoá bằng cách xoá thư mục data.
   */
  async wipe() {
    for (const key of ['banks', 'fillBanks', 'roster', 'history', 'prefs']) {
      await this._write(key, key === 'prefs' ? { ...TN_DEFAULT_PREFS } : []);
    }
    this._sampleCache = null;
  }
}

window.TNStore = new Store();
