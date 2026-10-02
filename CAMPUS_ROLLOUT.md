# 校區消息發布

## 顯示規則

- `targetCampuses: ["kindergarten"]`：幼兒校區。
- `targetCampuses: ["afterschool"]`：安親校區。
- `targetCampuses: ["kindergarten", "afterschool"]`：兩邊顯示。
- 既有資料與未提供校區的新資料預設為幼兒校區；空陣列及未知校區會被 API 拒絕。
- 已發布消息另存草稿時，新的校區設定保存在 `pendingDraft`，正式版本維持原校區，直到老師發布修改。
- 未指定校區的公開列表維持幼兒校區，保護現有幼兒園 App；管理端 `status=all` 可查看全部校區。
- 現有後端只連接幼兒園 App 推播訂閱，安親專用新聞不會通知幼兒園家長；本次未新增安親 App 推播整合。

## 已修改的源頭檔案

伺服器共享資料夾：

- `/Volumes/server/桌面/kindergarten-contactbook/routes/news_routes.py`
- `/Volumes/server/桌面/kindergarten-contactbook/schema.sql`
- `/Volumes/server/桌面/kindergarten-contactbook/test_news_campuses.py`
- `/Volumes/server/桌面/kindergarten-contactbook-teacher-web/src/pages/news/NewsManager.jsx`

Newsroom：`campus.js`、`app.js`、`article.js`、`index.html`、`article.html`、`index.css`。

## 上線順序

1. 在後端實際執行主機重新載入 Gunicorn 服務。啟動時的 `_migrate()` 會先以 SQLite Backup API 備份目前的資料庫，再新增 `news.target_campuses` 欄位。欄位的非空預設值讓所有既有新聞歸屬幼兒校區。重跑不會覆寫新的校區設定。
2. **不可執行整份 `schema.sql`**：它是初始化 schema，含 DROP TABLE；本次正式資料遷移只需重新載入後端，讓 `_migrate()` 執行。
3. 驗證正式 API 已回傳 `targetCampuses`。在只有既有幼兒新聞的情況下，安親查詢應回傳空列表，幼兒查詢應維持原有新聞。兩個查詢的 `total` 和 `hasMore` 都在校區篩選後計算。
4. 編譯並發布老師端：在 `kindergarten-contactbook-teacher-web` 執行 `npm run build`，依原本的靜態網站部署方式更新 `dist`。本次已在隔離的本機複本成功編譯，產物已備於 `kindergarten-contactbook-teacher-web/dist-campus-20261002`；正式 `dist` 尚未替換，以免舊後端忽略新欄位。
5. 推送 newsroom `master`，等待 GitHub Pages 更新。Newsroom 對尚未新增 `targetCampuses` 的 API 相容，會把舊新聞視為幼兒校區，因此可先發布前端；後端更新前安親列表維持空白。
6. 在測試草稿中勾選兩個校區、保存並重新開啟，確認設定保留；發布真實文章需使用實際內容，不要為驗證發出測試公告或家長推播。

正式 API 檢查：

```sh
curl -fsS 'https://kcb.wentzao.com/api/news/?campus=kindergarten&limit=50'
curl -fsS 'https://kcb.wentzao.com/api/news/?campus=afterschool&limit=50'
```

Newsroom 校區網址：

- 幼兒：`https://newsroom.wentzao.com/?campus=kindergarten`
- 安親：`https://newsroom.wentzao.com/?campus=afterschool`
- 文章網址和 LINE LIFF 分享網址均帶 `campus` 與 `id`；原本只帶 `id` 的連結會依文章校區選擇適合的列表。
- 安親官網使用 `https://www.wentzao.com/rainbow/`；幼兒官網使用 `https://www.wentzao.com/kindergarten/`。左上角 Home 與文章底部官網按鈕共用目前校區的設定；雙校區文章保留讀者進入時選擇的校區。

## 驗證紀錄（2026-10-02）

- 7 項隔離 SQLite / Flask API 測試通過：migration 與備份、舊資料預設、兩邊顯示與分頁、待發布草稿、局部更新、非法校區、詳細頁校區篩選及避免錯誤推播。
- JavaScript 語法及 git diff 格式檢查通過。
- 老師端 production build 通過（既有 bundle 大小與 dynamic import 警告仍存在）。
- 本機 Playwright 使用現有 Chrome，newsroom 1280×900 與 390×844 驗證校區切換、快速切換回應順序、舊新聞、共用文章、分享網址、返回與舊版文章頁；API 回應使用測試資料，未發布真實新聞或傳送 LINE 訊息。
- 老師端使用隔離的登入/API 測試介面驗證複選、草稿保存與重開、空校區拒絕，以及安親發布不觸發幼兒推播。
- Newsroom 前端已發布；正式網站 390×844 手機驗證通過：幼兒新聞保持原樣，安親列表在後端更新前為空，校區切換、頁面名稱與官網連結正常。
- 老師端原始碼已保存於本機 Git commit `ae08d4d`；GitHub 遠端 master 已與此伺服器 checkout 分岔，未強制推送或覆蓋遠端。
- 正式資料庫遷移與端到端正式站驗證仍待伺服器重新載入。SSH BatchMode 至 `wentzao@192.168.50.53` 目前沒有可用金鑰；後端 `.env` 設定 `GUNICORN_RELOAD=false`。
