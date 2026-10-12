# ContextDict — Chrome Extension Dịch Web Theo Ngữ Cảnh AI

ContextDict là tiện ích mở rộng (Chrome Extension Manifest V3) giúp bạn dịch từ hoặc cụm từ khi rê chuột (hover), kết hợp trí tuệ nhân tạo (OpenRouter API) để phân tích **ngữ cảnh câu** và **chủ đề trang web**, mang lại bản dịch chuẩn xác nhất thay vì dịch nghĩa đen máy móc.

---

## 🌟 Tính Năng Nổi Bật

1. **Hover Translate Tự Động**: Rê chuột lên từ đơn tiếng Anh bất kỳ để xem bản dịch sau độ trễ cấu hình (mặc định 1000ms).
2. **Dịch Cụm Từ & Thành Ngữ (Selection)**: Bôi đen một cụm từ (idiom, phrasal verb) và rê chuột lên vùng chọn để dịch toàn bộ cụm.
3. **Phân Tích 2 Tầng Ngữ Cảnh**:
   - 📖 **Ngữ cảnh câu**: Giải thích vai trò và ý nghĩa của từ trong câu cụ thể.
   - 🌐 **Ngữ cảnh trang web**: Dựa trên tiêu đề, mô tả và heading của trang để giải thích tại sao từ mang sắc thái đó (ví dụ: *"bank"* trên trang tự nhiên là "bờ sông", trên trang tài chính là "ngân hàng").
4. **Giao Diện Shadow DOM Chống Tràn CSS**: Tooltip được bọc trong Shadow DOM riêng biệt, đảm bảo không bị ảnh hưởng bởi CSS của trang web gốc.
5. **Text-To-Speech (Phát Âm)**: Tích hợp nút 🔊 phát âm chuẩn tiếng Anh qua Web Speech API.
6. **Sổ Từ Vựng (Vocabulary Notebook)**:
   - Bấm nút ⭐ để lưu từ vựng kèm ngữ cảnh và đường link bài viết gốc.
   - Tự động highlight các từ đã lưu khi bạn duyệt bất kỳ trang web nào (batch rendering mượt mà, không giật lag).
   - Quản lý, tìm kiếm, xoá và xuất file JSON danh sách từ vựng.
7. **Bộ Nhớ Đệm Thông Minh (LRU Cache)**: Lưu trữ các bản dịch đã thực hiện trong 7 ngày, giúp tra cứu tức thì và tiết kiệm chi phí API.
8. **Hỗ Trợ OpenRouter**: Tương thích với các model AI miễn phí (`openrouter/free`, `google/gemma-4-26b-a4b-it:free`, `google/gemma-4-31b-it:free`, `nvidia/nemotron-3.5-lightning:free`...) hoặc trả phí tuỳ chọn.

---

## 📁 Cấu Trúc Thư Mục

```
contextdict/
├── manifest.json              # Khai báo Manifest V3
├── icons/                     # Biểu tượng 16x16, 48x48, 128x128
├── background/
│   ├── service-worker.js      # Điều phối message, settings, tabs
│   ├── api-client.js          # Gọi OpenRouter API & prompt engineering
│   ├── cache.js               # Bộ nhớ đệm LRU lưu trong chrome.storage.local
│   └── vocabulary.js          # Quản lý CRUD từ vựng đã lưu
├── content/
│   ├── content.js             # Kết nối các module content script
│   ├── content.css            # Styles highlight từ vựng trên trang
│   ├── hover-detector.js      # Nhận diện từ dưới con trỏ & vùng bôi đen
│   ├── context-collector.js   # Trích xuất câu và thông tin trang web
│   ├── tooltip.js             # UI Tooltip dạng Shadow DOM
│   ├── highlight.js           # Quản lý highlight từ vựng bằng TreeWalker
│   └── tts.js                 # Phát âm bằng Web Speech API
├── popup/
│   ├── popup.html             # Giao diện cài đặt & sổ từ vựng
│   ├── popup.css              # Giao diện Glassmorphism Dark Mode
│   └── popup.js               # Xử lý logic tab Cài đặt & Sổ từ vựng
└── test-page.html             # Trang mẫu để kiểm tra ngữ cảnh đa nghĩa
```

---

## 🚀 Hướng Dẫn Cài Đặt Vào Chrome

1. Mở Google Chrome hoặc trình duyệt nhân Chromium (Brave, Edge, Cốc Cốc).
2. Truy cập thanh địa chỉ: `chrome://extensions/`
3. Bật công tắc **"Chế độ dành cho nhà phát triển" (Developer mode)** ở góc trên bên phải.
4. Bấm nút **"Tải tiện ích đã giải nén" (Load unpacked)**.
5. Chọn thư mục:
   ```
   ~/Proj/contextdict
   ```
6. Tiện ích **ContextDict** sẽ xuất hiện trên thanh công cụ của trình duyệt.

---

## ⚙️ Cấu Hình API Key

1. Bấm vào biểu tượng **ContextDict** trên thanh tiện ích của trình duyệt.
2. Tại tab **Cài đặt**:
   - Nhập **OpenRouter API Key** của bạn (Lấy key miễn phí tại [openrouter.ai/keys](https://openrouter.ai/keys)).
   - Chọn **Mô hình AI** mong muốn (mặc định khuyến nghị: `openrouter/free` hoặc `google/gemma-4-26b-a4b-it:free`).
   - Tuỳ chỉnh **Độ trễ khi Hover** (khuyên dùng 300ms - 450ms).
   - Bấm **"Lưu cấu hình"**.
3. Bây giờ bạn có thể mở bất kỳ trang web tiếng Anh nào (hoặc mở file [test-page.html](test-page.html) đi kèm) và rê chuột lên từ để trải nghiệm!
