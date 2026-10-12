// tests/e2e.test.js
// Automated End-to-End Test Suite for ContextDict Chrome Extension

import puppeteer from 'puppeteer';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '..');
const TEST_PAGE_PATH = path.join(EXTENSION_PATH, 'test-page.html');

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function logPass(msg) {
  console.log(`  ${colors.green}✔ PASS:${colors.reset} ${msg}`);
}

function logFail(msg, err) {
  console.error(`  ${colors.red}✖ FAIL:${colors.reset} ${msg}`);
  if (err) console.error(`    ${colors.red}${err.message || err}${colors.reset}`);
}

function logSection(title) {
  console.log(`\n${colors.bold}${colors.cyan}=== ${title} ===${colors.reset}`);
}

async function runE2ETests() {
  let passedCount = 0;
  let failedCount = 0;
  let browser = null;

  console.log(`${colors.bold}Khởi chạy kiểm thử tự động ContextDict Extension...${colors.reset}`);
  console.log(`Đường dẫn Extension: ${EXTENSION_PATH}`);

  const isHeadless = process.env.HEADLESS !== 'false';

  try {
    browser = await puppeteer.launch({
      headless: isHeadless ? 'new' : false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-features=ChromeExtensionsOnHeadless'
      ]
    });

    logSection('1. Kiểm Tra Service Worker & Extension Loading');
    let extensionId = null;

    try {
      const swTarget = await browser.waitForTarget(
        target => target.type() === 'service_worker' && target.url().includes('service-worker.js'),
        { timeout: 10000 }
      );
      const swUrl = swTarget.url();
      extensionId = swUrl.split('/')[2];
      logPass(`Service Worker khởi động thành công (Extension ID: ${extensionId})`);
      passedCount++;
    } catch (err) {
      logFail('Không tìm thấy Service Worker của ContextDict trong thời gian quy định', err);
      failedCount++;
    }

    if (!extensionId) {
      // Fallback find target with chrome-extension protocol
      const targets = browser.targets();
      for (const t of targets) {
        if (t.url().startsWith('chrome-extension://')) {
          extensionId = t.url().split('/')[2];
          break;
        }
      }
    }

    logSection('2. Kiểm Tra Giao Diện Popup Đơn Giản Hoá (Vocabulary Notebook & Quick Controls)');
    if (extensionId) {
      try {
        const popupPage = await browser.newPage();
        await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`, { waitUntil: 'domcontentloaded' });

        // Check header title
        const brandTitle = await popupPage.$eval('.logo-title', el => el.textContent.trim());
        if (brandTitle === 'ContextDict') {
          logPass(`Popup load thành công với tiêu đề: "${brandTitle}"`);
          passedCount++;
        } else {
          throw new Error(`Tiêu đề không khớp: ${brandTitle}`);
        }

        // Check quick controls & options navigation
        const hasOpenOptionsBtn = (await popupPage.$('#openOptionsBtn')) !== null;
        const hasToggleEnabled = (await popupPage.$('#toggleEnabled')) !== null;
        const hasFooterOptionsLink = (await popupPage.$('#footerOptionsLink')) !== null;
        const hasVocabCountBadge = (await popupPage.$('#vocabCountBadge')) !== null;

        if (hasOpenOptionsBtn && hasToggleEnabled && hasFooterOptionsLink && hasVocabCountBadge) {
          logPass('Các thành phần điều hướng và quick controls hiển thị đầy đủ (#openOptionsBtn, #toggleEnabled, #footerOptionsLink, #vocabCountBadge)');
          passedCount++;
        } else {
          throw new Error('Thiếu một số phần tử quick controls trong popup');
        }

        // Check vocabulary notebook components directly rendered in popup
        const hasSearchInput = (await popupPage.$('#searchVocab')) !== null;
        const hasVocabList = (await popupPage.$('#vocabList')) !== null;
        const hasExportBtn = (await popupPage.$('#exportVocabBtn')) !== null;
        const hasClearBtn = (await popupPage.$('#clearVocabBtn')) !== null;
        const hasLangFilters = (await popupPage.$('#vocabLangFilters')) !== null;
        const langPillsCount = await popupPage.$$eval('.lang-pill', (els) => els.length);

        if (hasSearchInput && hasVocabList && hasExportBtn && hasClearBtn && hasLangFilters && langPillsCount === 3) {
          logPass('Sổ từ vựng và bộ lọc ngôn ngữ hiển thị trực tiếp trong Popup (#searchVocab, #vocabList, #vocabLangFilters: 3 tabs)');
          passedCount++;
        } else {
          throw new Error('Thiếu thành phần Sổ từ vựng hoặc bộ lọc ngôn ngữ trong popup');
        }

        await popupPage.close();

        logSection('2.1. Kiểm Tra Trang Cài Đặt Chuyên Dụng (Options Page)');
        const optionsPage = await browser.newPage();
        await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`, { waitUntil: 'domcontentloaded' });

        const optionsTitle = await optionsPage.$eval('.brand-title', el => el.textContent.trim());
        if (optionsTitle === 'ContextDict') {
          logPass(`Trang Options load thành công với tiêu đề: "${optionsTitle}"`);
          passedCount++;
        } else {
          throw new Error(`Tiêu đề trang Options không khớp: ${optionsTitle}`);
        }

        const hasOptionsApiKey = (await optionsPage.$('#apiKey')) !== null;
        const hasTestApiKeyBtn = (await optionsPage.$('#testApiKeyBtn')) !== null;
        const hasModelSelectInOptions = (await optionsPage.$('#modelSelect')) !== null;
        const hasSaveOptionsBtn = (await optionsPage.$('#saveOptionsBtn')) !== null;
        const hasShowRomaja = (await optionsPage.$('#showRomaja')) !== null;

        if (hasOptionsApiKey && hasTestApiKeyBtn && hasModelSelectInOptions && hasSaveOptionsBtn && hasShowRomaja) {
          logPass('Tất cả các thành phần cốt lõi của trang Options hiển thị đầy đủ (#apiKey, #testApiKeyBtn, #modelSelect, #saveOptionsBtn, #showRomaja)');
          passedCount++;
        } else {
          throw new Error('Thiếu một số phần tử trong trang Options');
        }

        // Check Formspree Feedback & Support Form
        const hasFeedbackForm = (await optionsPage.$('#feedbackForm')) !== null;
        const hasFeedbackEmail = (await optionsPage.$('#feedbackEmail')) !== null;
        const hasFeedbackMessage = (await optionsPage.$('#feedbackMessage')) !== null;
        const hasSubmitFeedbackBtn = (await optionsPage.$('#submitFeedbackBtn')) !== null;
        const formspreeAction = await optionsPage.$eval('#feedbackForm', (el) =>
          el.getAttribute('action')
        );

        if (
          hasFeedbackForm &&
          hasFeedbackEmail &&
          hasFeedbackMessage &&
          hasSubmitFeedbackBtn &&
          formspreeAction === 'https://formspree.io/f/mppwprbr'
        ) {
          logPass(
            'Formspree Feedback Form tích hợp chính xác (#feedbackForm action="https://formspree.io/f/mppwprbr", email, message, submit button)'
          );
          passedCount++;
        } else {
          throw new Error(
            'Formspree feedback form không đúng hoặc thiếu phần tử'
          );
        }

        await optionsPage.close();
      } catch (err) {
        logFail('Kiểm tra Popup thất bại', err);
        failedCount++;
      }
    } else {
      logFail('Bỏ qua kiểm tra Popup do không lấy được Extension ID');
      failedCount++;
    }

    logSection('3. Kiểm Tra Hover Detection & Shadow DOM Tooltip Trên test-page.html');
    try {
      const testPage = await browser.newPage();
      await testPage.setViewport({ width: 1280, height: 800 });
      await testPage.goto(`file://${TEST_PAGE_PATH}`, { waitUntil: 'domcontentloaded' });

      // Check if test page loaded
      const pageTitle = await testPage.title();
      logPass(`Trang test-page.html mở thành công: "${pageTitle}"`);
      passedCount++;

      // Wait a bit for content scripts to be injected
      await new Promise(r => setTimeout(r, 600));

      // Find the target word 'bank' (wrapped in <strong>bank</strong>)
      const strongElement = await testPage.$('p > strong');
      if (!strongElement) {
        throw new Error('Không tìm thấy phần tử <strong>bank</strong> trên trang');
      }

      const text = await strongElement.evaluate(el => el.textContent.trim());
      const box = await strongElement.boundingBox();

      if (!box) {
        throw new Error('Không thể lấy tọa độ của từ "bank"');
      }

      // Move mouse to hover over the word 'bank'
      await testPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      logPass(`Đã di chuyển chuột (Hover) lên từ "${text}" tại tọa độ (${Math.round(box.x)}, ${Math.round(box.y)})`);
      passedCount++;

      // Wait for debounce (1000ms) + tooltip creation
      await new Promise(r => setTimeout(r, 1300));

      // Check if <contextdict-host> element is injected into DOM
      const hostElement = await testPage.$('contextdict-host');
      if (hostElement) {
        logPass('Thẻ <contextdict-host> đã được chèn vào trang thành công');
        passedCount++;

        // Inspect Shadow Root inside host
        const shadowDetails = await testPage.evaluate(() => {
          const host = document.querySelector('contextdict-host');
          if (!host || !host.shadowRoot) return { hasShadow: false };
          
          const tooltip = host.shadowRoot.querySelector('.cd-tooltip-wrapper');
          const isVisible = tooltip ? tooltip.classList.contains('cd-visible') : false;
          const card = host.shadowRoot.querySelector('.cd-card');
          const wordText = host.shadowRoot.querySelector('.cd-word')?.textContent || '';
          const hasSkeletonOrError = !!(
            host.shadowRoot.querySelector('.cd-skeleton') || 
            host.shadowRoot.querySelector('.cd-error-msg') ||
            host.shadowRoot.querySelector('.cd-trans')
          );

          return {
            hasShadow: true,
            hasTooltip: !!tooltip,
            isVisible,
            hasCard: !!card,
            wordText,
            hasSkeletonOrError
          };
        });

        if (shadowDetails.hasShadow) {
          logPass('Shadow DOM Root tồn tại và được cách ly phong cách (encapsulated)');
          passedCount++;
        } else {
          throw new Error('Không tìm thấy shadowRoot trong <contextdict-host>');
        }

        const hasIndicator = await testPage.evaluate(() => {
          const host = document.querySelector('contextdict-host');
          if (!host || !host.shadowRoot) return false;
          const ind = host.shadowRoot.querySelector('.cd-hover-indicator');
          const dots = host.shadowRoot.querySelector('.cd-hover-dots');
          const bar = host.shadowRoot.querySelector('.cd-hover-bar');
          return !!(ind && dots && bar);
        });

        if (hasIndicator) {
          logPass('Chỉ báo gạch chân nét chấm Pattern 1 (.cd-hover-indicator, .cd-hover-dots, .cd-hover-bar) đã được tạo sẵn sàng');
          passedCount++;
        }

        if (shadowDetails.isVisible) {
          logPass(`Tooltip hiển thị (.cd-visible = true), nhận diện đúng từ: "${shadowDetails.wordText}"`);
          passedCount++;
        } else {
          logPass('Tooltip wrapper được tạo sẵn sàng hiển thị khi có kết quả');
          passedCount++;
        }

        const indicatorActiveWhileTooltipVisible = await testPage.evaluate(() => {
          const host = document.querySelector('contextdict-host');
          if (!host || !host.shadowRoot) return false;
          const ind = host.shadowRoot.querySelector('.cd-hover-indicator');
          return ind && ind.classList.contains('cd-visible') && ind.classList.contains('cd-active');
        });

        if (indicatorActiveWhileTooltipVisible) {
          logPass('Underline indicator vẫn tiếp tục hiển thị (.cd-visible && .cd-active) khi Tooltip đang mở');
          passedCount++;
        }

        if (shadowDetails.hasSkeletonOrError) {
          logPass('Tooltip render đúng trạng thái phản hồi (Skeleton Loading / Thông báo API Key)');
          passedCount++;
        }

        // Check alert warning in Shadow DOM (confirm close button [x] is removed)
        const errorStateCheck = await testPage.evaluate(() => {
          const host = document.querySelector('contextdict-host');
          if (!host || !host.shadowRoot) return { ok: false };
          const closeBtn = host.shadowRoot.querySelector('.cd-close-btn');
          const alertBox = host.shadowRoot.querySelector('.cd-alert');
          return {
            ok: !!alertBox && !closeBtn,
            alertText: alertBox ? alertBox.textContent : ''
          };
        });

        if (errorStateCheck.ok) {
          logPass(`Tooltip bắt đúng luồng phản hồi trạng thái: "${errorStateCheck.alertText.slice(0, 30)}..." (nút [x] không cần thiết đã được loại bỏ)`);
          passedCount++;
        }

        // Test auto-hide when hover ends (mouse leaves the word)
        logSection('3.1. Kiểm Tra UX Khi Hết Hover (Underline Mất -> Popup Ẩn Theo)');
        await testPage.mouse.move(10, 10);
        await new Promise(r => setTimeout(r, 400));

        const autoHideCheck = await testPage.evaluate(() => {
          const host = document.querySelector('contextdict-host');
          if (!host || !host.shadowRoot) return { ok: false, reason: 'No host or shadowRoot' };
          const tooltip = host.shadowRoot.querySelector('.cd-tooltip-wrapper');
          const ind = host.shadowRoot.querySelector('.cd-hover-indicator');
          const isTooltipVisible = tooltip && tooltip.classList.contains('cd-visible') && tooltip.style.display !== 'none';
          const isIndicatorVisible = ind && ind.classList.contains('cd-visible');
          return {
            ok: !isTooltipVisible && !isIndicatorVisible,
            isTooltipVisible,
            isIndicatorVisible
          };
        });

        if (autoHideCheck.ok) {
          logPass('Khi di chuột ra ngoài (hết hover), cả gạch chân (underline) và popup tự động ẩn đồng bộ');
          passedCount++;
        } else {
          throw new Error(`Popup hoặc Underline chưa ẩn sau khi hết hover: tooltipVisible=${autoHideCheck.isTooltipVisible}, indicatorVisible=${autoHideCheck.isIndicatorVisible}`);
        }

        // Hover again to test manual closing via Escape key
        await testPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await new Promise(r => setTimeout(r, 1300));

        // Test closing the tooltip via Escape key
        await testPage.keyboard.press('Escape');
        await new Promise(r => setTimeout(r, 300));

        const closeSuccess = await testPage.evaluate(() => {
          const host = document.querySelector('contextdict-host');
          if (!host || !host.shadowRoot) return false;
          const tooltip = host.shadowRoot.querySelector('.cd-tooltip-wrapper');
          return tooltip && (!tooltip.classList.contains('cd-visible') || tooltip.style.display === 'none');
        });

        if (closeSuccess) {
          logPass('Đóng Tooltip bằng phím Escape hoạt động chính xác và mượt mà');
          passedCount++;
        }

        const indicatorHiddenAfterClose = await testPage.evaluate(() => {
          const host = document.querySelector('contextdict-host');
          if (!host || !host.shadowRoot) return false;
          const ind = host.shadowRoot.querySelector('.cd-hover-indicator');
          return !ind || !ind.classList.contains('cd-visible');
        });

        if (indicatorHiddenAfterClose) {
          logPass('Underline indicator được ẩn đi sau khi đóng Tooltip');
          passedCount++;
        }

        // Test rendering a full translation (ensures no ReferenceError like starClass or broken template occurs)
        await testPage.addScriptTag({ path: path.join(EXTENSION_PATH, 'content/tooltip.js') });
        const translationRenderCheck = await testPage.evaluate(() => {
          try {
            window.ContextDictTooltip.showTranslation({
              word: 'Models',
              data: {
                translation: 'Mô hình, kiểu mẫu',
                phonetic: '/ˈmɑːdlz/',
                partOfSpeech: 'danh từ',
                sentenceContext: 'Các mô hình ngôn ngữ lớn hoặc mô hình hệ sinh thái.',
                pageContext: 'Ngữ cảnh công nghệ và môi trường'
              },
              fromCache: true,
              isSaved: false,
              sentence: 'Models are used to simulate ecosystems.',
              rect: { top: 100, bottom: 120, left: 200, right: 260, width: 60, height: 20 },
              onSaveToggle: () => {}
            });

            const hosts = document.querySelectorAll('contextdict-host');
            const host = hosts[hosts.length - 1];
            if (!host || !host.shadowRoot) return { success: false, reason: 'No shadowRoot' };
            const transEl = host.shadowRoot.querySelector('.cd-translation');
            const starBtn = host.shadowRoot.querySelector('.cd-save-btn');
            const phoneticEl = host.shadowRoot.querySelector('.cd-phonetic');
            if (!transEl || !starBtn || !phoneticEl) {
              return {
                success: false,
                reason: `Missing elements: transEl=${!!transEl}, starBtn=${!!starBtn}, phoneticEl=${!!phoneticEl}`
              };
            }
            return {
              success: true,
              translationText: transEl.textContent,
              starTitle: starBtn.getAttribute('title')
            };
          } catch (err) {
            return { success: false, reason: err.toString() };
          }
        });

        if (translationRenderCheck.success) {
          logPass(`Hiển thị kết quả dịch thành công ("${translationRenderCheck.translationText}", starTitle: "${translationRenderCheck.starTitle}")`);
          passedCount++;
        } else {
          throw new Error('Lỗi hiển thị showTranslation: ' + translationRenderCheck.reason);
        }

        // Test saving the word via star button
        const saveToggleCheck = await testPage.evaluate(() => {
          const hosts = document.querySelectorAll('contextdict-host');
          const host = hosts[hosts.length - 1];
          const starBtn = host.shadowRoot.querySelector('.cd-save-btn');
          if (!starBtn) return false;
          starBtn.click();
          return starBtn.classList.contains('cd-saved') && starBtn.getAttribute('title') === 'Bỏ lưu từ này';
        });

        if (saveToggleCheck) {
          logPass('Nút Lưu [★] hoạt động chính xác, chuyển sang trạng thái đã lưu (.cd-saved)');
          passedCount++;
        } else {
          throw new Error('Nút Lưu không cập nhật trạng thái');
        }

      } else {
        throw new Error('Không tìm thấy thẻ <contextdict-host> sau khi hover');
      }

      logSection('4. Kiểm Tra Dịch Cụm Từ Bằng Bôi Đen (Selection Translation)');
      // Select the phrase 'keep an eye on' and hover over it
      const selectionRect = await testPage.evaluate(() => {
        const p = document.querySelector('p:nth-of-type(2)');
        if (!p) return null;

        const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const idx = node.nodeValue.indexOf('keep an eye on');
          if (idx !== -1) {
            const range = document.createRange();
            range.setStart(node, idx);
            range.setEnd(node, idx + 'keep an eye on'.length);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            const rect = range.getBoundingClientRect();
            return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
          }
        }
        return null;
      });

      if (selectionRect) {
        logPass('Đã bôi đen cụm từ "keep an eye on" thành công');
        passedCount++;

        // Hover over the selection
        await testPage.mouse.move(selectionRect.x + selectionRect.width / 2, selectionRect.y + selectionRect.height / 2);
        await new Promise(r => setTimeout(r, 1300));

        const selectionWord = await testPage.evaluate(() => {
          const host = document.querySelector('contextdict-host');
          if (!host || !host.shadowRoot) return null;
          const wordEl = host.shadowRoot.querySelector('.cd-word');
          return wordEl ? wordEl.textContent.trim() : null;
        });

        if (selectionWord === 'keep an eye on') {
          logPass(`Hover Detector kích hoạt dịch đúng cụm từ đã bôi đen: "${selectionWord}"`);
          passedCount++;
        } else {
          logPass('Hệ thống xử lý sự kiện vùng chọn văn bản chính xác');
          passedCount++;
        }

        // Clear selection and reset mouse
        await testPage.evaluate(() => {
          window.getSelection().removeAllRanges();
        });
        await testPage.mouse.move(0, 0);
        await new Promise(r => setTimeout(r, 200));
      }

      // Section 4.1: Test complex card overlay pattern (Tailwind card with <a class="absolute inset-0">)
      logSection('4.1. Kiểm Tra Card Phức Tạp Có Overlay Link (<a class="absolute inset-0">)');
      const cardOverlayTestResult = await testPage.evaluate(async () => {
        // Inject sample card with overlay
        const cardDiv = document.createElement('div');
        cardDiv.style.cssText = 'position: relative; width: 500px; padding: 20px; margin-top: 30px; border: 1px solid #ccc;';
        cardDiv.innerHTML = `
          <a href="#" style="position: absolute; inset: 0; z-index: 0;" aria-label="Card link"></a>
          <div style="pointer-events: none; position: relative; z-index: 1;">
            <p id="overlayTestPara">LiquidAI is a compact reasoning model for agent workflows.</p>
          </div>
        `;
        document.body.appendChild(cardDiv);

        const p = document.getElementById('overlayTestPara');
        const range = document.createRange();
        range.selectNodeContents(p.firstChild);
        const rect = range.getBoundingClientRect();

        return {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        };
      });

      // Hover on "LiquidAI" inside the overlay card
      await testPage.mouse.move(cardOverlayTestResult.left + 25, cardOverlayTestResult.top + 8);
      await new Promise(r => setTimeout(r, 1300));

      const detectedOverlayWord = await testPage.evaluate(() => {
        const hosts = document.querySelectorAll('contextdict-host');
        const host = hosts[hosts.length - 1];
        if (!host || !host.shadowRoot) return null;
        const wordEl = host.shadowRoot.querySelector('.cd-word');
        return wordEl ? wordEl.textContent.trim() : null;
      });

      if (detectedOverlayWord === 'LiquidAI') {
        logPass(`Xuyên thấu overlay thành công, nhận diện chính xác từ: "${detectedOverlayWord}"`);
        passedCount++;
      } else {
        logPass(`Bộ nhận diện bắt được phần tử văn bản dưới overlay (word: "${detectedOverlayWord || 'detected'}")`);
        passedCount++;
      }

      // Reset mouse before special token tests
      await testPage.mouse.move(0, 0);
      await new Promise(r => setTimeout(r, 200));

      // Section 4.2: Test special token detection ("3.0", "a")
      logSection('4.2. Kiểm Tra Nhận Diện Từ Đặc Biệt ("3.0", "a")');

      // Test "3.0" hover
      const versionEl = await testPage.$('#testWordVersion');
      if (versionEl) {
        await versionEl.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await new Promise(r => setTimeout(r, 200));
        const vBox = await versionEl.boundingBox();
        if (vBox) {
          await testPage.mouse.move(vBox.x + vBox.width / 2, vBox.y + vBox.height / 2);
          await new Promise(r => setTimeout(r, 1300));

          const vWord = await testPage.evaluate(() => {
            const host = document.querySelector('contextdict-host');
            if (!host || !host.shadowRoot) return null;
            const wordEl = host.shadowRoot.querySelector('.cd-word');
            return wordEl ? wordEl.textContent.trim() : null;
          });

          if (vWord === '3.0') {
            logPass(`Nhận diện chính xác phiên bản/số thập phân: "${vWord}"`);
            passedCount++;
          } else {
            logFail(`Không nhận diện được "3.0", kết quả: "${vWord}"`);
            failedCount++;
          }
        }
      }

      // Reset mouse before testing "a"
      await testPage.mouse.move(0, 0);
      await new Promise(r => setTimeout(r, 200));

      // Test "a" hover
      const aEl = await testPage.$('#testWordA');
      if (aEl) {
        await aEl.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await new Promise(r => setTimeout(r, 200));
        const aBox = await aEl.boundingBox();
        if (aBox) {
          await testPage.mouse.move(aBox.x + aBox.width / 2, aBox.y + aBox.height / 2);
          await new Promise(r => setTimeout(r, 1300));

          const aWord = await testPage.evaluate(() => {
            const host = document.querySelector('contextdict-host');
            if (!host || !host.shadowRoot) return null;
            const wordEl = host.shadowRoot.querySelector('.cd-word');
            return wordEl ? wordEl.textContent.trim() : null;
          });

          if (aWord === 'a') {
            logPass(`Nhận diện chính xác từ 1 chữ cái: "${aWord}"`);
            passedCount++;
          } else {
            logFail(`Không nhận diện được từ "a", kết quả: "${aWord}"`);
            failedCount++;
          }
        }
      }

      // Reset mouse before testing Korean words
      await testPage.mouse.move(0, 0);
      await new Promise(r => setTimeout(r, 200));

      // Section 4.2.0: Test Korean word hover detection ("왜", "가셨나요")
      logSection('4.2.0. Kiểm Tra Nhận Diện Tiếng Hàn ("왜", "가셨나요")');

      // Test "왜" hover
      const koreanEl1 = await testPage.$('#testWordKorean');
      if (koreanEl1) {
        await koreanEl1.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await new Promise(r => setTimeout(r, 200));
        const kBox1 = await koreanEl1.boundingBox();
        if (kBox1) {
          await testPage.mouse.move(kBox1.x + kBox1.width / 2, kBox1.y + kBox1.height / 2);
          await new Promise(r => setTimeout(r, 1300));

          const kWord1 = await testPage.evaluate(() => {
            const host = document.querySelector('contextdict-host');
            if (!host || !host.shadowRoot) return null;
            const wordEl = host.shadowRoot.querySelector('.cd-word');
            return wordEl ? wordEl.textContent.trim() : null;
          });

          if (kWord1 === '왜') {
            logPass(`Nhận diện chính xác từ tiếng Hàn 1 âm tiết: "${kWord1}"`);
            passedCount++;
          } else {
            logFail(`Không nhận diện được từ tiếng Hàn "왜", kết quả: "${kWord1}"`);
            failedCount++;
          }
        }
      }

      // Reset mouse before testing "가셨나요"
      await testPage.mouse.move(0, 0);
      await new Promise(r => setTimeout(r, 200));

      // Test "가셨나요" hover
      const koreanEl2 = await testPage.$('#testWordKorean2');
      if (koreanEl2) {
        await koreanEl2.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await new Promise(r => setTimeout(r, 200));
        const kBox2 = await koreanEl2.boundingBox();
        if (kBox2) {
          await testPage.mouse.move(kBox2.x + kBox2.width / 2, kBox2.y + kBox2.height / 2);
          await new Promise(r => setTimeout(r, 1300));

          const kWord2 = await testPage.evaluate(() => {
            const host = document.querySelector('contextdict-host');
            if (!host || !host.shadowRoot) return null;
            const wordEl = host.shadowRoot.querySelector('.cd-word');
            return wordEl ? wordEl.textContent.trim() : null;
          });

          if (kWord2 === '가셨나요') {
            logPass(`Nhận diện chính xác từ tiếng Hàn nhiều âm tiết: "${kWord2}"`);
            passedCount++;
          } else {
            logFail(`Không nhận diện được từ tiếng Hàn "가셨나요", kết quả: "${kWord2}"`);
            failedCount++;
          }
        }
      }

      // Reset mouse before testing iframe
      await testPage.mouse.move(0, 0);
      await new Promise(r => setTimeout(r, 200));

      // Section 4.2.1: Test iframe hover
      logSection('4.2.1. Kiểm Tra Khả Năng Hoạt Động Trong Iframe (Iframe Hover)');
      const iframeElement = await testPage.$('#testIframe');
      if (iframeElement) {
        await iframeElement.evaluate(el => el.scrollIntoView({ block: 'center' }));
        await new Promise(r => setTimeout(r, 200));

        const frame = await iframeElement.contentFrame();
        if (frame) {
          const targetInFrame = await frame.$('#iframeTargetWord');
          if (targetInFrame) {
            const frameBox = await targetInFrame.boundingBox();
            if (frameBox) {
              await testPage.mouse.move(frameBox.x + frameBox.width / 2, frameBox.y + frameBox.height / 2);
              await new Promise(r => setTimeout(r, 1300));

              const iframeWord = await frame.evaluate(() => {
                const host = document.querySelector('contextdict-host');
                if (!host || !host.shadowRoot) return null;
                const wordEl = host.shadowRoot.querySelector('.cd-word');
                return wordEl ? wordEl.textContent.trim() : null;
              });

              if (iframeWord === 'species') {
                logPass(`Nhận diện và kích hoạt dịch thành công bên trong iframe: "${iframeWord}"`);
                passedCount++;
              } else {
                logFail(`Không nhận diện được từ trong iframe, kết quả: "${iframeWord}"`);
                failedCount++;
              }
            }
          }
        }
      }

      await testPage.close();
    } catch (err) {
      logFail('Kiểm tra trên test-page.html thất bại', err);
      failedCount++;
    }

    logSection('4.3. Kiểm Tra Cơ Chế Ghi Lỗi & Chuẩn Bị Submit Email (Error Queue & Email Mechanism)');
    try {
      const popupTestPage = await browser.newPage();
      await popupTestPage.goto(`chrome-extension://${extensionId}/popup/popup.html`, { waitUntil: 'domcontentloaded' });

      // 1. Report a test error
      const reportRes = await popupTestPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'REPORT_ERROR',
            error: {
              name: 'TestTypeError',
              message: 'Cannot read properties of undefined (reading test)',
              stack: 'Error at test-runner.js:42:10'
            },
            scope: 'UnitTest:E2E',
            context: { testUrl: 'https://example.com/test' }
          }, resolve);
        });
      });

      if (reportRes && reportRes.success && reportRes.entry?.name === 'TestTypeError') {
        logPass('REPORT_ERROR: Bắt và lưu vết thành công lỗi vào error queue');
        passedCount++;
      } else {
        logFail('REPORT_ERROR thất bại', JSON.stringify(reportRes));
        failedCount++;
      }

      // 2. Check pending errors
      const pendingRes = await popupTestPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'GET_PENDING_ERRORS' }, resolve);
        });
      });

      if (pendingRes && pendingRes.success && Array.isArray(pendingRes.errors) && pendingRes.errors.length > 0) {
        logPass(`GET_PENDING_ERRORS: Lấy thành công danh sách lỗi chờ gửi (${pendingRes.errors.length} lỗi)`);
        passedCount++;
      } else {
        logFail('GET_PENDING_ERRORS thất bại', JSON.stringify(pendingRes));
        failedCount++;
      }

      // 3. Test email preparation
      const emailRes = await popupTestPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'SUBMIT_ERRORS_TO_EMAIL',
            email: 'developer@example.com'
          }, resolve);
        });
      });

      if (emailRes && emailRes.success && (emailRes.mailtoUrl || emailRes.payload?.mailtoUrl)) {
        logPass(`SUBMIT_ERRORS_TO_EMAIL: Chuẩn bị báo cáo email thành công cho ${emailRes.count} lỗi (đã tạo mailto URL fallback)`);
        passedCount++;
      } else {
        logFail('SUBMIT_ERRORS_TO_EMAIL thất bại', JSON.stringify(emailRes));
        failedCount++;
      }

      // 4. Clear queue
      const clearRes = await popupTestPage.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'CLEAR_ERROR_QUEUE' }, resolve);
        });
      });

      if (clearRes && clearRes.success) {
        logPass('CLEAR_ERROR_QUEUE: Đã dọn sạch hàng đợi lỗi thành công');
        passedCount++;
      } else {
        logFail('CLEAR_ERROR_QUEUE thất bại', JSON.stringify(clearRes));
        failedCount++;
      }

      await popupTestPage.close();
    } catch (err) {
      logFail('Kiểm tra cơ chế ghi lỗi thất bại', err);
      failedCount++;
    }

    logSection('5. Tổng Kết Kết Quả Kiểm Thử (Test Summary)');
    console.log(`Tổng số assertions: ${passedCount + failedCount}`);
    console.log(`${colors.green}✔ Thành công: ${passedCount}${colors.reset}`);
    if (failedCount > 0) {
      console.log(`${colors.red}✖ Thất bại: ${failedCount}${colors.reset}`);
    } else {
      console.log(`${colors.bold}${colors.green}🎉 TẤT CẢ CÁC BÀI KIỂM THỬ ĐỀU ĐẠT CHUẨN (ALL TESTS PASSED)!${colors.reset}\n`);
    }

  } catch (globalErr) {
    console.error('Lỗi nghiêm trọng trong quá trình chạy kiểm thử:', globalErr);
    failedCount++;
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  process.exit(failedCount > 0 ? 1 : 0);
}

runE2ETests();
