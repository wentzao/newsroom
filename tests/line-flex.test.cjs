const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = ['campus.js', 'app.js'].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
// The selected editorial card: left metadata, headline chevron, no button.
const approvedBubble = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/line-flex-bubble.json'), 'utf8'));
const sample = {
    id: 'news-20261007-001',
    title: '👑單字王競賽',
    tag: '課務提醒',
    publishAt: '2026-10-06T16:00:00Z',
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
    return bubble.body.contents[1].contents[0];
}

function metadataTexts(bubble) {
    return bubble.body.contents[0].contents;
}

function arrowImage(bubble) {
    return bubble.body.contents[1].contents[1];
}

test('matches the complete approved borderless JSON', () => {
    const message = createApp().build(sample);
    assert.equal(message.type, 'flex');
    assert.equal(message.altText, '課務提醒｜👑單字王競賽');
    assert.deepEqual(message.contents, approvedBubble);
    assert.doesNotMatch(JSON.stringify(message), /"border(Color|Width)"/);
    assert.equal(message.contents.action.label, '查看公告');
    assert.equal(message.contents.footer, undefined);
    assert.doesNotMatch(JSON.stringify(message), /"type":"button"|"text":"查看公告"/);
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
    for (const campus of ['kindergarten', 'afterschool']) {
        const bubble = createApp({ campus }).build(article).contents;
        assert.equal(bubble.hero.url, article.coverImage);
        assert.equal(titleText(bubble).text, article.title);
        assert.equal(metadataTexts(bubble)[0].text, article.tag);
        assert.doesNotMatch(JSON.stringify(bubble.body), /校區/);
        const uri = new URL(bubble.hero.action.uri);
        assert.equal(uri.origin, 'https://liff.line.me');
        assert.equal(uri.searchParams.get('campus'), campus);
        assert.equal(uri.searchParams.get('id'), article.id);
        assert.equal(bubble.action.uri, uri.href);
        assert.equal(bubble.body.action.uri, uri.href);
    }
});

test('keeps long titles, wrapping and native shrink-to-fit without a line cap', () => {
    for (const title of ['親子活動、課程提醒與重要事項說明'.repeat(4), 'LongEnglishTitleWithoutSpacesForWrapping', '👑🌈 文藻最新活動通知']) {
        const text = titleText(createApp().build({ ...sample, title }).contents);
        assert.equal(text.text, title);
        assert.equal(text.size, 'lg');
        assert.equal(text.wrap, true);
        assert.equal(text.adjustMode, 'shrink-to-fit');
        assert.equal(text.scaling, true);
        assert.equal(text.maxLines, undefined);
    }
});

test('keeps an eight-character title intact and left aligned', () => {
    const title = '國慶連假休假通知';
    assert.equal([...title].length, 8);
    const bubble = createApp().build({ ...sample, title }).contents;
    assert.equal(titleText(bubble).text, title);
    assert.equal(titleText(bubble).size, 'lg');
    assert.equal(titleText(bubble).adjustMode, 'shrink-to-fit');
    assert.equal(titleText(bubble).align, 'start');
});

test('groups category and date at the left, with a compact chevron beside the title', () => {
    const bubble = createApp().build(sample).contents;
    assert.equal(bubble.body.layout, 'vertical');
    assert.equal(bubble.body.contents.length, 2);
    assert.equal(titleText(bubble).type, 'text');
    assert.equal(titleText(bubble).align, 'start');
    assert.equal(bubble.body.contents[0].layout, 'horizontal');
    const metadata = metadataTexts(bubble);
    assert.equal(metadata.length, 2);
    assert.equal(metadata[0].text, sample.tag);
    assert.equal(metadata[0].align, 'start');
    assert.equal(metadata[0].flex, 0);
    assert.equal(metadata[1].text, '2026 年 10 月 7 日');
    assert.equal(metadata[1].align, 'start');
    assert.equal(metadata[1].flex, 1);
    assert.equal(bubble.body.contents[0].spacing, '8px');
    assert.equal(bubble.body.paddingTop, '12px');
    assert.equal(bubble.body.paddingStart, '16px');
    assert.equal(bubble.body.paddingEnd, '16px');
    const titleRow = bubble.body.contents[1];
    assert.equal(titleRow.layout, 'horizontal');
    assert.equal(titleRow.alignItems, 'center');
    assert.equal(titleRow.spacing, '12px');
    assert.equal(titleText(bubble).flex, 1);
    const arrow = arrowImage(bubble);
    assert.equal(arrow.type, 'image');
    assert.equal(arrow.flex, 0);
    assert.equal(arrow.size, '24px');
    assert.equal(arrow.aspectRatio, '1:1');
    assert.equal(arrow.aspectMode, 'fit');
    assert.equal(arrow.url, 'https://newsroom.wentzao.com/assets/line-chevron-right.png?v=20261008.1');
    assert.equal(bubble.footer, undefined);
});

test('restores the initial LINE typography without reverting the clickable editorial layout', () => {
    const bubble = createApp().build(sample).contents;
    assert.equal(titleText(bubble).size, 'lg');
    for (const text of metadataTexts(bubble)) assert.equal(text.size, 'xs');
    assert.equal(titleText(bubble).wrap, true);
    assert.equal(titleText(bubble).adjustMode, 'shrink-to-fit');
    assert.equal(titleText(bubble).scaling, true);
    assert.equal(arrowImage(bubble).size, '24px');
    assert.equal(bubble.footer, undefined);
    assert.deepEqual(bubble.body.action, bubble.action);
});

test('all card components inherit the same campus-preserving article action', () => {
    const bubble = createApp().build(sample).contents;
    const expected = bubble.action;
    let checked = 0;
    function check(node, inheritedAction) {
        const action = node.action || inheritedAction;
        assert.deepEqual(action, expected, `${node.type} must open the same article`);
        checked++;
        for (const child of [node.hero, node.body, ...(node.contents || [])].filter(Boolean)) {
            check(child, action);
        }
    }
    check(bubble);
    assert.equal(checked, 9);
    assert.equal(expected.type, 'uri');
    const url = new URL(expected.uri);
    assert.equal(url.searchParams.get('campus'), 'afterschool');
    assert.equal(url.searchParams.get('id'), sample.id);
});

test('ships a small transparent PNG chevron and its brand-colored licensed source', () => {
    const png = fs.readFileSync(path.join(root, 'assets/line-chevron-right.png'));
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.equal(png.readUInt32BE(16), 72);
    assert.equal(png.readUInt32BE(20), 72);
    assert.equal(png[25], 6, 'RGBA color type preserves transparency');
    assert.ok(png.length < 1024 * 1024);
    assert.match(fs.readFileSync(path.join(root, 'assets/icons/caret-right-bold.svg'), 'utf8'), /fill="#02A568"/);
    assert.match(fs.readFileSync(path.join(root, 'assets/icons/PHOSPHOR-LICENSE.txt'), 'utf8'), /MIT License/);
});

test('restores the reference 20:13 cover image', () => {
    const hero = createApp().build(sample).contents.hero;
    assert.equal(hero.backgroundColor, '#FFFFFF');
    assert.equal(hero.aspectRatio, '20:13');
    assert.equal(hero.aspectMode, 'cover');
});

test('formats the public date in Taiwan, including midnight and year boundaries', () => {
    for (const [publishAt, expected] of [
        ['2026-07-31T16:00:00Z', '2026 年 8 月 1 日'],
        ['2026-10-07T15:59:59Z', '2026 年 10 月 7 日'],
        ['2026-10-07T16:00:00Z', '2026 年 10 月 8 日'],
        ['2026-12-31T16:00:00Z', '2027 年 1 月 1 日']
    ]) {
        const bubble = createApp().build({ ...sample, publishAt, updatedAt: '2031-01-01T00:00:00Z' }).contents;
        assert.equal(metadataTexts(bubble)[1].text, expected);
    }
});

test('omits absent or invalid dates instead of producing blank Flex text', () => {
    for (const publishAt of [undefined, null, '', 'not-a-date']) {
        const bubble = createApp().build({ ...sample, publishAt }).contents;
        assert.equal(metadataTexts(bubble).length, 1);
        assert.equal(metadataTexts(bubble)[0].text, sample.tag);
        assert.doesNotMatch(JSON.stringify(bubble), /Invalid Date|"text":""/);
    }
});

test('falls back to an article image or the absolute placeholder URL', () => {
    const app = createApp();
    const fromContent = app.build({ ...sample, coverImage: null, contentBlocks: [{ type: 'image', url: '/assets/example.jpg' }] });
    assert.equal(fromContent.contents.hero.url, 'https://newsroom.wentzao.com/assets/example.jpg');
    const placeholder = app.build({ id: sample.id });
    assert.equal(placeholder.contents.hero.url, 'https://newsroom.wentzao.com/assets/backdrop.png');
    assert.equal(titleText(placeholder.contents).text, '最新消息');
    assert.equal(metadataTexts(placeholder.contents)[0].text, '公告');
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
