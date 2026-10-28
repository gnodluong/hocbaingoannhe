'use strict';
/** Giang vien chon mon -> xem bang diem/so lan lam bai/tien bo cua tung hoc vien. */

async function renderGradeHub(root, App) {
  if (!App.org || !App.org.className) { App.navigate('orgpick'); return; }
  const { battalion, company, className } = App.org;

  root.appendChild(pageTitle({
    eyebrow: '📊 Giảng viên', title: 'Quản lý', hl: 'điểm theo môn',
    subtitle: `Đang xem: ${battalion} · ${company} · ${className}. Chọn một môn hoặc bộ đề để xem điểm.`,
  }));

  const banks = await App.api.allBanks();
  const fillBanks = await App.api.allFillBanks();

  root.appendChild(sectionHead('Trắc nghiệm'));
  if (!banks.length) {
    root.appendChild(emptyState('book', 'Chưa có môn trắc nghiệm nào', ''));
  } else {
    const grid = el('div', { class: 'card-grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } });
    banks.forEach((b) => grid.appendChild(gradeSubjectCard(App, b.name, b.color, `${b.questions.length} câu`,
      () => App.navigate('gradeboard', { kind: 'mcq', bankId: b.id }))));
    root.appendChild(grid);
  }

  root.appendChild(sectionHead('Điền vào chỗ trống'));
  if (!fillBanks.length) {
    root.appendChild(emptyState('pencil', 'Chưa có bộ đề điền chỗ trống nào', ''));
  } else {
    const grid = el('div', { class: 'card-grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } });
    fillBanks.forEach((b) => grid.appendChild(gradeSubjectCard(App, b.name, b.color, `${b.subject} · ${b.questions.length} câu`,
      () => App.navigate('gradeboard', { kind: 'fill', bankId: b.id }))));
    root.appendChild(grid);
  }
  root.appendChild(el('div', { style: { height: '20px' } }));
}

function gradeSubjectCard(App, name, color, caption, onClick) {
  const card = panel([], { classes: 'subject-card', accent: color, onClick });
  card.appendChild(el('div', { style: { fontSize: '13px', fontWeight: 800 }, text: name }));
  card.appendChild(el('div', { class: 'muted-line mt8', text: caption }));
  const goBtn = btn('Xem điểm', (e) => { e.stopPropagation(); onClick(); }, { kind: 'primary', small: true, iconName: 'chart' });
  goBtn.style.marginTop = '14px';
  card.appendChild(goBtn);
  return card;
}

async function renderGradeBoard(root, App, { kind, bankId }) {
  if (!App.org || !App.org.className) { App.navigate('orgpick'); return; }
  const state = { onlyClass: true };
  const bank = kind === 'mcq' ? await App.api.getBank(bankId) : await App.api.getFillBank(bankId);
  if (!bank) { App.navigate('gradehub'); return; }

  await build();

  async function build() {
    root.innerHTML = '';
    root.appendChild(el('div', { class: 'mt8' }, [btn('Chọn môn khác', () => App.navigate('gradehub'), { kind: 'ghost', small: true, iconName: 'arrowLeft' })]));
    root.appendChild(pageTitle({
      eyebrow: `📘 ${bank.name}`, title: 'Bảng điểm', hl: kind === 'mcq' ? 'trắc nghiệm' : 'điền chỗ trống',
    }));

    const { battalion, company, className } = App.org;
    const toggleRow = el('div', { class: 'row gap8 mt8', style: { marginBottom: '14px' } });
    toggleRow.append(
      chipEl(`Lớp hiện tại: ${className}`, { tone: state.onlyClass ? 'active' : '', onClick: () => { state.onlyClass = true; build(); } }),
      chipEl('Tất cả các lớp', { tone: !state.onlyClass ? 'active' : '', onClick: () => { state.onlyClass = false; build(); } }),
    );
    toggleRow.querySelectorAll('.chip').forEach((c) => c.classList.add('clickable'));
    root.appendChild(toggleRow);

    const allHistory = await App.api.history();
    const relevant = allHistory.filter((h) => h.bankId === bankId && (kind === 'mcq' ? h.mode !== 'fill' : h.mode === 'fill'));

    const roster = state.onlyClass ? await App.api.studentsIn(battalion, company, className) : await App.api.allStudents();
    const rosterKey = (s) => `${s.battalion}|${s.company}|${s.className}|${s.name}`.toLowerCase();
    const rows = new Map();
    roster.forEach((s) => rows.set(rosterKey(s), {
      name: s.name, battalion: s.battalion, company: s.company, className: s.className, attempts: [],
    }));

    relevant.forEach((h) => {
      if (!h.studentName) return;
      const key = `${h.battalion || ''}|${h.company || ''}|${h.className || ''}|${h.studentName}`.toLowerCase();
      if (!rows.has(key)) {
        if (state.onlyClass && !(h.battalion === battalion && h.company === company && h.className === className)) return;
        rows.set(key, { name: h.studentName, battalion: h.battalion, company: h.company, className: h.className, attempts: [] });
      }
      rows.get(key).attempts.push(h);
    });

    const list = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    if (!list.length) {
      root.appendChild(emptyState('folder', 'Chưa có học viên hoặc lượt làm bài nào', 'Thêm học viên vào danh sách hoặc đợi có người làm đề này.'));
      return;
    }

    const table = el('table', { class: 'history-table' });
    table.appendChild(el('tr', {}, ['HỌ VÀ TÊN', 'LỚP', 'SỐ LẦN LÀM', 'ĐIỂM GẦN NHẤT', 'ĐIỂM CAO NHẤT', 'XU HƯỚNG', ''].map((h) => el('th', { text: h }))));

    list.forEach((row) => {
      const sorted = row.attempts.slice().sort((a, b) => a.at - b.at);
      const pct = (h) => Math.round((h.correct / h.total) * 100);
      const latest = sorted.length ? pct(sorted[sorted.length - 1]) : null;
      const best = sorted.length ? Math.max(...sorted.map(pct)) : null;
      let trend = '—'; let trendColor = 'var(--muted)';
      if (sorted.length >= 2) {
        const diff = pct(sorted[sorted.length - 1]) - pct(sorted[0]);
        if (diff > 0) { trend = `↑ +${diff}%`; trendColor = 'var(--ok-text)'; }
        else if (diff < 0) { trend = `↓ ${diff}%`; trendColor = 'var(--bad-text)'; }
        else { trend = '→ 0%'; trendColor = 'var(--dim)'; }
      }
      const tr = el('tr', {}, [
        el('td', { text: row.name, style: { fontWeight: 800 } }),
        el('td', { text: row.className || '—' }),
        el('td', { text: String(sorted.length) }),
        el('td', { text: latest === null ? '—' : `${latest}%` }),
        el('td', { text: best === null ? '—' : `${best}%` }),
        el('td', { text: trend, style: { color: trendColor, fontWeight: 800 } }),
      ]);
      const actionTd = el('td', {});
      if (sorted.length) actionTd.appendChild(btn('', () => showAttemptsDialog(row, sorted), { kind: 'ghost', small: true, iconName: 'search' }));
      tr.appendChild(actionTd);
      table.appendChild(tr);
    });
    root.appendChild(el('div', { class: 'panel', style: { padding: '4px 8px' } }, [table]));
    root.appendChild(el('div', { style: { height: '20px' } }));
  }

  function showAttemptsDialog(row, sorted) {
    const list = el('div', { class: 'panel-grid' });
    sorted.slice().reverse().forEach((h) => {
      const pct = Math.round((h.correct / h.total) * 100);
      list.appendChild(el('div', { class: 'row gap10', style: { padding: '8px 0', borderTop: '1px solid var(--border)' } }, [
        el('span', { class: 'muted-line', text: fmtDate(h.at) }),
        el('span', { style: { fontWeight: 800 }, text: `${h.correct}/${h.total} (${pct}%)` }),
        el('span', { class: 'muted-line', text: fmtTime(h.seconds) }),
      ]));
    });
    openModal({
      title: `Lịch sử làm bài — ${row.name}`, subtitle: `${row.battalion || ''} · ${row.company || ''} · ${row.className || ''}`,
      body: list, width: 520,
      footer: (footer, close) => footer.appendChild(btn('Đóng', close, { kind: 'ghost' })),
    });
  }
}
