# 新聞閱讀人數

## 統計規則

- 公開網站的列表、內文與更多資訊顯示「N 人看過」。
- 每篇文章成功顯示內文後記錄，同一個瀏覽器的匿名 UUID 只計一次，跨校區共用統計。
- 不同裝置、不同瀏覽器、無痕模式或清除網站資料可能重新計算，因此這是瀏覽器閱讀人數，無法確認真實個人身份。
- 不記錄姓名、LINE 身分或 IP；資料庫只存文章專用的 UUID 雜湊與首次閱讀時間。
- 隱藏分頁等到可見才記錄；禁止持久儲存的瀏覽器不記錄，以免每次重整都增加。
- 未發布、預約發布、錯誤校區、不存在的文章不記錄。GET 詳情／列表不增加計數，也不將家長 App 或教師預覽納入。
- 自啟用起從 0 累積，沒有過往人數可回補。匿名公開統計無法防止刻意產生新瀏覽器身分的灌票。

## 程式與資料

前端共用模組：`news-views.js`。公開 API：`POST /api/news/<id>/views?campus=kindergarten`，JSON body 為 `{"visitorId":"<UUID v4>"}`，回傳 `id`、`viewCount`、`counted`。

列表與詳情 API 新增 `viewCount`。SQLite `news.view_count` 保存累計數；`news_readers` 用 `(news_id, visitor_hash)` 唯一鍵去重。交易讓同時請求不重複累加，修改文章不覆寫統計，刪除文章清理閱讀紀錄。

後端修改已寫入伺服器共享資料夾：

- `/Volumes/server/桌面/kindergarten-contactbook/routes/news_routes.py`
- `/Volumes/server/桌面/kindergarten-contactbook/schema.sql`
- `/Volumes/server/桌面/kindergarten-contactbook/test_news_views.py`

GitHub 留存完整修改差異：`backend/news-views.patch`，供其他後端 checkout 套用；共享資料夾已套用，不需再套一次。原始程式與 schema 各有 `.backup-before-news-views-20261013` 備份。

## 發布與驗證

1. 在後端實際主機重新載入現有 kindergarten-contactbook API Gunicorn 服務。
2. 啟動時 `_migrate()` 會先用 SQLite Backup API 備份資料庫，再新增欄位及資料表；可重跑，既有新聞內容保持。**不要執行整份 `schema.sql`，它包含 DROP TABLE。**
3. 查詢 `https://kcb.wentzao.com/api/news/?limit=1`，確認回傳 `viewCount`，既有文章初值為 0。
4. 前端推送 `master` 觸發 GitHub Pages。可先發布前端：後端尚未就緒時隱藏統計並跳過 POST，避免顯示假數字。
5. 開啟文章，確認計數增加；重整維持原數字，另一個瀏覽器首次開啟增加 1。這一步會產生真實閱讀紀錄。

隔離後端測試（只操作臨時資料庫）：在後端目錄執行 `python3 test_news_views.py`。含現有校區測試，以及新增去重、多人、校區共用、不可見文章、錯誤輸入、編輯保存、刪除清理、並行請求、遷移備份測試。

前端驗證環境：本機 `http://127.0.0.1:5500`、隔離 Flask API；Chrome 1280×900 和 390×844。Browser plugin 不在本次技能清單，使用 Playwright。驗證列表不計數、開啟計數、重整去重、獨立文章頁、跨校區去重、返回、統計服務失敗仍可閱讀與無水平溢出。

目前部署限制：SSH `wentzao@192.168.50.53` 未有可用登入，後端重新載入必須由具伺服器存取權的操作方式完成；前端發布不代表後端已啟用。
