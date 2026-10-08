# LINE 新聞閱讀連結

LIFF ID：`1660786685-5GLgRIGc`。LINE Developers 的 Endpoint URL 應設為
`https://newsroom.wentzao.com/`，不要在 Endpoint 中固定某篇新聞的 `id`。

## 分享指定新聞

```text
https://liff.line.me/1660786685-5GLgRIGc?id=新聞ID&campus=kindergarten
https://liff.line.me/1660786685-5GLgRIGc?id=新聞ID&campus=afterschool
```

- `id` 是 API 的 `id`（例如 `news-20261005-002`），不是標題或公告編號。
- `campus=kindergarten`：幼兒；`campus=afterschool`：安親。
- 省略 `campus` 時，依文章的顯示校區選擇；雙校區文章預設幼兒。
- 未帶 `id` 時顯示該校區的新聞列表。
- 必須已發布、到達公開時間、符合指定校區，文章才可讀取。
- 一般「分享」依 SDK 的 `liff.isInClient()` 判斷：LIFF 瀏覽器分享 LIFF 連結；Chrome、Safari 或 LINE 的一般內建瀏覽器分享 newsroom 網頁連結。不能只靠網址含 `liff.state` 或 LINE User-Agent 判斷。
- LINE Flex Message 的圖片、「查看公告」按鈕固定使用 LIFF 連結。
- 教師編輯器的「分享連結」區可分別複製網頁與 LIFF 連結；雙校區文章可選擇連結要開啟的校區。連結依已儲存／發布的版本產生，不會把未發布的校區修改套用到公開版本。
- 直接分享 `https://newsroom.wentzao.com/?id=...` 仍能閱讀，但不保證使用 LIFF 瀏覽器。

## 初始化與閱讀

LINE 會將 query 暫存在 `liff.state`，程式支援 `?id=...`、`/?id=...`
與包含頁面路徑的 state。初始化完成後才建立消息列表／文章的返回紀錄，避免打斷
LINE 的重導向。外部瀏覽器的 LIFF 重導向也會初始化，但不強制 LINE 登入。
一般直接造訪 newsroom 不載入 SDK，不顯示「透過 LINE 分享」。

指定文章會直接開啟現有的簡潔閱讀畫面，列表在背景載入，不必先等完整列表。
左側右滑或「回到消息主頁」可返回列表，官網按鈕沿用文章進入時的校區。

## LINE 後台設定與限制

- 畫面大小建議 `Full`，方便閱讀長篇文章；這是 LINE Developers 的設定，不是 query。
- 啟用 Share target picker 才能使用「透過 LINE 分享」傳送 Flex Message。
- LIFF 閱讀不是零次重導向：LINE 仍有必要的初始化轉址，但不另外轉去官網或外部閱讀頁。
- 首次使用可能出現 LINE 授權畫面。OS、LINE 版本與點擊來源仍會影響開啟的瀏覽器。
- 不在新聞網址加入 `openExternalBrowser=1`，否則與 LINE 內閱讀的目標相反。

官方說明：
- https://developers.line.biz/en/docs/liff/opening-liff-app/
- https://developers.line.biz/en/reference/liff/#init

驗證時只讀取公開 API，使用隔離 SDK 測試分享內容；不送出 LINE 訊息或建立真實新聞。

## LINE 分享卡片

採用原始大封面版型：20:13 圖片填滿封面區域（`cover`）。下方第一列顯示
公告類型（靠左）與公開日期（靠右），接著顯示靠左的大標題。日期使用
`publishAt`，以台灣時區格式化，不使用建立或最後編輯時間；缺少有效日期時省略。

底部「查看公告」按鈕縮為 104px 寬、靠右，使用主色綠 `#02A568`。
卡片不另外顯示校區標籤，但圖片與按鈕的 LIFF 連結仍保留目前閱讀的校區，
包含雙校區新聞。

標題使用 `20px` 與整列寬度；更長的標題保留換行與
`shrink-to-fit`，不限制兩行。實際縮字與 LINE 字級設定的效果由 LINE 用戶端決定。
一般網頁分享與新聞列表版型不受影響。

執行 `node --test tests/line-flex.test.cjs` 可檢查核定 JSON 與分享流程。
