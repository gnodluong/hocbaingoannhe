'use strict';
/** Man hinh Huong dan su dung. */

function guideSection(iconName, color, title, steps) {
  const panelEl = panel([], { classes: 'mt14' });
  const head = el('div', { class: 'row gap10', style: { marginBottom: '12px' } });
  head.appendChild(el('div', {
    class: 'icon-box', html: icon(iconName, 18),
    style: { width: '36px', height: '36px', borderRadius: '11px', background: `color-mix(in srgb, ${color} 20%, var(--surface))`, border: `1px solid ${color}` },
  }));
  head.appendChild(el('div', { style: { fontSize: '13px', fontWeight: 800 }, text: title }));
  panelEl.appendChild(head);
  const list = el('div', { class: 'panel-grid' });
  steps.forEach((step, i) => {
    const row = el('div', { class: 'row gap10', style: { alignItems: 'flex-start', padding: '6px 0' } });
    row.appendChild(el('div', {
      text: String(i + 1),
      style: {
        width: '22px', height: '22px', borderRadius: '7px', flex: 'none', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: '10px', fontWeight: 800, color, background: `color-mix(in srgb, ${color} 16%, var(--surface))`,
        border: `1px solid ${color}`, marginTop: '1px',
      },
    }));
    row.appendChild(el('div', { style: { fontSize: '11px', color: 'var(--dim)', lineHeight: '1.7', fontWeight: 600 }, html: step }));
    list.appendChild(row);
  });
  panelEl.appendChild(list);
  return panelEl;
}

async function renderGuide(root) {
  root.appendChild(pageTitle({
    eyebrow: '📖 Trợ giúp', title: 'Hướng dẫn', hl: 'sử dụng',
    subtitle: 'Toàn bộ các bước để ôn luyện, soạn đề và quản lý dữ liệu trong app — không cần Internet, mọi thứ chạy ngay trên máy.',
  }));

  root.appendChild(guideSection('home', 'var(--accent)', 'Bắt đầu từ đâu', [
    'Bản web dành cho <b>thí sinh tự do</b>: không có Tiểu đoàn, Đại đội hay Lớp — bạn vào thẳng Trang chủ và chọn hình thức ôn luyện.',
    'Khi bấm bắt đầu làm bài, app hỏi <b>tên của bạn</b> một lần. Tên đó được dùng để lưu kết quả vào lịch sử và được <b>nhớ lại cho lần sau</b>, nên những lần sau chỉ cần bấm Enter.',
    'Đổi tên bất cứ lúc nào: bấm chip "Thí sinh: …" ở Trang chủ (hoặc nút Tên của bạn). Mỗi tên có một lịch sử riêng.',
    'Thanh điều hướng trên cùng luôn có mặt: Trang chủ, Trắc nghiệm, Điền chỗ trống, Bảng điểm, Ngân hàng đề, Lịch sử, Đồng bộ, Hướng dẫn.',
  ]));


  root.appendChild(guideSection('check', 'var(--accent)', 'Làm bài trắc nghiệm', [
    'Ở mục Trắc nghiệm, chọn một môn học → chọn <b>số câu</b> (50/70/90/toàn bộ) → chọn <b>chế độ</b>.',
    '<b>Bảng lớn giảng đường</b>: mỗi màn hình 1 câu chữ rất to, để trình chiếu cả lớp. Bấm A/B/C/D hoặc phím 1-4, Enter sang câu tiếp, chọn xong hiện đúng/sai ngay.',
    '<b>Cá nhân</b>: 10 câu mỗi trang, có đồng hồ bấm giờ, chấm điểm sau khi bấm Nộp bài.',
    'Bấm Bắt đầu, app hỏi <b>tên của bạn</b> rồi vào làm bài ngay — không cần chọn lớp hay danh sách.',
    'Đề được xáo ngẫu nhiên và không lặp câu trong cùng 1 lượt làm.',
  ]));

  root.appendChild(guideSection('pencil', 'var(--accent-2)', 'Làm bài điền vào chỗ trống', [
    'Chọn một bộ đề (có thể lọc theo môn) → chọn số câu → chọn cách trả lời: <b>Gõ đáp án</b> (bàn phím) hoặc <b>Kéo thả từ</b> (giữ chuột kéo từ đúng thả vào ô trống).',
    'Chấm không phân biệt chữ hoa/thường, chỉ cần đúng từ.',
    'Câu không tự đánh dấu từ sẽ được app <b>tự động bốc ngẫu nhiên 1-3 từ</b> trong câu làm chỗ trống — mỗi lượt làm lại có thể ra từ khác nhau.',
    'Cũng hỏi <b>tên của bạn</b> trước khi bắt đầu, giống bên trắc nghiệm.',
  ]));

  root.appendChild(guideSection('plus', 'var(--accent-3)', 'Soạn đề điền vào chỗ trống', [
    'Bấm <b>Tạo bộ đề mới</b> → đặt tên và môn học → vào thẳng màn soạn câu, thêm từng câu một.',
    'Gõ câu bình thường, <b>không cần đánh dấu gì</b>: app tự bốc từ ngẫu nhiên mỗi lượt làm.',
    'Muốn hỏi đúng một từ cụ thể thì bọc quanh nó bằng hai dấu ngoặc nhọn, ví dụ: <code>Huyết áp bình thường là {{120}}/{{80}} mmHg.</code> — một câu có thể có nhiều chỗ trống như vậy.',
    'Có thể sửa/xoá từng câu, đổi tên bộ đề/môn học, hoặc xuất lại ra file .txt để chia sẻ cho người khác bất cứ lúc nào.',
  ]));

  root.appendChild(guideSection('upload', 'var(--accent-2)', 'Tải đề lên bằng file .txt (điền chỗ trống)', [
    'Bấm <b>Tải file mẫu</b> để lưu 1 file .txt mẫu về máy, mở ra xem đúng định dạng.',
    'Mỗi <b>dòng</b> trong file là một câu. Câu không đánh dấu {{...}} sẽ được tự bốc từ ngẫu nhiên; câu có {{...}} sẽ luôn hỏi đúng từ đã đánh dấu.',
    'Soạn xong, bấm <b>Tải đề lên</b> → chọn file .txt từ máy (có thể chọn nhiều file cùng lúc), hoặc dán thẳng nội dung vào ô dán đề.',
  ]));

  root.appendChild(guideSection('book', 'var(--accent)', 'Ngân hàng đề trắc nghiệm', [
    'Vào mục <b>Ngân hàng đề</b> để xem tất cả môn học, nhập đề mới hoặc sửa câu hỏi.',
    'File .txt mẫu cho trắc nghiệm: 1 dòng câu hỏi, 4 dòng đáp án <code>A) ... B) ... C) ... D) ...</code>, rồi 1 dòng <code>ANSWER: X</code> ghi đáp án đúng.',
    'Mỗi câu có nút sửa (✏) và xoá (🗑) riêng; có thể thêm câu mới, đổi tên môn, xuất lại ra .txt hoặc khôi phục về đúng nội dung file .txt gốc nếu đã lỡ sửa nhầm.',
    'App đã nạp sẵn 7 môn từ các file .txt của đơn vị. Muốn thêm môn khác, soạn file .txt rồi bấm <b>Tải đề lên</b> — chọn được nhiều file cùng lúc.',
  ]));

  root.appendChild(guideSection('chart', 'var(--accent-2)', 'Bảng điểm theo thí sinh', [
    'Vào mục <b>Bảng điểm</b> → chọn một môn trắc nghiệm hoặc bộ đề điền chỗ trống muốn xem.',
    'Bảng gom theo <b>tên thí sinh đã gõ khi làm bài</b>: số lần làm, điểm gần nhất, điểm cao nhất và <b>xu hướng</b> (so lần đầu với lần gần nhất — tiến bộ ↑ hay giảm ↓). Không cần nhập danh sách trước.',
    'Bấm nút kính lúp ở mỗi dòng để xem chi tiết từng lượt làm bài của thí sinh đó.',
    'Bấm kính lúp ở mỗi dòng để xem chi tiết từng lượt làm của thí sinh đó.',
  ]));

  root.appendChild(guideSection('clock', 'var(--accent-2)', 'Lịch sử làm bài', [
    'Mục <b>Lịch sử</b> ghi lại từng lượt làm: thời gian, tên thí sinh, môn học, chế độ, số câu đúng, tỉ lệ %, thời gian làm bài.',
    'Có thể xoá toàn bộ lịch sử nếu muốn làm lại từ đầu (không ảnh hưởng tới đề đã có).',
  ]));

  root.appendChild(guideSection('folder', 'var(--accent-3)', 'Dữ liệu & mang đi máy khác', [
    'Bản web lưu <b>toàn bộ đề, lịch sử làm bài và tuỳ chọn ngay trong trình duyệt</b> của bạn — không có tài khoản, không gửi dữ liệu lên mạng, mở lại trang là còn nguyên.',
    'Muốn mang sang máy khác hoặc sao lưu: vào mục <b>Đồng bộ</b> xuất ra một file .txt duy nhất, rồi nhập file đó ở máy kia. Cũng có thể <b>Xuất đề</b> riêng từng môn.',
    'Cài app để mở nhanh như ứng dụng thật: bấm <b>Cài đặt app</b> ở góc phải trên cùng (Chrome / Edge), app sẽ có biểu tượng riêng và mở được khi không có mạng.',
    'Lưu ý: xoá dữ liệu trình duyệt (cookie & dữ liệu trang web) cũng làm mất dữ liệu app — hãy xuất file .txt để sao lưu định kỳ.',
  ]));

  root.appendChild(guideSection('upload', 'var(--accent-2)', 'Đồng bộ dữ liệu giữa nhiều máy', [
    'Mục <b>Đồng bộ</b> trên thanh điều hướng: bấm <b>Xuất toàn bộ dữ liệu ra file .txt</b> để gom tất cả đề và lịch sử vào 1 file duy nhất.',
    'Chép file đó sang máy khác (USB, Zalo, email...), vào mục Đồng bộ trên máy đó rồi bấm <b>Chọn file .txt để nhập</b>.',
    'Dữ liệu được <b>gộp vào</b> chứ không xoá dữ liệu sẵn có: đề trùng id sẽ cập nhật mới nhất, lịch sử không lặp lại các lượt đã có.',
    'Dùng cách này khi nhiều máy cùng ôn tập và muốn gộp kết quả về một nơi.',
  ]));

  root.appendChild(el('div', { style: { height: '24px' } }));
}
