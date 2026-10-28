'use strict';
/** Chon vai tro (hoc vien/giang vien), chon Tieu doan - Dai doi - Lop, quan ly danh sach hoc vien. */

// ================================================================ VAI TRO
async function renderRolePick(root, App) {
  root.appendChild(pageTitle({
    eyebrow: '🩺 NVQYc43 · Ôn luyện quân y', title: 'Bạn là', hl: 'học viên hay giảng viên?',
    subtitle: 'Chọn vai trò để vào đúng khu vực làm bài hoặc quản lý điểm.',
  }));

  const grid = el('div', { class: 'mode-hub-grid' });
  grid.appendChild(roleCard('check', 'var(--accent)', 'Học viên', 'Làm bài trắc nghiệm hoặc điền chỗ trống',
    'Chọn Tiểu đoàn — Đại đội — Lớp, chọn tên trong danh sách rồi bắt đầu làm bài. Điểm được ghi nhận lại đầy đủ.',
    async () => { App.role = 'student'; App.org = {}; await App.navigate('orgpick'); }));
  grid.appendChild(roleCard('chart', 'var(--accent-2)', 'Giảng viên', 'Quản lý điểm theo từng môn',
    'Chọn Tiểu đoàn — Đại đội — Lớp rồi chọn môn để xem điểm, số lần làm bài và tiến bộ của từng học viên.',
    async () => { App.role = 'teacher'; App.org = {}; await App.navigate('orgpick'); }));
  root.appendChild(grid);

  const foot = el('div', { class: 'row mt18', style: { justifyContent: 'center' } });
  foot.appendChild(btn('Quản lý danh sách học viên', () => App.navigate('roster'), { kind: 'ghost', small: true, iconName: 'notes' }));
  root.appendChild(foot);
}

function roleCard(iconName, color, title, subtitle, desc, onClick) {
  const card = panel([], { classes: 'mode-card', accent: color, onClick });
  card.appendChild(el('div', { class: 'icon-box', html: icon(iconName, 28), style: { background: `color-mix(in srgb, ${color} 20%, var(--surface))`, border: `1px solid ${color}` } }));
  card.appendChild(el('h3', { text: title }));
  card.appendChild(el('div', { class: 'subtitle', text: subtitle, style: { color } }));
  card.appendChild(el('div', { class: 'desc', text: desc }));
  card.appendChild(btn('Chọn', onClick, { kind: 'primary', iconName: 'arrowRight' }));
  return card;
}

// ============================================================= TO CHUC
async function renderOrgPicker(root, App) {
  if (!App.role) { App.navigate('role'); return; }
  App.org = App.org || {};
  await build();

  async function build() {
    root.innerHTML = '';
    const { battalion, company, className } = App.org;

    const crumbs = el('div', { class: 'row gap8 wrap mt8', style: { marginBottom: '6px' } });
    crumbs.appendChild(chipEl(App.role === 'student' ? 'Học viên' : 'Giảng viên', { tone: 'active' }));
    if (battalion) crumbs.appendChild(chipEl(battalion, { onClick: () => { App.org = {}; build(); } }));
    if (company) crumbs.appendChild(chipEl(company, { onClick: () => { App.org = { battalion }; build(); } }));
    if (className) crumbs.appendChild(chipEl(className, { onClick: () => { App.org = { battalion, company }; build(); } }));
    crumbs.querySelectorAll('.chip').forEach((c) => c.classList.add('clickable'));
    root.appendChild(crumbs);

    if (!battalion) {
      root.appendChild(pageTitle({ title: 'Chọn', hl: 'Tiểu đoàn', subtitle: 'Chọn tiểu đoàn để tiếp tục.' }));
      const list = await App.api.battalions();
      await renderLevelList(list, 'Chưa có Tiểu đoàn nào trong danh sách học viên', (value) => { App.org = { battalion: value }; build(); });
    } else if (!company) {
      root.appendChild(pageTitle({ title: 'Chọn', hl: 'Đại đội', subtitle: `Tiểu đoàn: ${battalion}` }));
      const list = await App.api.companies(battalion);
      await renderLevelList(list, 'Chưa có Đại đội nào trong Tiểu đoàn này', (value) => { App.org = { battalion, company: value }; build(); });
    } else if (!className) {
      root.appendChild(pageTitle({ title: 'Chọn', hl: 'Lớp', subtitle: `${battalion} · ${company}` }));
      const list = await App.api.classes(battalion, company);
      await renderLevelList(list, 'Chưa có Lớp nào trong Đại đội này', (value) => { App.org = { battalion, company, className: value }; build(); });
    } else {
      const students = await App.api.studentsIn(battalion, company, className);
      root.appendChild(pageTitle({ title: 'Đã chọn', hl: className, subtitle: `${battalion} · ${company} · ${className} — ${students.length} học viên` }));
      const goBtn = btn(App.role === 'student' ? 'Vào làm bài' : 'Vào quản lý điểm', async () => {
        await App.navigate(App.role === 'student' ? 'start' : 'gradehub');
      }, { kind: 'primary', block: true, iconName: 'arrowRight' });
      goBtn.style.height = '52px'; goBtn.style.fontSize = '13px';
      root.appendChild(goBtn);
    }

    const foot = el('div', { class: 'row gap8 mt18' });
    foot.appendChild(btn('Đổi vai trò', () => App.navigate('role'), { kind: 'ghost', small: true, iconName: 'arrowLeft' }));
    foot.appendChild(btn('Quản lý danh sách học viên', () => App.navigate('roster'), { kind: 'ghost', small: true, iconName: 'notes' }));
    root.appendChild(foot);
  }

  async function renderLevelList(values, emptyMsg, onPick) {
    if (!values.length) {
      root.appendChild(emptyState('folder', emptyMsg, 'Vào "Quản lý danh sách học viên" để thêm hoặc tải danh sách lên.',
        btn('Quản lý danh sách học viên', () => App.navigate('roster'), { kind: 'primary', iconName: 'notes' })));
      return;
    }
    const grid = el('div', { class: 'card-grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } });
    values.forEach((value) => {
      const card = panel([el('div', { style: { fontSize: '13px', fontWeight: 800 }, text: value })], { classes: 'subject-card', onClick: () => onPick(value) });
      grid.appendChild(card);
    });
    root.appendChild(grid);
  }
}

// ===================================================== QUAN LY DANH SACH
const ROSTER_ROWS_PER_PAGE = 24;

async function renderRosterManage(root, App) {
  const state = { keyword: '', page: 0 };
  await build();

  async function build() {
    root.innerHTML = '';
    const students = await App.api.allStudents();

    root.appendChild(pageTitle({
      eyebrow: '👥 Tổ chức', title: 'Danh sách', hl: 'học viên',
      subtitle: 'Quản lý học viên theo Tiểu đoàn — Đại đội — Lớp. Dùng để chọn tên khi làm bài và quản lý điểm.',
    }));

    const tools = el('div', { class: 'row gap8 wrap', style: { marginBottom: '14px' } });
    const searchInput = el('input', { class: 'text-input', style: { width: '240px' }, attrs: { placeholder: 'Tìm tên/lớp... rồi bấm Enter' } });
    searchInput.value = state.keyword;
    searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { state.keyword = searchInput.value; state.page = 0; build(); } });
    tools.append(searchInput, btn('', () => { state.keyword = searchInput.value; state.page = 0; build(); }, { kind: 'ghost', iconName: 'search' }));
    tools.appendChild(btn('Thêm học viên', () => editStudentDialog(App, null, build), { kind: 'primary', small: true, iconName: 'plus' }));
    tools.appendChild(btn('Tải danh sách lên', () => importRosterDialog(App, build), { kind: 'ghost', small: true, iconName: 'upload' }));
    tools.appendChild(btn('Tải file mẫu', downloadRosterTemplate, { kind: 'ghost', small: true, iconName: 'download' }));
    if (students.length) tools.appendChild(btn('Xuất danh sách', () => exportRoster(App, students), { kind: 'ghost', small: true, iconName: 'download' }));
    root.appendChild(tools);

    if (!students.length) {
      root.appendChild(emptyState('folder', 'Chưa có học viên nào', 'Bấm "Thêm học viên" để nhập tay, hoặc "Tải danh sách lên" từ file .txt.'));
      return;
    }

    const keyword = state.keyword.toLowerCase().trim();
    const items = students
      .map((s, i) => [i, s])
      .filter(([, s]) => !keyword || [s.battalion, s.company, s.className, s.name].some((v) => v.toLowerCase().includes(keyword)));

    const pages = Math.max(1, Math.ceil(items.length / ROSTER_ROWS_PER_PAGE));
    state.page = Math.min(state.page, pages - 1);
    const windowItems = items.slice(state.page * ROSTER_ROWS_PER_PAGE, (state.page + 1) * ROSTER_ROWS_PER_PAGE);

    if (!items.length) {
      root.appendChild(emptyState('search', 'Không tìm thấy học viên phù hợp', 'Thử từ khoá khác.'));
      return;
    }

    const table = el('table', { class: 'history-table' });
    table.appendChild(el('tr', {}, ['TIỂU ĐOÀN', 'ĐẠI ĐỘI', 'LỚP', 'HỌ VÀ TÊN', ''].map((h) => el('th', { text: h }))));
    windowItems.forEach(([, s]) => {
      const tr = el('tr', {}, [
        el('td', { text: s.battalion }), el('td', { text: s.company }), el('td', { text: s.className }),
        el('td', { text: s.name, style: { fontWeight: 800 } }),
      ]);
      const actionsTd = el('td', {}, [
        el('div', { class: 'row gap6' }, [
          btn('', () => editStudentDialog(App, s, build), { kind: 'ghost', small: true, iconName: 'pencil' }),
          btn('', async () => {
            if (await confirmDialog(`Xoá học viên "${s.name}"?`, `${s.battalion} · ${s.company} · ${s.className}`, { confirmLabel: 'Xoá', danger: true })) {
              await App.api.removeStudent(s.id);
              toast('Đã xoá học viên', 'ok');
              build();
            }
          }, { kind: 'ghost', small: true, iconName: 'trash' }),
        ]),
      ]);
      tr.appendChild(actionsTd);
      table.appendChild(tr);
    });
    root.appendChild(el('div', { class: 'panel', style: { padding: '4px 8px' } }, [table]));

    const pager = el('div', { class: 'pager-row' });
    const prevP = btn('Trước', () => { state.page -= 1; build(); }, { kind: 'ghost', small: true, iconName: 'arrowLeft' });
    prevP.disabled = state.page === 0;
    pager.appendChild(prevP);
    pager.appendChild(el('span', { class: 'muted-line', text: `Trang ${state.page + 1} / ${pages} · ${items.length} học viên` }));
    const nextP = btn('Sau', () => { state.page += 1; build(); }, { kind: 'ghost', small: true, iconName: 'arrowRight' });
    nextP.disabled = state.page >= pages - 1;
    pager.appendChild(nextP);
    root.appendChild(pager);
    root.appendChild(el('div', { style: { height: '20px' } }));
  }
}

function editStudentDialog(App, student, refresh) {
  const isNew = !student;
  const battalionInput = el('input', { class: 'text-input' });
  const companyInput = el('input', { class: 'text-input' });
  const classInput = el('input', { class: 'text-input' });
  const nameInput = el('input', { class: 'text-input' });
  if (!isNew) {
    battalionInput.value = student.battalion; companyInput.value = student.company;
    classInput.value = student.className; nameInput.value = student.name;
  }
  const body = el('div', {}, [
    el('label', { class: 'field-label', text: 'Tiểu đoàn' }), battalionInput,
    el('label', { class: 'field-label mt10', text: 'Đại đội' }), companyInput,
    el('label', { class: 'field-label mt10', text: 'Lớp' }), classInput,
    el('label', { class: 'field-label mt10', text: 'Họ và tên' }), nameInput,
  ]);
  const modal = openModal({
    title: isNew ? 'Thêm học viên' : 'Sửa thông tin học viên', body,
    footer: (footer, close) => {
      footer.appendChild(btn('Huỷ', close, { kind: 'ghost' }));
      footer.appendChild(btn('Lưu', save, { kind: 'primary', iconName: 'check' }));
    },
  });
  setTimeout(() => battalionInput.focus(), 30);

  async function save() {
    const battalion = battalionInput.value.trim();
    const company = companyInput.value.trim();
    const className = classInput.value.trim();
    const name = nameInput.value.trim();
    if (!battalion || !company || !className || !name) { toast('Điền đủ cả 4 mục', 'err'); return; }
    await App.api.upsertStudent({ id: student ? student.id : undefined, battalion, company, className, name });
    modal.close();
    toast(isNew ? 'Đã thêm học viên' : 'Đã lưu thay đổi', 'ok');
    refresh();
  }
}

function importRosterDialog(App, refresh) {
  const textArea = el('textarea', { class: 'text-area', attrs: { rows: 8 } });
  const body = el('div', {}, [
    el('div', { class: 'row gap8' }, [btn('Chọn file .txt từ máy', pickFile, { kind: 'primary', block: true })]),
    el('div', { class: 'field-label mt16', text: 'HOẶC DÁN NỘI DUNG DANH SÁCH' }),
    el('label', { class: 'field-label mt10', text: 'Định dạng: Tiểu đoàn | Đại đội | Lớp | Họ tên (mỗi dòng 1 học viên)' }),
    textArea,
  ]);
  const modal = openModal({
    title: 'Tải danh sách học viên lên', body, width: 620,
    footer: (footer, close) => {
      footer.appendChild(btn('Đóng', close, { kind: 'ghost' }));
      footer.appendChild(btn('Nhập danh sách', savePasted, { kind: 'primary', iconName: 'check' }));
    },
  });

  async function savePasted() {
    const { students, issues } = await App.api.parseRoster(textArea.value);
    if (!students.length) { toast('Không đọc được học viên nào — đúng định dạng chưa?', 'err'); return; }
    const added = await App.api.importStudents(students);
    modal.close();
    toast(`Đã thêm ${added} học viên mới${students.length - added ? ` (bỏ qua ${students.length - added} trùng)` : ''}`, 'ok');
    if (issues.length) App.api.log('Bỏ qua dòng lỗi khi nhập danh sách:', issues.join(' | '));
    refresh();
  }
  async function pickFile() {
    const files = await App.api.openTxtFiles();
    if (!files.length) return;
    let totalAdded = 0;
    for (const file of files) {
      const { students, issues } = await App.api.parseRoster(file.content);
      totalAdded += await App.api.importStudents(students);
      if (issues.length) App.api.log(`${file.name}: bỏ qua dòng lỗi:`, issues.join(' | '));
    }
    modal.close();
    toast(`Đã thêm ${totalAdded} học viên mới`, 'ok');
    refresh();
  }
}

async function downloadRosterTemplate() {
  const content = await window.api.rosterTemplate();
  const path = await window.api.saveTxt('Mau_Danh_Sach_Hoc_Vien.txt', content);
  if (path) toast('Đã lưu file mẫu', 'ok');
}

async function exportRoster(App, students) {
  const content = await App.api.exportRosterTxt(students);
  const path = await App.api.saveTxt('Danh_Sach_Hoc_Vien.txt', content);
  if (path) toast(`Đã xuất ${path.split(/[\\/]/).pop()}`, 'ok');
}
