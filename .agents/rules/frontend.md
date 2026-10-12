# ContextDict — Frontend Engineering Standards

Tài liệu này xác định các nguyên tắc kỹ thuật frontend dành cho Chrome Extension (Manifest V3) trong dự án **ContextDict**.

---

## 1. Phân Tách Phạm Vi Môi Trường (Context Scopes)

### 1.1. Popup Scope (`popup/`)
- Kích thước hiển thị cố định: `width: 380px`, chiều cao tổng thể khống chế ở `540px` để vừa vặn với popup menu trình duyệt Chrome mà không xuất hiện thanh cuộn ngoài cùng của body.
- Thẻ `body` có `overflow: hidden; user-select: none; -webkit-user-select: none;`.
- Phần cuộn chỉ nằm trong `.tab-content` với scrollbar tùy chỉnh tinh tế (`5px`, bo góc `4px`).
- Quản lý tab chuyển đổi trạng thái (`settings` vs `vocabulary`) bằng data attribute `data-tab` và class `.active`.

### 1.2. Content Script & Shadow DOM Scope (`content/`)
- Mọi thành phần giao diện nổi trên trang web của người dùng (Tooltip tra từ) **BẮT BUỘC** nằm trong Shadow DOM (`attachShadow({ mode: 'open' })`).
- **Mục tiêu cô lập (Encapsulation)**:
  - Phong cách CSS của trang web hiện tại (Tailwind, Bootstrap, resets) không được làm biến dạng Tooltip của ContextDict.
  - Ngược lại, CSS của ContextDict tuyệt đối không được rò rỉ (leak) ra làm ảnh hưởng layout của website người dùng.
- Bên trong Shadow DOM root: Luôn có CSS reset:
  ```css
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  ```
- Định vị Tooltip: Luôn tính toán `getBoundingClientRect()` và kiểm tra tràn viền màn hình (`viewport width/height`) để không bị che khuất.

### 1.3. Background Worker Scope (`background/`)
- Không có quyền truy cập DOM (`window`, `document` không tồn tại).
- Mọi giao tiếp giữa Popup, Content Script và Background phải sử dụng `chrome.runtime.sendMessage` và `chrome.runtime.onMessage`.

---

## 2. Bảo Mật & Manifest V3 CSP (Content Security Policy)

Chrome Extension MV3 áp dụng chính sách bảo mật CSP nghiêm ngặt:
- ❌ **CẤM** viết code JS inline trong file HTML: Không dùng `<script>/* code */</script>`, không dùng các thuộc tính như `onclick="..."`, `onchange="..."`, `href="javascript:..."`.
- ✅ **BẮT BUỘC** đính kèm file JS qua thẻ `<script type="module" src="popup.js"></script>` và gắn listener bằng `addEventListener`.
- ❌ **CẤM** sử dụng `eval()`, `new Function(...)` hoặc thư viện cần dynamic code evaluation.
- ✅ Khi mở liên kết ngoài từ Popup (ví dụ liên kết lấy OpenRouter API key): Luôn dùng `target="_blank"` kèm `rel="noopener noreferrer"`.

---

## 3. Quy Chuẩn CSS & Tương Thích Trình Duyệt

- **Vendor Prefixes**:
  - Đối với kính mờ: Luôn viết `-webkit-backdrop-filter: blur(...)` trước `backdrop-filter: blur(...)`.
  - Đối với chọn văn bản: Luôn viết `-webkit-user-select: none` đi kèm `user-select: none`.
- **CSS Specificity**:
  - Không lạm dụng `!important` trong phạm vi Popup (`popup.css`).
  - Đối với highlight từ vựng trên trang (`content/content.css`), cho phép dùng `!important` để đảm bảo không bị CSS phức tạp của trang web ghi đè.
- **Scrollbar Styling**:
  - Dùng `-webkit-scrollbar` gọn nhẹ cho Chrome/Chromium:
  ```css
  .tab-content::-webkit-scrollbar { width: 5px; }
  .tab-content::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
    border-radius: 4px;
  }
  ```

---

## 4. Quản Lý Tài Nguyên & Web Accessible Resources

- Các tài nguyên ảnh/icon nhúng trong Popup HTML dùng đường dẫn tương đối trực tiếp (ví dụ: `../icons/icon-48.png`, `assets/empty-notebook.webp`).
- Bất kỳ tài nguyên nào cần nhúng vào website thông qua Content Script phải được khai báo trong `manifest.json` tại mục `web_accessible_resources` và truy xuất qua `chrome.runtime.getURL('path/to/asset')`.
