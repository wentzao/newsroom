/** Public views and browser readership are counted separately by the server. */
const NewsViews = (() => {
    const storageKey = 'newsroom.reader.v1';
    const latestCounts = new Map();

    function validCount(value) {
        return Number.isSafeInteger(value) && value >= 0;
    }

    function label(count) {
        return `${count.toLocaleString('zh-TW')} 次觀看`;
    }

    function markup(article) {
        const available = article.viewMetricsVersion === 2 && validCount(article.viewCount);
        const count = available ? Math.max(article.viewCount, latestCounts.get(article.id) || 0) : null;
        if (available) latestCounts.set(article.id, count);
        return `<span class="news-view-count" data-news-view-id="${encodeURIComponent(article.id)}"${available ? '' : ' hidden'}>
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
            <span class="news-view-number">${available ? label(count) : ''}</span>
        </span>`;
    }

    function update(id, value) {
        if (!validCount(value)) return;
        const count = Math.max(value, latestCounts.get(id) || 0);
        latestCounts.set(id, count);
        document.querySelectorAll('[data-news-view-id]').forEach(element => {
            if (element.dataset.newsViewId !== encodeURIComponent(id)) return;
            element.querySelector('.news-view-number').textContent = label(count);
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
            // Count opens without a persistent token, but do not invent a new
            // unique reader on every reload when storage is unavailable.
            return null;
        }
    }

    async function record(apiUrl, article, campus, container) {
        if (article.viewMetricsVersion !== 2 || !validCount(article.viewCount) || !container.isConnected) return;
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
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 8000);
        try {
            const viewId = crypto.randomUUID();
            const response = await fetch(`${apiUrl}${encodeURIComponent(article.id)}/views?campus=${encodeURIComponent(campus)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visitorId: readerId(), viewId }),
                signal: controller.signal
            });
            if (!response.ok) return;
            const data = await response.json();
            if (data.viewMetricsVersion !== 2 || !validCount(data.viewCount)) return;
            update(article.id, data.viewCount);
            article.viewCount = latestCounts.get(article.id);
            return article.viewCount;
        } catch {
            // Analytics failure must never block reading or navigation.
        } finally {
            clearTimeout(timer);
        }
    }

    return { markup, update, record };
})();
