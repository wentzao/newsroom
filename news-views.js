/** Anonymous browser readership. The server owns both deduplication and totals. */
const NewsViews = (() => {
    const storageKey = 'newsroom.reader.v1';
    const pending = new Map();

    function validCount(value) {
        return Number.isSafeInteger(value) && value >= 0;
    }

    function label(count) {
        return `${count.toLocaleString('zh-TW')} 人看過`;
    }

    function markup(article) {
        const count = article.viewCount;
        return `<span class="news-view-count" data-news-view-id="${encodeURIComponent(article.id)}"${validCount(count) ? '' : ' hidden'} title="以瀏覽器計算閱讀人數，同一瀏覽器重複閱讀只計一次">${validCount(count) ? label(count) : ''}</span>`;
    }

    function update(id, count) {
        if (!validCount(count)) return;
        document.querySelectorAll('[data-news-view-id]').forEach(element => {
            if (element.dataset.newsViewId !== encodeURIComponent(id)) return;
            element.textContent = label(count);
            element.hidden = false;
        });
    }

    function readerId() {
        try {
            let id = localStorage.getItem(storageKey);
            if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id || '')) {
                id = crypto.randomUUID();
                localStorage.setItem(storageKey, id);
            }
            return id;
        } catch {
            // Without persistent storage, a fresh token on each reload would
            // inflate readership. Leave this browser's view unrecorded.
            return null;
        }
    }

    async function record(apiUrl, article, campus, container) {
        // Older servers have no readership field. Enable after backend rollout.
        if (!validCount(article.viewCount) || !container.isConnected) return;
        if (document.visibilityState === 'hidden') {
            await new Promise(resolve => {
                const onVisible = () => {
                    if (document.visibilityState === 'hidden') return;
                    document.removeEventListener('visibilitychange', onVisible);
                    resolve();
                };
                document.addEventListener('visibilitychange', onVisible);
            });
            if (!container.isConnected) return;
        }
        const visitorId = readerId();
        if (!visitorId) return;
        const key = `${article.id}:${campus}`;
        if (!pending.has(key)) {
            const request = (async () => {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 8000);
                try {
                    const response = await fetch(`${apiUrl}${encodeURIComponent(article.id)}/views?campus=${encodeURIComponent(campus)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ visitorId }),
                        signal: controller.signal
                    });
                    if (!response.ok) return;
                    const data = await response.json();
                    if (!validCount(data.viewCount)) return;
                    update(article.id, data.viewCount);
                    return data.viewCount;
                } catch {
                    // Analytics failure must never block reading or navigation.
                } finally {
                    clearTimeout(timer);
                    pending.delete(key);
                }
            })();
            pending.set(key, request);
        }
        const count = await pending.get(key);
        if (validCount(count)) article.viewCount = count;
        return count;
    }

    return { markup, update, record };
})();
