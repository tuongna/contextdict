---
name: build-ui
description: >-
  Use this skill when implementing, styling, or updating UI screens, forms, cards, tabs, or dialogs in ContextDict. Guides the end-to-end workflow from token mapping to accessibility and state coverage.
---

# Build UI Workflow — ContextDict

Kỹ năng này hướng dẫn quy trình tiêu chuẩn từng bước khi thiết kế và triển khai bất kỳ thành phần giao diện nào trong ContextDict.

---

## Các Bước Thực Hiện (Execution Steps)

### Bước 1: Khảo sát thành phần hiện có (Component Audit)
1. Trước khi viết HTML/CSS mới, kiểm tra các thành phần đã có trong:
   - [popup.html](file:///Users/nguyenanhtuong.vn/Proj/contextdict/popup/popup.html)
   - [popup.css](file:///Users/nguyenanhtuong.vn/Proj/contextdict/popup/popup.css)
   - [tooltip.js](file:///Users/nguyenanhtuong.vn/Proj/contextdict/content/tooltip.js)
2. Ưu tiên tái sử dụng các class utility hoặc cấu trúc card, button, input đã được chuẩn hóa thay vì chế tạo mới.

### Bước 2: Đối chiếu Design Tokens
1. Đọc [design-system.md](file:///Users/nguyenanhtuong.vn/Proj/contextdict/.agents/rules/design-system.md).
2. Xác định các token cần dùng:
   - Nền: `--bg-primary`, `--bg-secondary`, `--bg-card`
   - Viền: `--border-color`, `--border-accent`
   - Điểm nhấn: `--accent-primary`, `--accent-cyan`
   - Chữ: `--text-main`, `--text-muted`, `--text-subtle`
   - Bo góc: `--radius-sm` (6px), `--radius-md` (10px), `--radius-lg` (14px)
3. **Tuyệt đối cấm** thêm mã màu hex hoặc kích thước margin/padding tùy tiện không thuộc lưới 4px.

### Bước 3: Triển khai Cấu trúc HTML & Ngữ nghĩa
1. Sử dụng thẻ HTML ngữ nghĩa (`<button>`, `<label>`, `<section>`).
2. Khai báo đầy đủ `id`, `class` có tính mô tả cao theo quy ước đặt tên (BEM-lite).
3. Đảm bảo các nút icon có `aria-label` và `title` theo [accessibility.md](file:///Users/nguyenanhtuong.vn/Proj/contextdict/.agents/rules/accessibility.md).

### Bước 4: Hoàn thiện Tất cả Trạng thái Tương tác (State Coverage)
Một thành phần UI đạt chuẩn **phải** có đủ các trạng thái sau trong CSS:
- [ ] **Default**: Trạng thái nghỉ ban đầu.
- [ ] **Hover**: Phản hồi mượt mà (`transition: all 0.2s ease`).
- [ ] **Active / Pressed**: Cảm giác nhấn phím tự nhiên (`transform: scale(0.98)` hoặc thay đổi nền nhẹ).
- [ ] **Focus-visible**: Viền highlight rõ nét cho người dùng điều hướng bằng bàn phím.
- [ ] **Disabled** (nếu có): Độ mờ `opacity: 0.5; cursor: not-allowed;`.
- [ ] **Loading / Empty** (nếu có): Spinner hoặc Empty state minh họa thân thiện.

### Bước 5: Kiểm tra Ranh giới Môi trường
- Nếu là thành phần trong **Popup**: Đảm bảo không làm bung vỡ layout cố định `380px × 540px`.
- Nếu là thành phần trong **Content Script (Tooltip)**: Đảm bảo được đóng gói trong Shadow DOM và có CSS reset đầy đủ.

### Bước 6: Tự Review với Checklist Anti-Generic
Đối chiếu với Mục 10 trong [design-system.md](file:///Users/nguyenanhtuong.vn/Proj/contextdict/.agents/rules/design-system.md):
- [ ] Không có màu sắc tuỳ tiện ngoài token?
- [ ] Không có glow neon thái quá?
- [ ] Không biến mọi thứ thành pill rounded?
- [ ] Chữ đủ độ tương phản trên nền tối?
- [ ] Có hỗ trợ `prefers-reduced-motion` không?
