const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = ['campus.js', 'app.js'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
// The user's borderless, two-row layout; compare the entire layout.
const approvedBubble = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/line-flex-bubble.json'), 'utf8'));
const sample = {
    id: 'news-20261007-001',
    title: '👑單字王競賽',
    tag: '課務提醒',
    coverImage: approvedBubble.hero.url,
    targetCampuses: ['afterschool']
};

function createApp({ campus = 'afterschool', inClient = true, pickerResult = { status: 'success' } } = {}) {
    const calls = { init: [], picker: [], system: [] };
    const status = { textContent: '' };
    const attrs = new Map();
    let removed = false;
    const button = {
        setAttribute: (name, value) => attrs.set(name, value),
        removeAttribute: name => attrs.delete(name),
        closest: () => ({ querySelector: () => status }),
        remove: () => { removed = true; },
        addEventListener() {}
    };
    const overlay = { querySelectorAll: () => [button] };
    const location = new URL(`https://newsroom.wentzao.com/?campus=${campus}`);
    const liff = {
        isInClient: () => inClient,
        init: async options => { calls.init.push(options); },
        isApiAvailable: api => api === 'shareTargetPicker',
        shareTargetPicker: async messages => { calls.picker.push(messages); return pickerResult; }
    };
    const context = vm.createContext({
        URL, URLSearchParams, console,
        window: { location, liff, addEventListener() {} },
        navigator: { userAgent: 'Test browser', share: async data => { calls.system.push(data); } },
        document: {
            querySelector: selector => selector === 'meta[name="liff-id"]'
                ? { content: '1660786685-5GLgRIGc' }
                : { addEventListener() {} },
            addEventListener() {}
        },
        IntersectionObserver: class { observe() {} unobserve() {} },
        article: sample,
        overlay, button
    });
    vm.runInContext(source, context);
    return {
        calls, status, attrs,
        get removed() { return removed; },
        run: code => vm.runInContext(code, context),
        build: article => {
            context.article = article;
            return JSON.parse(JSON.stringify(vm.runInContext('buildLineFlexMessage(article)', context)));
        }
    };
}

function titleText(bubble) {
    return bubble.body.contents[0];
}

function detailCells(bubble) {
    return bubble.body.contents[1].contents.map(column => column.contents[0]);
}

test('matches the complete approved borderless JSON', () => {
    const message = createApp().build(sample);
    assert.equal(message.type, 'flex');
    assert.equal(message.altText, '課務提醒｜👑單字王競賽');
    assert.deepEqual(message.contents, approvedBubble);
    assert.doesNotMatch(JSON.stringify(message), /"border(Color|Width)"/);
    assert.equal(message.contents.footer, undefined);
});

test('uses article data and the selected campus for dual-campus news', () => {
    const article = {
        ...sample,
        id: 'news-20261005-002',
        title: '國慶連假休假通知',
        tag: '一般公告',
        coverImage: 'https://imageserver.wentzao.com/another-cover.jpg',
        targetCampuses: ['kindergarten', 'afterschool']
    };
    for (const [campus, label] of [['kindergarten', '幼兒校區'], ['afterschool', '安親校區']]) {
        const bubble = createApp({ campus }).build(article).contents;
        assert.equal(bubble.hero.url, article.coverImage);
        assert.equal(titleText(bubble).text, article.title);
        assert.equal(detailCells(bubble)[0].contents[0].text, label);
        assert.equal(detailCells(bubble)[1].contents[0].text, article.tag);
        const uri = new URL(bubble.hero.action.uri);
        assert.equal(uri.origin, 'https://liff.line.me');
        assert.equal(uri.searchParams.get('campus'), campus);
        assert.equal(uri.searchParams.get('id'), article.id);
        assert.equal(detailCells(bubble)[2].action.uri, uri.href);
    }
});

test('keeps long titles, wrapping and native shrink-to-fit without a line cap', () => {
    for (const title of ['親子活動、課程提醒與重要事項說明'.repeat(4), 'LongEnglishTitleWithoutSpacesForWrapping', '👑🌈 文藻最新活動通知']) {
        const text = titleText(createApp().build({ ...sample, title }).contents);
        assert.equal(text.text, title);
        assert.equal(text.size, '18px');
        assert.equal(text.wrap, true);
        assert.equal(text.adjustMode, 'shrink-to-fit');
        assert.equal(text.scaling, true);
        assert.equal(text.maxLines, undefined);
    }
});

test('uses the smaller title size for eight Chinese characters without truncation', () => {
    const title = '國慶連假休假通知';
    assert.equal([...title].length, 8);
    const bubble = createApp().build({ ...sample, title }).contents;
    assert.equal(titleText(bubble).text, title);
    assert.equal(titleText(bubble).size, '18px');
    assert.equal(titleText(bubble).adjustMode, 'shrink-to-fit');
    assert.equal(titleText(bubble).align, 'center');
});

test('centers the full-width title above three equally sized and aligned cells', () => {
    const bubble = createApp().build(sample).contents;
    assert.equal(bubble.body.layout, 'vertical');
    assert.equal(bubble.body.contents.length, 2);
    assert.equal(titleText(bubble).type, 'text');
    assert.equal(titleText(bubble).align, 'center');
    assert.equal(bubble.body.contents[1].layout, 'horizontal');
    assert.equal(bubble.body.contents[1].alignItems, 'center');
    for (const column of bubble.body.contents[1].contents) {
        assert.equal(column.flex, 1);
        assert.equal(column.width, undefined);
        assert.equal(column.height, undefined);
    }
    const cells = detailCells(bubble);
    assert.equal(cells.length, 3);
    for (const cell of cells) {
        assert.equal(cell.flex, 0);
        assert.equal(cell.width, undefined);
        assert.equal(cell.height, '36px');
        assert.equal(cell.justifyContent, 'center');
        assert.equal(cell.contents[0].size, '13px');
        assert.equal(cell.contents[0].align, 'center');
        assert.equal(cell.contents[0].adjustMode, 'shrink-to-fit');
    }
    assert.equal(cells[0].action, undefined);
    assert.equal(cells[1].action, undefined);
    for (const cell of cells.slice(0, 2)) {
        assert.equal(cell.backgroundColor, undefined);
        assert.equal(cell.cornerRadius, undefined);
        assert.equal(cell.borderColor, undefined);
        assert.equal(cell.borderWidth, undefined);
        assert.equal(cell.contents[0].color, '#087047');
    }
    assert.equal(cells[2].action.label, '閱讀公告');
    assert.equal(cells[2].backgroundColor, '#02A568');
    assert.equal(cells[2].cornerRadius, '18px');
});

test('uses white image letterboxing while preserving the entire 4:3 cover', () => {
    const hero = createApp().build(sample).contents.hero;
    assert.equal(hero.backgroundColor, '#FFFFFF');
    assert.equal(hero.aspectRatio, '4:3');
    assert.equal(hero.aspectMode, 'fit');
});

test('falls back to an article image or the absolute placeholder URL', () => {
    const app = createApp();
    const fromContent = app.build({ ...sample, coverImage: null, contentBlocks: [{ type: 'image', url: '/assets/example.jpg' }] });
    assert.equal(fromContent.contents.hero.url, 'https://newsroom.wentzao.com/assets/example.jpg');
    const placeholder = app.build({ id: sample.id });
    assert.equal(placeholder.contents.hero.url, 'https://newsroom.wentzao.com/assets/backdrop.png');
    assert.equal(titleText(placeholder.contents).text, '最新消息');
    assert.equal(detailCells(placeholder.contents)[0].contents[0].text, '安親校區');
    assert.equal(detailCells(placeholder.contents)[1].contents[0].text, '公告');
});

test('passes the approved card to the LIFF picker and clears busy state', async () => {
    const app = createApp();
    await app.run('shareToLine(article, overlay, button)');
    assert.equal(app.calls.init.length, 1);
    assert.equal(app.calls.picker.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(app.calls.picker[0])), [app.build(sample)]);
    assert.equal(app.status.textContent, '已傳送 LINE Flex Message。');
    assert.equal(app.attrs.size, 0);
});

test('handles picker cancellation without leaving the button disabled', async () => {
    const app = createApp({ pickerResult: null });
    await app.run('shareToLine(article, overlay, button)');
    assert.equal(app.status.textContent, '已取消 LINE 分享。');
    assert.equal(app.attrs.size, 0);
});

test('hides LINE sharing outside LIFF and never initializes or opens a picker', async () => {
    const app = createApp({ inClient: false });
    await app.run('configureLineShareControls(overlay, article)');
    assert.equal(app.removed, true);
    await app.run('shareToLine(article, overlay, button)');
    assert.equal(app.calls.init.length, 0);
    assert.equal(app.calls.picker.length, 0);
    assert.equal(app.status.textContent, '請由 LINE App 的 LIFF 開啟這則消息後再分享。');
    assert.equal(app.attrs.size, 0);
});

test('preserves ordinary sharing: web URLs outside LIFF, LIFF URLs inside', async () => {
    for (const inClient of [false, true]) {
        const app = createApp({ inClient });
        await app.run('shareWithSystemSheet(article, overlay, button)');
        const url = new URL(app.calls.system[0].url);
        assert.equal(url.origin, inClient ? 'https://liff.line.me' : 'https://newsroom.wentzao.com');
        assert.equal(url.searchParams.get('campus'), 'afterschool');
        assert.equal(url.searchParams.get('id'), sample.id);
    }
});
