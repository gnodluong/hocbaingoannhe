# Trắc Nghiệm Thử · Đại Đội 5 — bản WEB

Ứng dụng ôn luyện **trắc nghiệm** và **điền vào chỗ trống** dành cho **thí sinh tự
do**, chuyển từ bản desktop Electron 1.1.3 của Đại Đội 5 sang **chạy trực tiếp trong
trình duyệt** — không cần cài đặt, không cần máy chủ, không cần Internet.

- **Thí sinh tự do:** mở trang → chọn môn → gõ tên của bạn → làm bài. Không có Tiểu đoàn, Đại đội, Lớp hay danh sách học viên; tên được nhớ cho lần sau và lịch sử lưu riêng theo từng tên.
- **Cài như ứng dụng:** bấm “Cài đặt app” trên thanh trên cùng (Chrome / Edge) để có
  biểu tượng riêng, mở toàn màn hình như app thật.
- **Chạy offline:** service worker lưu sẵn toàn bộ giao diện, font và 7 bộ đề mẫu —
  rút mạng vẫn mở và làm bài bình thường.
- **Dữ liệu riêng tư:** đề và lịch sử làm bài nằm trong IndexedDB **của trình duyệt
  trên máy bạn**. Không có tài khoản, không có máy chủ nào nhận dữ liệu.
- **7 bộ đề có sẵn:** Bệnh Nội Khoa, Bệnh Ngoại Khoa, Điều Dưỡng Cơ Bản, Thuốc Thông
  Thường, Tổ Chức Chiến Thuật Quân Y, Vệ Sinh Phòng Dịch, Y Học Cổ Truyền
  (~3.100 câu hỏi trắc nghiệm).

---

## 1. Có gì trong bản web này

| Tính năng | Ghi chú |
|---|---|
| Ôn trắc nghiệm | chế độ **bảng lớn giảng đường** (trình chiếu) và **cá nhân** (có đồng hồ, nộp bài mới chấm) |
| Điền vào chỗ trống | gõ đáp án hoặc kéo thả; câu không đánh dấu sẽ tự bốc từ ngẫu nhiên mỗi lượt |
| Ngân hàng đề | thêm / sửa / xoá câu hỏi, đổi tên môn, xuất `.txt`, khôi phục về bản gốc |
| Bảng điểm | gom theo tên thí sinh: số lần làm, điểm gần nhất, điểm cao nhất, xu hướng tiến bộ / giảm |
| Lịch sử | từng lượt làm bài, lọc theo tên thí sinh hoặc môn học |
| Đồng bộ | xuất **một file `.txt`** chứa toàn bộ dữ liệu, nhập lại ở máy khác (gộp, không ghi đè) |
| Giao diện | 7 bảng màu (sáng, tối, tím, xanh biển, xanh ngọc, hổ phách, hồng mận) |
| Dùng trên điện thoại | bố cục responsive, nút đủ lớn để bấm bằng ngón tay |

---

## 2. Chạy thử trên máy

Bản web là tệp tĩnh thuần, **không cần bước build**, không có `node_modules`:

```bash
node tools/serve.mjs          # http://127.0.0.1:8080
node tools/serve.mjs 5000     # đổi cổng
```

Mở trình duyệt tại địa chỉ in ra. (Mở thẳng `index.html` bằng `file://` vẫn xem được
nhưng **service worker và IndexedDB bị chặn** ở một số trình duyệt — hãy chạy qua
`tools/serve.mjs` hoặc một máy chủ tĩnh bất kỳ.)

### Thí sinh tự do

Bản web không có khái niệm đơn vị/lớp: `candidate.js` hỏi tên đúng một lần khi
bắt đầu làm bài (nhớ lại qua `prefs.studentName`), còn lịch sử chỉ gồm
`studentName`, `bankId`, `bankName`, `mode`, `total`, `correct`, `seconds`, `at`.
`App.candidateName` là nguồn duy nhất cho "bạn đang làm với tên gì"; đổi tên ở
chip *Thí sinh* trên Trang chủ.

### Kiểm thử tự động

```bash
node tools/web-smoke.mjs
```

Mở app bằng một trình duyệt Chromium thật (Electron chạy ở chế độ **không** bật Node
cho trang, đúng như Chrome/Edge) và chạy **3 pha**:

1. **đầy đủ** — 57 phép kiểm tra: nạp đề mẫu, mọi màn hình, hộp nhập tên thí sinh,
   chặn màn đơn vị/lớp, làm bài trắc nghiệm và điền chỗ trống, lịch sử theo tên,
   bảng điểm theo thí sinh, CRUD ngân hàng đề, xuất/nhập dữ liệu, bố cục header.
2. **điện thoại 390×844** — 10 phép kiểm tra bố cục: không tràn ngang, menu xuống hàng
   riêng và cuộn được, nút đủ to, chữ không tràn thẻ.
3. **offline** — tắt hẳn máy chủ rồi mở lại đúng địa chỉ cũ: 8 phép kiểm tra chứng minh
   service worker đã lưu đủ vỏ app và đề mẫu.

Cần một bản Electron để làm trình duyệt kiểm thử; mặc định lấy từ `../electron-app`,
hoặc đặt biến `TN_ELECTRON` trỏ tới `electron.exe`. Ảnh chụp giao diện (nếu cần):
`TN_SHOTS=tools/shots node tools/web-smoke.mjs`.

---

## 3. Kiến trúc

Bản desktop có hai tiến trình (main + renderer) nói chuyện qua `preload.js`/IPC.
Bản web **giữ nguyên toàn bộ giao diện** và thay đúng lớp IPC đó bằng JavaScript
chạy trong trình duyệt:

```
index.html            vỏ trang: header, vùng màn hình, modal, toast
theme-init.js         đọc bảng màu đã lưu trước khi vẽ trang (không nháy màu)
styles.css            bảng màu & thành phần gốc (giữ nguyên từ bản desktop)
desktop-theme.css     bố cục chi tiết (giữ nguyên từ bản desktop)
web.css               phần riêng của web: bỏ thanh tiêu đề desktop, công cụ trên
                      header, responsive, viền rõ hơn ở giao diện sáng

quiz-core.js          đọc đề .txt, xuất đề, bốc từ ngẫu nhiên  (bọc IIFE)
store.js              lưu trữ IndexedDB — port 1:1 luật của storage.js
api.js                dựng window.api giống hệt preload.js của Electron
desktop-web.js        chrome của web (thay desktop.js): công cụ, dữ liệu, PWA
screens.*.js          các màn hình (giữ nguyên, đã bỏ màn chọn vai trò/đơn vị)
candidate.js          hộp nhập tên thí sinh tự do + nhớ tên cho lần sau
app.js                điều phối màn hình và phiên làm bài
samples/              7 bộ đề .txt + manifest.json
sw.js, manifest.webmanifest, icons/   PWA để cài app và chạy offline
```

### Vì sao không sửa các tệp `screens.*` / `app.js`

Bản web giữ nguyên mã giao diện của bản desktop. Mọi khác biệt nằm ở đúng một lớp
tương thích (`api.js` + `store.js`), nên:

- sửa một màn hình ở bản desktop thì bê sang bản web gần như không phải sửa gì;
- logic nghiệp vụ (đọc đề, chấm điểm, bốc từ) là **cùng một tệp** với bản desktop.

Ba điểm phải khác vì môi trường trình duyệt:

| Việc | Bản desktop | Bản web |
|---|---|---|
| Lưu dữ liệu | file JSON trong `data/` cạnh `.exe` | IndexedDB của trình duyệt, cùng tên khoá `banks`/`fillBanks`/`roster`/`history`/`prefs` |
| Chọn / lưu tệp | hộp thoại của Windows | `<input type="file">` và tải về bằng Blob |
| Đề mẫu | đọc các `.txt` trong thư mục app | `fetch()` các `.txt` trong `samples/` (đã cache để dùng offline) |

`quiz-core.js` phải bọc trong IIFE vì trình duyệt nạp bằng `<script>`: mọi khai báo
ở cấp cao nhất đều thành biến toàn cục và sẽ đụng tên với các tệp màn hình (ví dụ
`LETTERS` cũng có trong `screens.mcq.js`). Chỉ `window.QuizCore` được để lộ ra.

---

## 4. Dữ liệu & sao lưu

- Toàn bộ dữ liệu nằm trong **IndexedDB** của trình duyệt, cơ sở dữ liệu
  `tracnghiem-dd5`, khoá `kv` (đề, đề điền chỗ trống, lịch sử, tuỳ chọn).
  Không có khoá `roster` được dùng trên giao diện — bản web dành cho thí sinh tự do,
  nhưng vẫn đọc được `roster` trong file sao lưu cũ của bản desktop.
- Nút **“Dữ liệu”** (góc phải header) hiện dung lượng đang dùng và có: xuất/nhập dữ
  liệu, nạp lại đề mẫu, **xoá toàn bộ dữ liệu**.
- Sao lưu: mục **Đồng bộ** → “Xuất toàn bộ dữ liệu ra file `.txt`”. File này mang sang
  máy khác hoặc nhập lại sau khi lỡ xoá.
- Xoá dữ liệu trình duyệt (cookie / dữ liệu trang web) cũng làm mất dữ liệu app.

---

## 5. PWA / chạy offline

- `manifest.webmanifest` khai báo tên, màu, biểu tượng (có bản `maskable`) và
  `display: standalone` để cài như ứng dụng.
- `sw.js` tải sẵn vỏ app + 7 bộ đề khi cài, sau đó trả từ cache ngay và cập nhật ngầm.
  Đổi nội dung app thì **tăng `VERSION` trong `sw.js`** để người dùng nhận bản mới.
- Cài đặt/đổi tên miền: service worker chỉ chạy trên `https` hoặc `localhost`.

---

## 6. Triển khai

Toàn bộ thư mục này là nội dung trang tĩnh. Với GitHub Pages: Settings → Pages →
Deploy from a branch → `main` / `/ (root)`. Không cần build, không cần Jekyll.

---

## 7. Ghi công

Bản desktop 1.1.3 do **Đại Đội 5** thực hiện; bản web giữ nguyên giao diện, nội dung
và cách làm việc của bản gốc.
