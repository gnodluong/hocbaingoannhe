'use strict';
/** Xuat / nhap TOAN BO du lieu (de + danh sach hoc vien + lich su) ra 1 file .txt
 *  de dong bo giua cac may — hoan toan offline, khong can mang. */

async function renderSyncScreen(root, App) {
  root.appendChild(pageTitle({
    eyebrow: '🔄 Đồng bộ', title: 'Xuất / nhập', hl: 'toàn bộ dữ liệu',
    subtitle: 'Gom tất cả đề trắc nghiệm, đề điền chỗ trống và lịch sử làm bài vào MỘT file .txt duy nhất — chép file này sang máy khác rồi nhập lại là đồng bộ xong, không cần mạng.',
  }));

  const stats = await gatherStats(App);
  const statGrid = el('div', { class: 'stat-grid', style: { gridTemplateColumns: 'repeat(3, 1fr)' } });
  [
    [String(stats.banks), 'Môn trắc nghiệm', 'var(--accent)'],
    [String(stats.fillBanks), 'Bộ đề điền chỗ trống', 'var(--accent-2)'],
    [String(stats.history), 'Lượt làm bài', 'var(--accent)'],
  ].forEach(([v, l, c]) => statGrid.appendChild(statCard(v, l, c)));
  root.appendChild(statGrid);

  const exportPanel = panel([]);
  exportPanel.classList.add('mt18');
  exportPanel.appendChild(el('div', { style: { fontSize: '13px', fontWeight: 800 }, text: '1 · Xuất dữ liệu từ máy này' }));
  exportPanel.appendChild(el('div', { class: 'muted-line mt8', text: 'Lưu thành 1 file .txt, mang file này (USB, Zalo, email...) sang máy kia.' }));
  const exportBtn = btn('Xuất toàn bộ dữ liệu ra file .txt', async () => {
    const content = await App.api.exportAll();
    const stamp = new Date().toISOString().slice(0, 10);
    const path = await App.api.saveTxt(`TracNghiem_DuLieu_${stamp}.txt`, content);
    if (path) toast(`Đã xuất file: ${path.split(/[\\/]/).pop()}`, 'ok');
  }, { kind: 'primary', iconName: 'download' });
  exportBtn.style.marginTop = '14px';
  exportPanel.appendChild(exportBtn);
  root.appendChild(exportPanel);

  const importPanel = panel([]);
  importPanel.classList.add('mt14');
  importPanel.appendChild(el('div', { style: { fontSize: '13px', fontWeight: 800 }, text: '2 · Nhập dữ liệu vào máy này' }));
  importPanel.appendChild(el('div', { class: 'muted-line mt8',
    text: 'Chọn file .txt đã xuất từ máy kia. Dữ liệu được GỘP vào (đề trùng id sẽ ghi đè, lịch sử không lặp lại) — không xoá mất dữ liệu sẵn có trên máy này.' }));
  const importBtn = btn('Chọn file .txt để nhập', async () => {
    const files = await App.api.openTxtFiles();
    if (!files.length) return;
    const result = await App.api.importAll(files[0].content);
    if (!result.ok) { toast(result.error, 'err'); return; }
    toast(`Đã nhập: +${result.banksAdded} môn trắc nghiệm, +${result.fillAdded} bộ điền chỗ trống, +${result.historyAdded} lượt làm bài`, 'ok');
    App.navigate('sync');
  }, { kind: 'accent', iconName: 'upload' });
  importBtn.style.marginTop = '14px';
  importPanel.appendChild(importBtn);
  root.appendChild(importPanel);

  root.appendChild(el('div', { style: { height: '20px' } }));
}

async function gatherStats(App) {
  const [banks, fillBanks, history] = await Promise.all([
    App.api.allBanks(), App.api.allFillBanks(), App.api.history(),
  ]);
  return { banks: banks.length, fillBanks: fillBanks.length, history: history.length };
}
