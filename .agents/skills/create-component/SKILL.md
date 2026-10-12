---
name: create-component
description: >-
  Use this skill when designing and creating a new reusable UI component or widget for ContextDict (such as a modal, toast notification, dropdown menu, or custom card).
---

# Create Component Workflow — ContextDict

Kỹ năng này cung cấp quy trình chuẩn khi tạo một component giao diện mới có tính tái sử dụng cao trong ContextDict.

---

## Các Bước Triển Khai (Component Authoring Process)

### Bước 1: Xác Định Ngữ Cảnh Hoạt Động (Target Scope)
Xác định rõ component mới sẽ chạy trong môi trường nào:
1. **Popup Context**: Viết CSS trong `popup/popup.css`, HTML trong `popup/popup.html`, tương tác trong `popup/popup.js`.
2. **Shadow DOM Context (Content Tooltip)**: Viết CSS trong template string của `content/tooltip.js` (dùng prefix class `cd-`), tạo DOM bằng code JS `document.createElement(...)`.
3. **Injected Page Context**: Nếu chèn trực tiếp vào DOM của trang web (như từ highlight), phải dùng prefix `contextdict-` và cô lập bằng `!important` vừa đủ để không bị CSS của trang đè bẹp.

### Bước 2: Lập Bản Đồ Token (Token Mapping Matrix)
Trước khi viết CSS, liệt kê rõ các token sẽ sử dụng:

```text
Component: [Tên Component, ví dụ: Toast Notification]
- Background: var(--bg-card) hoặc rgba(15, 23, 42, 0.95)
- Backdrop: -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
- Border: 1px solid var(--border-color)
- Radius: var(--radius-md) (10px)
- Text Primary: var(--text-main)
- Text Secondary: var(--text-muted)
- Shadow: 0 8px 24px rgba(0, 0, 0, 0.4)
```

### Bước 3: Đặt Tên Lớp Theo Quy Ước (Class Naming Convention)
- **Trong Popup**: Dùng cấu trúc rõ ràng, súc tích:
  - Block: `.btn`, `.modal`, `.toast`, `.dropdown`
  - Modifier: `.btn-primary`, `.btn-danger`, `.btn-sm`, `.is-active`, `.is-hidden`
- **Trong Shadow DOM Tooltip**: Luôn có prefix `cd-`:
  - `.cd-toast`, `.cd-toast-header`, `.cd-toast-body`, `.cd-toast-close`

### Bước 4: Viết CSS Hoàn Thiện Các Trạng Thái
Mẫu CSS tham khảo chuẩn mực:

```css
/* Component Base */
.cd-custom-component {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  color: var(--text-main);
  font-size: 13px;
  line-height: 1.5;
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
}

/* Hover State */
.cd-custom-component:hover {
  border-color: var(--border-accent);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.3);
}

/* Focus Visible */
.cd-custom-component:focus-visible {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.35);
}

/* Disabled State */
.cd-custom-component:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}
```

### Bước 5: Kiểm Thử Thực Tế (Verification)
1. Chèn component vào [test-page.html](file:///Users/nguyenanhtuong.vn/Proj/contextdict/test-page.html) hoặc giao diện popup xem trước.
2. Kiểm tra thao tác bàn phím (`Tab`, `Enter`, `Esc`).
3. Chạy skill `review-ui` để tự động đối soát lỗi thiết kế.
