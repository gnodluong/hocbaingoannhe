'use strict';
/**
 * Mục "Mindmap ôn nhanh": hiện đủ nội dung các câu barem theo nhánh (bấm để mở/đóng),
 * từ khoá tô màu (cam = con số), có nút "Che từ khoá" để tự kiểm tra.
 * Dữ liệu lấy từ chính các đề điền chỗ trống mẫu (samples/fill/) nên luôn khớp với đề.
 */

const MM_SUBJECTS = {
  'Bệnh Nội Ngoại': { title: 'Bệnh Nội – Ngoại', color: '#e0746c', tip: 'Cấp cứu: ra khỏi nguy hiểm → sơ cứu tại chỗ → chuyển tuyến sau. Triệu chứng: cơ năng → thực thể → toàn thân.' },
  'Vệ Sinh Phòng Dịch': { title: 'Vệ Sinh Phòng Dịch', color: '#4fb286', tip: 'Phòng dịch luôn 3 khâu: NGUỒN truyền nhiễm → TRUNG GIAN truyền nhiễm → KHỐI CẢM THỤ.' },
  'Điều Dưỡng': { title: 'Điều Dưỡng', color: '#6c9cf0', tip: 'Mọi kỹ thuật: 1) Chuẩn bị (người bệnh + dụng cụ) → 2) Kỹ thuật → thu dọn, ghi hồ sơ.' },
};

// Chuỗi có {{từ khoá}} -> các nút <mark> (dựng bằng DOM, không dùng innerHTML nên an toàn)
function mmMarkup(text) {
  const frag = document.createDocumentFragment();
  let last = 0;
  const re = /\{\{(.+?)\}\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    frag.appendChild(el('mark', { class: /\d/.test(m[1]) ? 'n' : '', text: m[1] }));
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}

async function mmLoad() {
  const out = [];
  try {
    const list = await (await fetch('samples/fill/manifest.json', { cache: 'no-cache' })).json();
    for (const entry of list) {
      const res = await fetch(`samples/fill/${encodeURIComponent(entry.file)}`);
      if (!res.ok) continue;
      const items = (await res.text()).replace(/\r/g, '').split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
      out.push({ subject: entry.subject, items });
    }
  } catch (err) { /* offline và chưa cache: trả danh sách rỗng */ }
  return out;
}

async function renderMindmap(root) {
  root.appendChild(pageTitle({
    eyebrow: '🧠 Ôn nhanh', title: 'Mindmap', hl: 'ôn cấp tốc',
    subtitle: 'Bấm tên câu để mở nhánh. Từ khoá xanh, con số màu cam. Bật "Che từ khoá" để tự kiểm tra: chạm vào ô tối để hiện đáp án.',
  }));

  const wrap = el('div', { class: 'mm' });
  const tools = el('div', { class: 'row gap8 wrap', style: { margin: '4px 0 12px' } });
  tools.append(
    btn('Mở hết', () => wrap.querySelectorAll('details').forEach((d) => { d.open = true; }), { kind: 'ghost', small: true }),
    btn('Đóng hết', () => wrap.querySelectorAll('details.mm-q').forEach((d) => { d.open = false; }), { kind: 'ghost', small: true }),
    btn('Che từ khoá', () => wrap.classList.toggle('mm-hide'), { kind: 'primary', small: true }),
  );
  root.appendChild(tools);
  root.appendChild(wrap);

  wrap.addEventListener('click', (e) => {
    if (e.target.tagName === 'MARK' && wrap.classList.contains('mm-hide')) e.target.classList.toggle('mm-show');
  });

  const data = await mmLoad();
  if (!data.length) {
    wrap.appendChild(emptyState('folder', 'Chưa tải được nội dung', 'Cần mở app khi có mạng ít nhất một lần để lưu mindmap dùng offline.'));
    return;
  }
  let n = 0;
  data.forEach(({ subject, items }) => {
    const info = MM_SUBJECTS[subject] || { title: subject, color: '#8aa0c8', tip: '' };
    const sec = el('details', { class: 'mm-s', attrs: { open: '' }, style: { '--c': info.color } });
    sec.appendChild(el('summary', { text: `${info.title} (${items.length} câu)` }));
    if (info.tip) sec.appendChild(el('div', { class: 'mm-tip', text: info.tip }));
    items.forEach((item) => {
      n += 1;
      const parts = item.split('\\n');
      const q = el('details', { class: 'mm-q', style: { '--c': info.color } });
      q.appendChild(el('summary', { text: `${n}. ${parts[0].replace(/\{\{|\}\}/g, '')}` }));
      const body = el('div', { class: 'mm-body' });
      parts.slice(1).forEach((line) => {
        if (line.startsWith('▸ ')) { body.appendChild(el('div', { class: 'mm-h', text: line.slice(2) })); return; }
        let cls = 'mm-l';
        if (line.startsWith('+ ')) { cls += ' sub'; line = line.slice(2); }
        else if (line.startsWith('– ')) line = line.slice(2);
        else if (line.startsWith('(')) cls += ' note';
        const row = el('div', { class: cls });
        row.appendChild(mmMarkup(line));
        body.appendChild(row);
      });
      q.appendChild(body);
      sec.appendChild(q);
    });
    wrap.appendChild(sec);
  });
  root.appendChild(el('div', { style: { height: '20px' } }));
}
