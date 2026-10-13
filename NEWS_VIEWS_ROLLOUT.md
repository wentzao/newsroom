# 新聞雙統計

## 顯示與計算

- 公開新聞列表及「更多資訊」不顯示數量；文章文末在分享按鈕旁顯示「N 次觀看」。獨立 `article.html` 亦相同。
- **對外瀏覽次數** = 起始值 `view_offset` + 實際開啟次數 `total_view_count`。每次成功顯示文章內文都增加，包括同一瀏覽器重新整理或再次開啟。
- **實際閱讀人數** = `view_count`，依持久保存的匿名瀏覽器 UUID 去重；同一瀏覽器不重複計數，不同裝置、無痕模式或清除網站資料可能重新計算。
- 後台桌面表格與手機卡片同時顯示「對外瀏覽」和「實際人數」。統計說明提供起始值與實際瀏覽次數的拆分。
- 依專案擁有者要求，第二版遷移時為所有既有新聞各自設定 100～200 的隨機起始值，與真實統計分開儲存。只執行一次，重啟或編輯不重新抽數字。後續新建新聞的起始值是 0。
- 第一版已累積的真實閱讀人數保留；之前沒有記錄重複開啟，因此實際開啟次數以既有閱讀人數作為已知的歷史最低值，後續逐次累積。
- GET 列表、詳情和教師預覽不增加統計。草稿、隱藏、預約發布、不存在及錯誤校區的文章不記錄。隱藏分頁等到可見才記錄。
- 瀏覽器禁止持久儲存時仍增加實際開啟次數，但不建立虛構的去重讀者。不記錄姓名、LINE 身分或 IP；讀者表僅保存文章專用匿名 UUID 雜湊與首次閱讀時間。

## API 與存取

`POST /api/news/<id>/views?campus=kindergarten` 的 JSON body：`visitorId` 是匿名瀏覽器 UUID v4 或 null，`viewId` 是本次開啟的 UUID v4。回傳公開的 `viewCount`、`viewMetricsVersion: 2` 與 `counted`（本次是否新增去重讀者）。舊版前端只傳 `visitorId` 仍相容。

列表和詳情的 `viewCount` 是對外數字。只有帶有效教師 Bearer token 的 `status=all` 列表會額外回傳 `uniqueViewCount`（實際人數）、`actualViewCount`（實際開啟次數）、`viewOffset`（起始值）。即使全域認證使用 log/off 模式，也不向未驗證讀者提供真實統計欄位。

SQLite `news_readers` 使用 `(news_id, visitor_hash)` 去重。`news_view_events` 使用 `(news_id, event_id)` 防止同一次開啟因請求重送而重複累加。資料庫交易保護並行請求，刪除文章同時清理兩張紀錄表。

## 原始碼與發布

前端：`news-views.js`、`app.js`、`article.js`、`index.css` 與兩個 HTML entry。

伺服器共享後端：`/Volumes/server/桌面/kindergarten-contactbook/routes/news_routes.py`、`schema.sql`、`test_news_views.py`、`test_news_campuses.py`。

教師端：`/Volumes/server/桌面/kindergarten-contactbook-teacher-web/src/pages/news/NewsManager.jsx`、`NewsMobileList.jsx`、`NewsViewStats.jsx`、`NewsManager.css`。

GitHub 保存後端及教師端差異：`backend/dual-news-views.patch`、`backend/teacher-dual-news-views.patch`。第一版是 `backend/news-views.patch`。共享原始碼已修改，不需再套用差異。

1. 在後端實際主機重新載入 kindergarten-contactbook Gunicorn。啟動遷移使用 SQLite Backup API 備份後，原子新增欄位、保存既有統計並建立起始值；多 worker 取得鎖後會重新檢查 schema。
2. **不要執行整份 `schema.sql`，它包含 DROP TABLE。**正式遷移只需重啟服務。
3. 檢查公開 API 的 `viewMetricsVersion: 2` 與起始數字。第二版前端在後端未就緒時隱藏統計，避免把舊版人數誤當成瀏覽次數。
4. Newsroom 推送 `master` 触發 GitHub Pages。教師端使用原始來源完成正式 build，先複製新 assets，再更新 HTML；保存原有 assets，讓尚未重整的頁面保持正常。
5. 正式站開啟新聞後確認文末數量；重整會增加對外次數。教師登入後確認實際人數不重複增加。

## 驗證

- 隔離 SQLite 測試：校區／發布規則、起始值一次性、新文章零起始值、重複開啟、去重、事件重送、公開／私人統計、無儲存空間、編輯保留、刪除清理、並行請求，以及第一版遷移與備份。
- 現有 LINE Flex 分享、校區分享連結與台灣發布時間測試通過。
- Chrome／Playwright，公開頁面 1280×900、390×844；教師列表 1440×1000、390×844。Browser plugin 不在本次技能清單，使用 Playwright。
- 公開頁面驗證列表數量移除、文末與分享對齊、重整僅增加次數、獨立文章頁與分享；教師端使用隔離登入及 API，驗證兩種統計、Bearer header、搜尋、編輯及返回列表。無執行期錯誤或整頁水平溢出。
- 專案擁有者已重新啟動後端；正式 API 確認第二版及既有新聞起始值生效，公開回應不含真實人數與起始值欄位。
