# LINE 分享箭頭

`caret-right-bold.svg` 取自 [Phosphor Icons](https://github.com/phosphor-icons/core/blob/main/assets/bold/caret-right-bold.svg)，
僅將 `currentColor` 替換為文藻主色 `#02A568`。原始 MIT 授權見 `PHOSPHOR-LICENSE.txt`。

LINE Flex Image 使用 PNG/JPEG，因此 SVG 以 Sharp 轉成透明 72×72 PNG，
輸出至 `assets/line-chevron-right.png`，在卡片以 24px 顯示（3 倍密度）。

有 Sharp 的環境可由專案根目錄重新產生：

```js
require('sharp')('assets/icons/caret-right-bold.svg')
  .resize(72, 72)
  .png()
  .toFile('assets/line-chevron-right.png');
```
