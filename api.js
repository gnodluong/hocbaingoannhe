/**
 * api.js — Thay thế preload.js (window.api) của bản Electron bằng bản chạy
 * trong trình duyệt. Giữ ĐÚNG tên hàm và kiểu trả về (đều là Promise) để toàn
 * bộ mã giao diện dùng lại được mà không phải sửa gì.
 *
 * Tương ứng:
 *   IPC storage:*  ->  TNStore (IndexedDB)
 *   IPC core:*     ->  QuizCore (quiz-core.js)
 *   dialog:*       ->  <input type="file"> và tải file bằng Blob
 *   theme:/win:    ->  localStorage + CSS data-theme; điều khiển cửa sổ là no-op
 */
'use strict';

(function () {
  const THEME_KEY = 'tn-theme';
  const THEMES = ['light', 'dark', 'purple', 'ocean', 'teal', 'amber', 'rose'];
  const VERSION = '1.1.3';

  const normalizeTheme = (value) => (THEMES.includes(value) ? value : 'dark');
  const store = () => window.TNStore;
  const core = () => window.QuizCore;

  function readTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved) return normalizeTheme(saved);
    } catch (err) { /* chế độ riêng tư chặn localStorage */ }
    return 'dark';
  }

  function applyTheme(value) {
    document.documentElement.dataset.theme = value;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_BG[value] || THEME_BG.dark;
  }

  const THEME_BG = {
    light: '#F4F6FA', dark: '#101722', purple: '#080C18', ocean: '#0B1725',
    teal: '#0B1B1A', amber: '#1B1510', rose: '#1D121A',
  };

  /* ------------------------------------------------------- chọn / tải tệp */
  function pickFiles({ multiple = true, accept = '.txt,text/plain' } = {}) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = multiple;
      input.style.position = 'fixed';
      input.style.left = '-9999px';
      document.body.appendChild(input);

      let settled = false;
      const finish = (files) => {
        if (settled) return;
        settled = true;
        input.remove();
        resolve(files);
      };

      input.addEventListener('change', () => finish([...(input.files || [])]));
      input.addEventListener('cancel', () => finish([]));
      // Trình duyệt không bắn sự kiện nào nếu người dùng đóng hộp chọn tệp ở
      // một số phiên bản: lắng nghe thêm lần focus lại để không treo Promise.
      window.addEventListener(
        'focus',
        () => setTimeout(() => {
          if (!settled && (!input.files || !input.files.length)) finish([]);
        }, 800),
        { once: true }
      );
      input.click();
    });
  }

  async function readAsText(file) {
    if (typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Không đọc được tệp.'));
      reader.readAsText(file, 'utf-8');
    });
  }

  function downloadText(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'tracnghiem.txt';
    link.style.position = 'fixed';
    link.style.left = '-9999px';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 1500);
  }

  const noop = () => Promise.resolve({ ok: true });

  window.api = {
    /* Giao diện -------------------------------------------------------- */
    initialTheme: readTheme(),
    theme: {
      get: async () => {
        const prefs = await store().prefs();
        return normalizeTheme(prefs.desktopTheme || readTheme());
      },
      set: async (value) => {
        const selected = normalizeTheme(value);
        await store().setPrefs({ desktopTheme: selected }, { requireWrite: false });
        try { localStorage.setItem(THEME_KEY, selected); } catch (err) { /* bỏ qua */ }
        applyTheme(selected);
        return selected;
      },
    },
    info: async () => ({
      version: VERSION,
      dataDir: 'Bộ nhớ trình duyệt (IndexedDB)',
      title: 'Trắc Nghiệm · Đại Đội 5',
      mode: 'web',
    }),

    // Bản web không có menu hệ thống / nút cửa sổ — giữ hàm rỗng cho tương thích.
    menu: noop,
    onNavigate: () => () => {},
    win: {
      minimize: noop,
      toggleMaximize: async () => ({ maximized: false }),
      close: noop,
      state: async () => ({ maximized: false, fullScreen: Boolean(document.fullscreenElement) }),
      onState: () => () => {},
    },

    /* Ngân hàng trắc nghiệm ------------------------------------------- */
    allBanks: () => store().allBanks(),
    getBank: (id) => store().getBank(id),
    upsertBank: (bank) => store().upsertBank(bank),
    removeBank: (id) => store().removeBank(id),
    uniqueId: (base) => store().uniqueId(base),
    seedSamples: () => store().seedSamples(),
    restoreSample: (id) => store().restoreSample(id),
    hasSample: (id) => store().hasSample(id),

    /* Điền chỗ trống --------------------------------------------------- */
    allFillBanks: () => store().allFillBanks(),
    getFillBank: (id) => store().getFillBank(id),
    upsertFillBank: (bank) => store().upsertFillBank(bank),
    removeFillBank: (id) => store().removeFillBank(id),
    uniqueFillId: (base) => store().uniqueFillId(base),
    fillSubjects: () => store().fillSubjects(),

    /* Học viên --------------------------------------------------------- */
    allStudents: () => store().allStudents(),
    upsertStudent: (student) => store().upsertStudent(student),
    removeStudent: (id) => store().removeStudent(id),
    importStudents: (students) => store().importStudents(students),
    battalions: () => store().battalions(),
    companies: (battalion) => store().companies(battalion),
    classes: (battalion, company) => store().classes(battalion, company),
    studentsIn: (b, c, k) => store().studentsIn(b, c, k),
    parseRoster: async (raw) => core().parseRoster(raw),
    exportRosterTxt: async (students) => core().exportRosterTxt(students),
    rosterTemplate: async () => core().ROSTER_TEMPLATE,

    /* Đồng bộ ---------------------------------------------------------- */
    exportAll: () => store().exportAll(),
    importAll: (raw) => store().importAll(raw),

    /* Lịch sử / tuỳ chọn ---------------------------------------------- */
    history: () => store().history(),
    addHistory: (entry) => store().addHistory(entry),
    clearHistory: () => store().clearHistory(),
    prefs: () => store().prefs(),
    setPrefs: (patch) => store().setPrefs(patch),
    log: (...parts) => store().log(...parts),

    /* Xử lý đề (quiz-core) -------------------------------------------- */
    parseQuestions: async (raw) => core().parseQuestions(raw),
    parseFillQuestions: async (raw) => core().parseFillQuestions(raw),
    autoBlank: async (text) => core().autoBlank(text),
    slugify: async (name) => core().slugify(name),
    exportTxt: async (bank) => core().exportTxt(bank),
    exportFillTxt: async (bank) => core().exportFillTxt(bank),
    fillTemplate: async () => core().FILL_TEMPLATE,

    /* Tệp -------------------------------------------------------------- */
    openTxtFiles: async () => {
      const files = await pickFiles({ multiple: true });
      const out = [];
      for (const file of files) {
        try {
          out.push({
            name: String(file.name || 'de').replace(/\.txt$/i, ''),
            content: await readAsText(file),
          });
        } catch (err) {
          store().log('Không đọc được tệp', file.name, err.message);
        }
      }
      return out;
    },
    saveTxt: async (defaultName, content) => {
      const name = defaultName || 'tracnghiem.txt';
      downloadText(name, content);
      return name;
    },

    /* Tiện ích riêng của bản web -------------------------------------- */
    web: {
      version: VERSION,
      storageEstimate: async () => {
        try {
          if (navigator.storage && navigator.storage.estimate) {
            const { usage, quota } = await navigator.storage.estimate();
            return { usage: usage || 0, quota: quota || 0 };
          }
        } catch (err) { /* bỏ qua */ }
        return { usage: 0, quota: 0 };
      },
      wipe: () => store().wipe(),
      // Cho phép trang "Đặt lại" gọi lại đúng luồng nạp đề mẫu như lần đầu.
      reseed: async () => {
        await store().wipe();
        return store().seedSamples();
      },
    },
  };
})();
