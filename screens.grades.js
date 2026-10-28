'use strict';
/**
 * screens.grades.js (bản web) — BẢNG ĐIỂM THEO THÍ SINH.
 *
 * Bản desktop lấy danh sách học viên theo Tiểu đoàn/Đại đội/Lớp. Bản web dùng
 * cho thí sinh tự do nên bảng điểm được gom theo TÊN đã gõ khi làm bài: ai đã
 * làm đề này thì có một dòng, kèm số lần làm, điểm gần nhất, điểm cao nhất và
 * xu hướng tiến bộ.
 */

async function renderGradeHub(root, App) {
  const history = await App.api.history();
  const names = new Set(history.map((h) => (h.studentName || '').trim()).filter(Boolean));

  root.appendChild(pageTitle({
    eyebrow: '📊 Bảng điểm', title: 'Điểm theo', hl: 'từng thí sinh',
    subtitle: names.size
      ? `Đã có ${names.size} thí sinh làm bài. Chọn một môn hoặc bộ đề để xem bảng điểm chi tiết.`
      : 'Chưa có ai làm bài. Bảng điểm sẽ tự tổng hợp theo tên mà thí sinh gõ khi làm bài.',
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
  const bank = kind === 'mcq' ? await App.api.getBank(bankId) : await App.api.getFillBank(bankId);
  if (!bank) { App.navigate('gradehub'); return; }

  const allHistory = await App.api.history();
  const relevant = allHistory.filter((h) => h.bankId === bankId && (kind === 'mcq' ? h.mode !== 'fill' : h.mode === 'fill'));

  root.appendChild(el('div', { class: 'mt8' }, [btn('Chọn môn khác', () => App.navigate('gradehub'), { kind: 'ghost', small: true, iconName: 'arrowLeft' })]));
  root.appendChild(pageTitle({
    eyebrow: `📘 ${bank.name}`, title: 'Bảng điểm', hl: kind === 'mcq' ? 'trắc nghiệm' : 'điền chỗ trống',
    subtitle: `${relevant.length} lượt làm bài của ${new Set(relevant.map((h) => h.studentName)).size} thí sinh.`,
  }));

  const rows = new Map();
  relevant.forEach((h) => {
    const name = (h.studentName || '').trim();
    if (!name) return;
    if (!rows.has(name)) rows.set(name, { name, attempts: [] });
    rows.get(name).attempts.push(h);
  });

  const list = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  if (!list.length) {
    root.appendChild(emptyState('chart', 'Chưa có ai làm đề này', 'Khi có thí sinh làm bài, bảng điểm sẽ tự hiện ở đây — không cần nhập danh sách trước.'));
    return;
  }

  const table = el('table', { class: 'history-table' });
  table.appendChild(el('tr', {}, ['THÍ SINH', 'SỐ LẦN LÀM', 'ĐIỂM GẦN NHẤT', 'ĐIỂM CAO NHẤT', 'XU HƯỚNG', ''].map((h) => el('th', { text: h }))));

  list.forEach((row) => {
    const sorted = row.attempts.slice().sort((a, b) => a.at - b.at);
    const pct = (h) => Math.round((h.correct / h.total) * 100);
    const latest = sorted.length ? pct(sorted[sorted.length - 1]) : null;
    const best = sorted.length ? Math.max(...sorted.map(pct)) : null;
    let trend = '—';
    let trendColor = 'var(--muted)';
    if (sorted.length >= 2) {
      const diff = pct(sorted[sorted.length - 1]) - pct(sorted[0]);
      if (diff > 0) { trend = `↑ +${diff}%`; trendColor = 'var(--ok-text)'; }
      else if (diff < 0) { trend = `↓ ${diff}%`; trendColor = 'var(--bad-text)'; }
      else { trend = '→ 0%'; trendColor = 'var(--dim)'; }
    }
    const tr = el('tr', {}, [
      el('td', { text: row.name, style: { fontWeight: 800 } }),
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

  function showAttemptsDialog(row, sorted) {
    const listEl = el('div', { class: 'panel-grid' });
    sorted.slice().reverse().forEach((h) => {
      const percent = Math.round((h.correct / h.total) * 100);
      listEl.appendChild(el('div', { class: 'row gap10', style: { padding: '8px 0', borderTop: '1px solid var(--border)' } }, [
        el('span', { class: 'muted-line', text: fmtDate(h.at) }),
        el('span', { style: { fontWeight: 800 }, text: `${h.correct}/${h.total} (${percent}%)` }),
        el('span', { class: 'muted-line', text: fmtTime(h.seconds) }),
      ]));
    });
    openModal({
      title: `Lịch sử làm bài — ${row.name}`,
      subtitle: `${sorted.length} lượt · ${bank.name}`,
      body: listEl, width: 520,
      footer: (footer, close) => footer.appendChild(btn('Đóng', close, { kind: 'ghost' })),
    });
  }
}
