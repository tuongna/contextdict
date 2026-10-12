# ContextDict — Design System Specification

Tài liệu này xác định bộ quy chuẩn thiết kế giao diện (Design System) cho dự án **ContextDict**.
Mọi thành phần UI trong Popup, Options, và Injected Content Tooltip (Shadow DOM) **bắt buộc phải tuân theo tài liệu này**.

---

## 1. Triết lý Thiết kế (Design Philosophy)

- **Dark Glassmorphism & Utility-Dense**: Phong cách nền tối sâu kết hợp hiệu ứng kính mờ tinh tế, độ tương phản cao, mật độ thông tin gọn gàng phục vụ tra cứu nhanh mà không gây xao nhãng.
- **Calm & Focused**: Không dùng hiệu ứng phô trương, màu neon chói lóa hay hoạt ảnh giật cục. Mọi pixel đều phục vụ mục đích đọc hiểu và ghi nhớ từ vựng.
- **Anti-Generic AI**: Tránh tuyệt đối các thiết kế "AI template" điển hình (nút tím bóng bẩy quá đà, viền phát sáng neon, bo tròn pill ở khắp nơi).

---

## 2. Hệ Thống Màu & Semantic Tokens

Mọi giá trị màu trong code phải dùng CSS Custom Properties hoặc tham chiếu chính xác các mã màu sau. **CẤM** đặt mã màu HEX/RGB tùy ý trong component.

### 2.1. Nền (Surfaces & Backgrounds)
| Token | Giá trị | Mục đích sử dụng |
|---|---|---|
| `--bg-primary` | `#0b0f19` | Nền chính của popup, toàn bộ body |
| `--bg-secondary` | `#131b2e` | Nền phụ, header tab bar, container nổi |
| `--bg-card` | `rgba(30, 41, 59, 0.7)` | Thẻ từ vựng, card danh sách, box chi tiết |
| `--bg-tooltip` | `rgba(15, 23, 42, 0.95)` | Nền tooltip trong Shadow DOM |
| `--bg-input` | `rgba(15, 23, 42, 0.6)` | Nền input text, password, select box |

### 2.2. Viền (Borders & Dividers)
| Token | Giá trị | Mục đích sử dụng |
|---|---|---|
| `--border-color` | `rgba(255, 255, 255, 0.08)` | Viền mặc định ngăn cách card, header, input |
| `--border-accent` | `rgba(99, 102, 241, 0.35)` | Viền active, hover card, viền card tooltip |
| `--border-focus` | `#6366f1` | Trạng thái focus của input/select |

### 2.3. Màu Điểm Nhấn (Brand Accents)
| Token | Giá trị | Mục đích sử dụng |
|---|---|---|
| `--accent-primary` | `#6366f1` (Indigo) | Màu thương hiệu chủ đạo, CTA chính, toggle checked |
| `--accent-secondary` | `#8b5cf6` (Purple) | Gradient kết thúc cho nút chính, logo badge |
| `--accent-cyan` | `#38bdf8` (Cyan/Sky) | Bản dịch nghĩa chính, highlight tag, badge giá trị |

### 2.4. Văn Bản (Typography Colors)
| Token | Giá trị | Mục đích sử dụng |
|---|---|---|
| `--text-main` | `#f8fafc` | Tiêu đề, từ tiếng Anh chính, nội dung quan trọng (độ tương phản cao nhất) |
| `--text-muted` | `#94a3b8` | Nhãn phụ, câu ví dụ, mô tả phụ |
| `--text-subtle` | `#64748b` | Metadata, ngày tháng, liên kết nguồn |

### 2.5. Trạng Thái Hệ Thống (Feedback & Status)
| Token | Giá trị | Mục đích sử dụng |
|---|---|---|
| `--danger` | `#ef4444` | Nút xóa, trạng thái lỗi |
| `--danger-bg` | `rgba(239, 68, 68, 0.15)` | Nền hover nút xóa |
| `--success` | `#34d399` | Thông báo lưu thành công, dot trạng thái hoạt động |
| `--warning` | `#fbbf24` | Icon ngôi sao từ vựng đã lưu |

---

## 3. Typography (Kiểu Chữ)

### 3.1. Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", Arial, sans-serif;
```
Phát âm IPA và Monospace dùng:
```css
font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
```

### 3.2. Type Scale (Thang cỡ chữ)
- **16px (Bold / 700)**: Từ khóa tiếng Anh chính trong Tooltip Header (`.cd-word`).
- **15px (Bold / 700)**: Tiêu đề Popup Logo (`.logo-title`), nghĩa dịch nổi bật (`.cd-translation`).
- **14px / 14.5px (Bold / 700)**: Tên từ vựng trong danh sách thẻ (`.vocab-word`).
- **13px (Regular / 400 & Semi-bold / 600)**: Body text chuẩn, nghĩa tiếng Việt trong card.
- **12px - 12.5px (Regular / 400 & Medium / 500)**: Input text, label form, nút bấm (`.btn`).
- **11px - 11.5px (Medium / 500)**: Nhãn tab navigation, câu ví dụ in nghiêng, context badge.
- **10px - 10.5px (Bold / 600 - 700)**: Badges đếm số, meta tag, nhãn thang đo slider.

---

## 4. Spacing System (Hệ Thống Khoảng Cách)

Dựa trên **lưới 4px (4px Grid)**:
- `4px` (`gap: 4px`, `padding: 4px`): Khoảng cách giữa các icon button, padding nút nhỏ.
- `6px` (`gap: 6px`, `margin-bottom: 6px`): Khoảng cách giữa label và input, badge padding.
- `8px` (`padding: 8px 10px`, `gap: 8px`): Khoảng cách liên kết các khối nhỏ trong card.
- `10px - 12px`: Padding chuẩn cho card (`.vocab-card`), khoảng cách form control.
- `14px - 16px`: Padding ngoài viền của popup body (`.tab-pane { padding: 16px; }`).

**Quy tắc:** Tuyệt đối không dùng các khoảng cách tùy tiện như `7px`, `13px`, `19px`.

---

## 5. Bo Góc (Border Radius)

Chỉ sử dụng 3 cấp độ bo góc có kiểm soát:
- `--radius-sm`: `6px` → Nút nhỏ (`.btn-sm`), ô input, badge thể loại từ.
- `--radius-md`: `10px` → Thẻ từ vựng (`.vocab-card`), container nhỏ.
- `--radius-lg`: `14px` → Khung cửa sổ Tooltip (`.cd-card`), modal wrapper.
- `Pill (50% hoặc 9999px)`: **CHỈ** áp dụng cho: Switch Toggle (`.slider.round`), Dot trạng thái (`.dot`), và thanh tìm kiếm dạng viên thuốc (`.search-wrap input`). Không áp dụng bừa bãi cho nút thông thường.

---

## 6. Liquid Glass, Specular Physics & Hiệu Ứng Chiều Sâu

### 6.1. Nguyên lý Kính Lỏng (Liquid Glass Physics)
Khác với Glassmorphism thông thường (chỉ làm mờ phẳng), Liquid Glass mô phỏng thấu kính lỏng trong suốt khúc xạ ánh sáng thực tế:
1. **Độ bão hòa màu cao (High-Saturate Refraction):**
   ```css
   backdrop-filter: blur(20px) saturate(190%) contrast(104%);
   -webkit-backdrop-filter: blur(20px) saturate(190%) contrast(104%);
   ```
2. **Specular Rim Light (Viền phản xạ khúc xạ ánh sáng mép trên):**
   Mô phỏng ánh sáng chiếu từ trên xuống mép vát của tấm kính thủy tinh bằng `box-shadow` hai tầng:
   ```css
   box-shadow: 
     inset 0 1px 1px 0 rgba(255, 255, 255, 0.22),
     inset 0 -1px 1px 0 rgba(0, 0, 0, 0.2),
     0 12px 36px -4px rgba(0, 0, 0, 0.5),
     0 4px 12px -2px rgba(0, 0, 0, 0.3);
   ```
3. **Tactile Inset Glass Groove (Rãnh kính chìm cho Inputs & Sliders):**
   ```css
   background: rgba(15, 23, 42, 0.55);
   box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(255, 255, 255, 0.06);
   ```

### 6.2. Backdrop Filter (Mờ nền)
- Popup Surface, Cards & Tooltip: Dùng `blur(18px)` đến `blur(24px)` kết hợp `saturate(180%-190%)`.
- Luôn đính kèm vendor prefix: `-webkit-backdrop-filter` song song với `backdrop-filter`.

### 6.3. Box Shadows (Đổ bóng Liquid Glass)
- **Card Kính Mặc định**: `0 4px 16px -2px rgba(0, 0, 0, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.12)`
- **Card Kính Hover**: `0 8px 24px -4px rgba(0, 0, 0, 0.45), 0 0 12px rgba(99, 102, 241, 0.15), inset 0 1px 1px 0 rgba(255, 255, 255, 0.22)`
- **Tooltip Floating Liquid Slab**: `0 20px 48px -6px rgba(0, 0, 0, 0.6), 0 8px 20px -2px rgba(0, 0, 0, 0.4), inset 0 1px 1.5px 0 rgba(255, 255, 255, 0.28)`
- **Button CTA Liquid Sheen**: `0 4px 16px rgba(99, 102, 241, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.25)`

---

## 7. Motion & Chuyển Cảnh (Transitions)

- Thời lượng: Chỉ dùng từ `0.16s` đến `0.24s`.
- Hàm gia tốc (Fluid Spring): `cubic-bezier(0.16, 1, 0.3, 1)`.
- Không animate `all`—luôn chỉ định đích danh thuộc tính (`transform`, `opacity`, `background-color`, `border-color`, `box-shadow`).
- Tôn trọng `@media (prefers-reduced-motion: reduce)`.

---

## 8. Biểu Tượng (Iconography)

- Sử dụng **Inline SVG** phong cách Lucide / Feather:
  - `stroke-width: 2` (hoặc `2.2` cho icon nhỏ 12px)
  - `fill: none`, `stroke: currentColor`
  - Kích thước phổ biến: `12px` (icon phụ), `14px` (tab/input), `16px` (hành động chính).
- Tránh nhúng icon fonts cồng kềnh hay emoji thay thế icon hệ thống.

---

## 9. Định Danh Sản Phẩm (ContextDict Personality)

- **Mục đích**: Tiện ích hỗ trợ người Việt học tiếng Anh trong ngữ cảnh thực tế của website.
- **Tông giọng giao diện**: Rõ ràng, nhã nhặn, hữu ích. Ngữ nghĩa tiếng Việt chính xác, tự nhiên.
- **Mật độ thông tin**: Gọn gàng (compact), phù hợp với khung popup giới hạn `380px × 540px` và floating tooltip `320px`.

---

## 10. Danh Mục Cấm Đoán (Anti-Pattern Checklist)

Khi triển khai UI, Agent **PHẢI** kiểm tra danh sách này để không vi phạm:

- ❌ **KHÔNG** dùng mã màu ngoài hệ thống token (ví dụ: gõ bừa `#3b82f6`, `#10b981`, `#84cc16`).
- ❌ **KHÔNG** làm viền phát sáng neon rực rỡ dạng sci-fi rẻ tiền.
- ❌ **KHÔNG** bo tròn pill (`border-radius: 9999px`) cho tất cả mọi nút bấm.
- ❌ **KHÔNG** lạm dụng gradient 7 màu. Gradient chỉ cho phép:
  - CTA Button: `linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)`
  - Highlight từ trên web: `linear-gradient(120deg, rgba(99, 102, 241, 0.22), rgba(168, 85, 247, 0.22))`
- ❌ **KHÔNG** để font-size nhỏ hơn `10px` (gây khó đọc trên màn hình độ phân giải cao).
- ❌ **KHÔNG** thiếu các trạng thái tương tác: `hover`, `focus-visible`, `active`, `disabled`.
