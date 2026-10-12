# ContextDict — Accessibility (A11y) Standards

Tài liệu này xác định các tiêu chuẩn khả năng tiếp cận (Accessibility - WCAG 2.1 AA) áp dụng cho Chrome Extension **ContextDict**.

---

## 1. Điều Hướng Bằng Bàn Phím (Keyboard Navigation)

Người dùng phải có thể sử dụng đầy đủ các tính năng của extension mà không bắt buộc dùng chuột:

### 1.1. Thứ tự Tab (Tab Order) hợp lý
- Trình tự điều hướng tab trong Popup:
  1. Toggle Bật/Tắt tiện ích ở header.
  2. Các tab chuyển đổi (`Cài đặt` ↔ `Sổ từ vựng`).
  3. Các input controls trong tab hiện tại.
  4. Các nút hành động phía dưới (`Lưu cấu hình`, `Xoá Cache`, `Xuất file`, `Xoá hết`).

### 1.2. Vòng nét Focus rõ ràng (Focus Visible Rings)
- Mọi phần tử tương tác (`button`, `input`, `select`, `a`) khi được focus bằng bàn phím phải hiển thị đường viền tương phản nổi bật:
  ```css
  :focus-visible {
    outline: none;
    border-color: var(--accent-primary);
    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.35);
  }
  ```
- **CẤM** viết `outline: none;` mà không cung cấp chỉ báo focus thay thế tương đương.

### 1.3. Phím tắt Đóng (Escape Key)
- Trong Content Script: Khi Tooltip tra từ đang mở, nhấn phím `Escape` phải lập tức đóng Tooltip và trả lại trạng thái bình thường cho trang.

---

## 2. Thẻ Ngữ Nghĩa & ARIA (Semantic HTML & ARIA Labels)

### 2.1. Nút chỉ có Biểu tượng (Icon-only Buttons)
- Bất kỳ nút nào chỉ chứa SVG/icon mà không có chữ hiển thị đều **BẮT BUỘC** có `aria-label` và `title` mô tả hành động rõ ràng:
  - Nút hiện/ẩn mật khẩu: `aria-label="Hiện hoặc ẩn API Key"`
  - Nút xoá từ: `aria-label="Xoá từ khỏi sổ từ vựng"`
  - Nút phát âm (TTS): `aria-label="Phát âm từ vựng"`
  - Nút lưu sao: `aria-label="Lưu vào sổ từ vựng"`
  - Nút xoá ô tìm kiếm: `aria-label="Xoá nội dung tìm kiếm"`

### 2.2. Gắn kết Label và Input
- Mọi ô nhập dữ liệu (`<input>`, `<select>`) đều phải liên kết với một `<label>` có thuộc tính `for="id_tuong_ung"`.
- Range slider phải đi kèm giá trị số hiển thị đồng bộ (`<span id="hoverDelayValue">1000 ms</span>`) và `aria-valuenow`.

### 2.3. Cấu trúc ngữ nghĩa (Semantic Hierarchy)
- Sử dụng đúng cấu trúc: `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`.
- Chỉ dùng đúng một thẻ `<h1>` duy nhất trong popup cho tên ứng dụng (`ContextDict`).

---

## 3. Độ Tương Phản Màu (Color Contrast)

- Tuân thủ tiêu chuẩn tối thiểu **WCAG AA (4.5:1)** cho văn bản thông thường trên nền tối:
  - Văn bản chính (`--text-main: #f8fafc` trên `#0b0f19`): Đạt tỷ lệ > 14:1 (Rất tốt).
  - Văn bản phụ (`--text-muted: #94a3b8` trên `#0b0f19`): Đạt tỷ lệ > 7:1 (Tốt).
  - Tránh dùng `--text-subtle` (`#64748b`) cho văn bản nội dung quan trọng; chỉ dùng cho nhãn phụ và metadata thứ cấp.
- **Không chỉ dựa vào màu sắc**: Thông báo lỗi hoặc thành công phải đi kèm văn bản rõ ràng hoặc icon nhận diện, không dùng chỉ mỗi màu đỏ/xanh để biểu thị.

---

## 4. Hỗ Trợ Giảm Hoạt Ảnh (Prefers-Reduced-Motion)

Tôn trọng thiết lập của người dùng hệ điều hành khi họ bật tuỳ chọn giảm chuyển động:
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .empty-state-img {
    animation: none !important;
  }
}
```
