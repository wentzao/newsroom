# 文藻幼兒園最新消息網頁 - 技術架構文檔

> **專案目標**: 打造流暢的單頁應用 (SPA) 體驗，實現無抖動的頁面切換、高效的記憶體管理和統一的滾動行為。

---

## 📋 目錄

1. [核心設計理念](#核心設計理念)
2. [技術架構總覽](#技術架構總覽)
3. [滾動架構設計](#滾動架構設計)
4. [無抖動切換實現](#無抖動切換實現)
5. [記憶體優化策略](#記憶體優化策略)
6. [頁面切換動畫](#頁面切換動畫)
7. [導航系統](#導航系統)
8. [檔案結構](#檔案結構)
9. [關鍵代碼片段](#關鍵代碼片段)
10. [最佳實踐建議](#最佳實踐建議)

---

## 🎯 核心設計理念

### 單一滾動容器原則
- **所有滾動都在 `<body>` 元素上進行**
- 避免多重滾動容器導致的滾動條不一致
- 確保 header 在任何狀態下都保持固定

### 視覺一致性
- Header 永遠可見且位置固定
- 滾動條行為一致（主頁顯示，overlay 隱藏）
- 頁面切換無視覺跳動

### 性能優先
- 記憶體高效管理（清空舊 overlay 內容）
- 圖片延遲載入
- CSS 硬體加速動畫

---

## 🏗️ 技術架構總覽

```
┌─────────────────────────────────────┐
│          <html>                      │
│  ┌─────────────────────────────────┐│
│  │        <body>                    ││
│  │  (唯一滾動容器)                  ││
│  │                                  ││
│  │  ┌──────────────────────────┐   ││
│  │  │   .site-header           │   ││
│  │  │   position: fixed        │   ││
│  │  │   z-index: 1000          │   ││
│  │  └──────────────────────────┘   ││
│  │                                  ││
│  │  ┌──────────────────────────┐   ││
│  │  │   .main-content          │   ││
│  │  │   padding-top: 60px      │   ││
│  │  │   (主頁內容)             │   ││
│  │  └──────────────────────────┘   ││
│  │                                  ││
│  │  ┌──────────────────────────┐   ││
│  │  │   .article-overlay       │   ││
│  │  │   position: absolute     │   ││
│  │  │   z-index: 900           │   ││
│  │  │   min-height: 100%       │   ││
│  │  │   (文章詳情頁)           │   ││
│  │  └──────────────────────────┘   ││
│  │                                  ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### 關鍵層級 (z-index)
- **Site Header**: 1000（最上層，永遠可見）
- **Article Overlay**: 900（在 header 下方）
- **Main Content**: 預設（最底層）

---

## 📜 滾動架構設計

### 問題背景

**傳統方案的問題**：
- ❌ 每個 overlay 有獨立滾動條 (`overflow-y: auto`)
- ❌ Header 從 sticky 變成 absolute，行為不一致
- ❌ 主頁有滾動條，詳情頁沒有 → 視覺抖動

### 解決方案：統一滾動容器

#### 1. HTML 滾動設定

```css
html {
    overflow-x: hidden;       /* 禁止橫向滾動 */
    overflow-y: scroll;       /* 永遠保留滾動區域 */
}
```

#### 2. Body 作為唯一滾動容器

```css
body {
    /* Body 是唯一可滾動的容器 */
    min-height: 100vh;        /* 確保至少有視窗高度 */
    overflow-x: hidden;       /* 禁止橫向滾動 */
}
```

#### 3. Overlay 使用 Absolute 定位

```css
.article-overlay {
    position: absolute;       /* 🔑 關鍵：隨 body 滾動 */
    top: 0;
    left: 0;
    width: 100%;
    min-height: 100%;         /* 覆蓋整個 body 高度 */
    z-index: 900;
    
    /* ❌ 不使用 overflow-y: auto */
    /* ✅ 讓 body 處理所有滾動 */
}
```

**為什麼是 `absolute` 而非 `fixed`？**

| 屬性 | 行為 | 結果 |
|------|------|------|
| `fixed` | 固定在視窗，不隨頁面滾動 | ❌ overlay 內容無法滾動 |
| `absolute` | 相對於 body 定位，隨 body 滾動 | ✅ overlay 內容可滾動 |

#### 4. Header 永久固定

```css
.site-header {
    position: fixed;          /* 🔑 固定在視窗頂部 */
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;           /* 在所有內容之上 */
}
```

**為什麼從 `sticky` 改為 `fixed`？**

- `sticky`: 在滾動容器內才有效，overlay 切換時會失效
- `fixed`: 永遠固定，不受滾動容器影響

---

## 🚫 無抖動切換實現

### 問題 1：滾動條出現/消失導致頁面寬度變化

**原因**：Windows/Chrome 瀏覽器的滾動條預設佔用空間（~14px）

**解決方案**：條件式隱藏滾動條

```css
/* 主頁：顯示滾動條（正常 UX） */
body {
    /* 正常滾動條 */
}

/* Overlay 時：隱藏滾動條 */
body.overlay-open {
    scrollbar-width: none;              /* Firefox */
    -ms-overflow-style: none;           /* IE/Edge */
}

body.overlay-open::-webkit-scrollbar {
    display: none;                      /* Chrome/Safari */
}
```

**運作流程**：

```
用戶點擊文章
    ↓
openArticleOverlay() 被調用
    ↓
lockBodyScroll() 添加 .overlay-open 類
    ↓
CSS 規則生效 → 滾動條隱藏
    ↓
overlay 從右側滑入（無抖動！）
```

### 問題 2：主頁內容透過 overlay 底部露出

**原因**：
- 主頁可能很長（很多文章）
- Overlay 文章較短
- `min-height: 100vh` 只覆蓋視窗高度，不是整個 body

**解決方案 A**：使用 `min-height: 100%`

```css
.article-overlay {
    min-height: 100%;    /* 🔑 覆蓋整個 body 高度，不只視窗 */
}
```

**解決方案 B**：隱藏主頁內容

```javascript
// 打開 overlay 時
const mainContent = document.querySelector('.main-content');
if (mainContent) mainContent.style.display = 'none';

// 關閉 overlay 時
if (mainContent) mainContent.style.display = '';
```

### 問題 3：多層 overlay 疊加露出問題

**解決方案**：清空舊 overlay 內容（同時解決記憶體問題）

```javascript
// 打開新 overlay 時
const allOverlays = document.querySelectorAll('.article-overlay');
allOverlays.forEach(otherOverlay => {
    if (otherOverlay !== overlay) {
        otherOverlay.innerHTML = '';  // 清空舊內容
    }
});
```

---

## 🧠 記憶體優化策略

### 問題：堆疊式 Overlay 記憶體累積

```
用戶操作: 主頁 → 文章A → 更多資訊B → 更多資訊C

傳統做法 (❌):
<body>
  <div class="article-overlay" data-id="A">
    [完整 HTML 內容 ~500KB]  ← 被隱藏但仍佔記憶體
  </div>
  <div class="article-overlay" data-id="B">
    [完整 HTML 內容 ~500KB]  ← 被隱藏但仍佔記憶體
  </div>
  <div class="article-overlay" data-id="C">
    [完整 HTML 內容 ~500KB]  ← 當前顯示
  </div>
</body>

總記憶體: ~1.5MB (3 層累積)
```

### 優化方案：清空舊內容

```javascript
function openArticleOverlay(articleId) {
    // ... 創建新 overlay ...
    
    // 清空所有舊 overlay 的內容
    const allOverlays = document.querySelectorAll('.article-overlay');
    allOverlays.forEach(otherOverlay => {
        if (otherOverlay !== overlay) {
            otherOverlay.innerHTML = '';  // ✅ 釋放記憶體
            // 保留空元素用於堆疊計數
        }
    });
}
```

**效果**：

```
優化後 (✅):
<body>
  <div class="article-overlay" data-id="A"></div>  ← 空元素 ~0KB
  <div class="article-overlay" data-id="B"></div>  ← 空元素 ~0KB
  <div class="article-overlay" data-id="C">
    [完整 HTML 內容 ~500KB]  ← 只有當前 overlay
  </div>
</body>

總記憶體: ~500KB (節省 66% 記憶體！)
```

### 額外優化：圖片延遲載入

```javascript
// 在 buildArticleHtml() 中
img.loading = "lazy";  // 瀏覽器原生延遲載入
```

---

## 🎬 頁面切換動畫

### 設計目標

- 現代感的滑動效果
- 流暢的過渡
- 無橫向滾動條閃現

### CSS 實現

```css
.article-overlay {
    /* 初始狀態：在螢幕右側外 */
    opacity: 0;
    visibility: hidden;
    transform: translateX(100%);
    
    /* 過渡動畫：350ms，Material Design 緩動曲線 */
    transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                visibility 0.35s cubic-bezier(0.4, 0, 0.2, 1),
                transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.article-overlay.active {
    /* 激活狀態：滑入正常位置 */
    opacity: 1;
    visibility: visible;
    transform: translateX(0);
}
```

### JavaScript 觸發

```javascript
// 1. 創建 overlay（初始在右側外）
overlay.classList.add('article-overlay');

// 2. 添加到 DOM
document.body.appendChild(overlay);

// 3. 下一幀觸發動畫
requestAnimationFrame(() => {
    overlay.classList.add('active');  // ✨ 滑入！
    window.scrollTo(0, 0);            // 瞬間到頂
});
```

### 防止橫向滾動條

**問題**：`translateX(100%)` 會讓元素暫時超出視窗寬度

**解決**：

```css
html {
    overflow-x: hidden;  /* 🔑 隱藏橫向滾動條 */
}

body {
    width: 100vw;        /* 限制寬度 */
    overflow-x: hidden;  /* 雙重保險 */
}
```

### Overlay 開啟時 Header 變深

```css
/* 主頁：淺色毛玻璃 */
.site-header {
    background-color: rgba(255, 255, 255, 0.82);
    backdrop-filter: saturate(180%) blur(20px);
    transition: background-color 0.3s ease;
}

/* Overlay 時：稍深色，增強層次感 */
body.overlay-open .site-header {
    background-color: rgba(245, 245, 245, 0.92);
}
```

---

## 🧭 導航系統

### 三種返回主頁方式

#### 1. 瀏覽器後退按鈕

```javascript
window.addEventListener('popstate', (event) => {
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('id');
    
    if (!targetId) {
        // URL 沒有 id，應該在主頁
        closeAllOverlaysDOM();
    } else {
        // 調整 overlay 堆疊以匹配 URL
        adjustOverlayStack(targetId);
    }
});
```

#### 2. 點擊 Site Header

```javascript
document.querySelector('.site-header').addEventListener('click', () => {
    const overlays = document.querySelectorAll('.article-overlay');
    if (overlays.length > 0) {
        closeAllOverlays();  // 關閉所有 overlay，返回主頁頂部
    }
});
```

**設計理念**：
- 符合業界標準（Google、Amazon、Twitter 都這樣）
- 點擊 Logo/Header = 「重新開始」= 回到頂部
- 提供明確的「快速返回」途徑

#### 3. "回到消息主頁"按鈕

```html
<!-- 在每個 overlay 底部 -->
<div class="back-to-home-container">
    <button class="back-to-home-btn" onclick="closeAllOverlays()">
        回到消息主頁
    </button>
</div>
```

### URL 與狀態同步

```javascript
// 打開 overlay
function openArticleOverlay(articleId) {
    // 更新 URL
    const url = new URL(window.location);
    url.searchParams.set('id', articleId);
    window.history.pushState({ articleId }, '', url);
    
    // ... 創建 overlay UI ...
}

// 關閉所有 overlay
function closeAllOverlays() {
    // 移除所有 overlay
    // ...
    
    // 清除 URL 參數
    const url = new URL(window.location);
    url.searchParams.delete('id');
    window.history.pushState({}, '', url);
}
```

---

## 📁 檔案結構

```
newsroom/
│
├── index.html              # 主頁 HTML 結構
├── index.css              # 主樣式表（變數、通用樣式、主頁）
├── article.css            # 文章詳情頁樣式
├── article-more.css       # "更多資訊"區塊樣式
├── bookmark.css           # 書籤/標籤樣式
├── app.js                 # 主邏輯（SPA、API、導航）
│
├── ARCHITECTURE.md        # 本文檔（技術架構）
└── README.md              # 專案說明（可選）
```

### 樣式層級

1. **index.css**: CSS 變數、基礎樣式、滾動條、Header、主頁佈局
2. **article.css**: 文章內容區塊（標題、圖片、段落、引用）
3. **article-more.css**: "更多資訊"列表樣式
4. **bookmark.css**: 標籤和書籤元件

### JavaScript 模組劃分

```javascript
// app.js 結構

// ===== API 交互 =====
async function fetchNews() { ... }
async function fetchArticle(id) { ... }

// ===== HTML 構建 =====
function buildArticleHtml(article) { ... }
function renderMoreNews(moreNews) { ... }

// ===== Overlay 管理 =====
function openArticleOverlay(articleId) { ... }
function closeArticleOverlay(overlay) { ... }
function closeAllOverlays() { ... }

// ===== 滾動管理 =====
function lockBodyScroll() { ... }
function unlockBodyScroll() { ... }

// ===== 導航與歷史 =====
window.addEventListener('popstate', ...) { ... }

// ===== 主頁邏輯 =====
function loadMainPage() { ... }
```

---

## 💻 關鍵代碼片段

### 1. 打開 Overlay（完整流程）

```javascript
async function openArticleOverlay(articleId) {
    // 1. 創建 overlay 元素
    const overlay = document.createElement('div');
    overlay.classList.add('article-overlay');
    overlay.dataset.id = articleId;
    overlay.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
    
    // 2. 添加到 DOM（初始不可見）
    document.body.appendChild(overlay);
    
    // 3. 下一幀觸發動畫和清理
    requestAnimationFrame(() => {
        overlay.classList.add('active');
        window.scrollTo(0, 0);  // 瞬間到頂
        
        // 隱藏主頁內容
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.style.display = 'none';
        
        // 清空舊 overlay 內容（記憶體優化）
        const allOverlays = document.querySelectorAll('.article-overlay');
        allOverlays.forEach(other => {
            if (other !== overlay) other.innerHTML = '';
        });
    });
    
    // 4. 標記 body 狀態（觸發 CSS）
    lockBodyScroll();  // 添加 .overlay-open 類
    
    // 5. 從 API 載入內容
    try {
        const article = await fetchArticle(articleId);
        overlay.innerHTML = buildArticleHtml(article);
        
        // 渲染"更多資訊"
        if (article.moreNews?.length > 0) {
            renderMoreNews(article.moreNews, overlay);
        }
    } catch (error) {
        overlay.innerHTML = '<div class="error">載入失敗</div>';
    }
    
    // 6. 更新 URL
    const url = new URL(window.location);
    url.searchParams.set('id', articleId);
    window.history.pushState({ articleId }, '', url);
}
```

### 2. 關閉所有 Overlay

```javascript
function closeAllOverlays() {
    const overlays = document.querySelectorAll('.article-overlay');
    
    // 觸發關閉動畫
    overlays.forEach(overlay => {
        overlay.classList.remove('active');
    });
    
    // 等待動畫完成後移除
    setTimeout(() => {
        overlays.forEach(overlay => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        });
        
        // 恢復主頁
        unlockBodyScroll();
        
        // 清除 URL 參數
        const url = new URL(window.location);
        url.searchParams.delete('id');
        window.history.pushState({}, '', url);
    }, 400);  // 匹配 CSS transition 時間
}
```

### 3. 滾動管理（簡化版）

```javascript
function lockBodyScroll() {
    // 只需添加類名，CSS 處理其餘
    document.body.classList.add('overlay-open');
}

function unlockBodyScroll() {
    // 移除類名，恢復主頁
    document.body.classList.remove('overlay-open');
    
    // 恢復主頁內容顯示
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.style.display = '';
}
```

### 4. 後退按鈕處理

```javascript
window.addEventListener('popstate', (event) => {
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('id');
    const allOverlays = Array.from(document.querySelectorAll('.article-overlay'));
    
    if (!targetId) {
        // URL 要求主頁，關閉所有 overlay
        closeAllOverlaysDOM();
        return;
    }
    
    // 檢查目標 overlay 是否已在堆疊中
    const targetIndex = allOverlays.findIndex(o => o.dataset.id === targetId);
    
    if (targetIndex !== -1) {
        // 目標在堆疊中，關閉它上面的所有層
        const overlaysToClose = allOverlays.slice(targetIndex + 1);
        overlaysToClose.forEach(o => closeOverlayDOM(o));
    }
    // 如果不在堆疊中，用戶可能使用了前進按鈕，不處理
});
```

---

## ✨ 最佳實踐建議

### 1. CSS 架構

#### ✅ 使用 CSS 變數
```css
:root {
    --color-primary: #007AFF;
    --spacing-md: 1rem;
    --transition-fast: 150ms ease;
}
```

**優點**：
- 集中管理設計 tokens
- 易於主題切換
- 提高可維護性

#### ✅ 語意化命名
```css
.article-overlay        /* ✅ 描述用途 */
.btn-primary           /* ✅ 描述功能 */

.blue-box              /* ❌ 描述樣式 */
.div-container-1       /* ❌ 無語意 */
```

### 2. JavaScript 架構

#### ✅ 單一職責函數
```javascript
// ✅ 每個函數只做一件事
function openArticleOverlay(id) { ... }
function closeArticleOverlay(overlay) { ... }
function fetchArticle(id) { ... }

// ❌ 避免巨型函數
function doEverything() {
    // 1000 行代碼...
}
```

#### ✅ 使用 async/await
```javascript
// ✅ 清晰的異步流程
async function loadArticle(id) {
    const article = await fetchArticle(id);
    renderArticle(article);
}

// ❌ 回調地獄
fetchArticle(id, (article) => {
    renderArticle(article, () => {
        // 更多嵌套...
    });
});
```

### 3. 性能優化

#### ✅ 使用 CSS Transform（硬體加速）
```css
/* ✅ 使用 transform，GPU 加速 */
.overlay {
    transform: translateX(100%);
}

/* ❌ 使用 left，主線程重排 */
.overlay {
    left: 100%;
}
```

#### ✅ 圖片延遲載入
```javascript
img.loading = "lazy";  // 瀏覽器原生支援
```

#### ✅ 避免記憶體洩漏
```javascript
// ✅ 移除 DOM 時釋放記憶體
overlay.innerHTML = '';
overlay.remove();

// ❌ 只隱藏，記憶體仍佔用
overlay.style.display = 'none';
```

### 4. UX 設計

#### ✅ 視覺反饋
```css
button:hover {
    background: darker-color;
    transform: scale(1.02);
}
```

#### ✅ 載入狀態
```html
<div class="loading">
    <div class="loading-spinner"></div>
</div>
```

#### ✅ 錯誤處理
```javascript
try {
    const data = await fetchAPI();
} catch (error) {
    showErrorMessage('載入失敗，請重試');
}
```

### 5. 可訪問性

#### ✅ 語義化 HTML
```html
<header>, <main>, <article>, <section>
```

#### ✅ 鍵盤導航
```css
button:focus {
    outline: 2px solid blue;
}
```

#### ✅ ARIA 標籤（如需要）
```html
<button aria-label="關閉文章">×</button>
```

---

## 🔍 調試技巧

### 檢查記憶體使用

1. 打開 Chrome DevTools → Memory
2. 點擊 "Take heap snapshot"
3. 打開/關閉多個 overlay
4. 再次拍攝 snapshot
5. 比較兩次記憶體差異

**預期結果**：記憶體應該穩定，不持續增長

### 檢查滾動行為

```javascript
// 在 console 執行
document.querySelectorAll('*').forEach(el => {
    const style = window.getComputedStyle(el);
    if (style.overflow === 'auto' || style.overflow === 'scroll') {
        console.log('Scrollable element:', el);
    }
});
```

**預期結果**：只有 `<body>` 應該可滾動

### 檢查 Overlay 堆疊

```javascript
// 在 console 執行
window.getOverlayCount = () => {
    return document.querySelectorAll('.article-overlay').length;
};

window.getOverlayCount();  // 顯示當前 overlay 數量
```

---

## 📚 延伸閱讀

### 相關技術文檔
- [CSS Position 屬性](https://developer.mozilla.org/en-US/docs/Web/CSS/position)
- [CSS Transform 性能](https://web.dev/animations-guide/)
- [瀏覽器滾動行為](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow)

### 設計參考
- [Material Design - Motion](https://material.io/design/motion/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)

### 性能優化
- [Web Vitals](https://web.dev/vitals/)
- [JavaScript 記憶體管理](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)

---

## 📝 變更日誌

### 2026-01-28 - 初始版本
- ✅ 實現統一滾動容器架構
- ✅ 無抖動頁面切換
- ✅ 記憶體優化策略
- ✅ 滑動動畫效果
- ✅ 完整導航系統

---

## 👥 貢獻者

**開發**: 文藻幼兒園技術團隊  
**文檔**: 2026 年 1 月

---

**© 2026 文藻幼兒園 - 保留所有權利**
