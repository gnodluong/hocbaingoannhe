'use strict';
/**
 * candidate.js — Bản web dùng cho THÍ SINH TỰ DO.
 *
 * Không có Tiểu đoàn / Đại đội / Lớp, không có danh sách học viên: mỗi người tự
 * gõ tên của mình trước khi làm bài, tên đó được ghi vào lịch sử và nhớ lại cho
 * lần sau. Tên chỉ nằm trong trình duyệt trên máy đang dùng.
 */

/** Hỏi tên thí sinh. Trả về { id, name } hoặc null nếu người dùng huỷ. */
async function promptCandidateName(App) {
  const prefs = await App.api.prefs();
  const last = (App.candidateName || prefs.studentName || '').trim();

  return new Promise((resolve) => {
    let settled = false;
    let closeFn = () => {};
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const input = el('input', {
      class: 'text-input candidate-name',
      attrs: {
        id: 'candidate-name',
        type: 'text',
        placeholder: 'Ví dụ: Nguyễn Văn An',
        autocomplete: 'name',
        maxlength: '60',
        value: last,
        'aria-label': 'Tên của bạn',
      },
    });
    const error = el('div', { class: 'candidate-error', attrs: { id: 'candidate-error', role: 'alert' } });
    error.hidden = true;

    const body = el('div', {}, [
      el('div', { class: 'muted-line', text: 'Gõ tên của bạn để kết quả được lưu vào lịch sử. Tên này chỉ nằm trên máy bạn, không gửi đi đâu.' }),
      el('div', { class: 'mt12' }, [input]),
      error,
      el('div', { class: 'muted-line mt12', style: { fontSize: '11px' }, text: last ? `Lần trước bạn làm bài với tên: ${last}` : 'Lần sau app sẽ nhớ tên này.' }),
    ]);

    const submit = () => {
      const name = input.value.trim().replace(/\s+/g, ' ');
      if (name.length < 2) {
        error.textContent = 'Hãy gõ ít nhất 2 ký tự.';
        error.hidden = false;
        input.focus();
        return;
      }
      App.candidateName = name;
      // Ghi nhớ để lần sau chỉ cần bấm Enter.
      try { App.api.setPrefs({ studentName: name }); } catch (err) { /* không chặn làm bài */ }
      // Trả kết quả TRƯỚC khi đóng hộp thoại: onClose (chạy khi đóng) sẽ trả về
      // null nếu nó tới trước, làm người gọi tưởng người dùng đã huỷ.
      finish({ id: 'free', name });
      closeFn();
    };

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    });
    input.addEventListener('input', () => { error.hidden = true; });

    openModal({
      title: 'Tên của bạn',
      subtitle: 'Thí sinh tự do — không cần chọn đơn vị hay lớp.',
      body,
      width: 460,
      footer: (footer, close) => {
        closeFn = close;
        footer.appendChild(btn('Huỷ', () => close(), { kind: 'ghost' }));
        footer.appendChild(btn('Vào làm bài', submit, { kind: 'primary', iconName: 'check' }));
      },
      onClose: () => finish(null),
    });

    setTimeout(() => {
      input.focus();
      try { input.setSelectionRange(last.length, last.length); } catch (err) { /* bỏ qua */ }
    }, 60);
  });
}

/** Tên đang dùng để hiển thị ở trang chủ / lịch sử. */
function candidateLabel(App) {
  return (App.candidateName || '').trim() || 'Chưa nhập tên';
}
