// Shared audience rules for the newsroom and legacy article page.
const CAMPUS_CONFIG = {
    kindergarten: { label: '幼兒校區', name: '文藻幼兒園', website: 'https://www.wentzao.com/kindergarten/' },
    afterschool: { label: '安親校區', name: '文藻安親校區', website: 'https://www.wentzao.com/rainbow/' }
};

function getNewsParams() {
    const params = new URLSearchParams(window.location.search);
    const liffState = params.get('liff.state');
    if (liffState) {
        const stateParams = new URLSearchParams(liffState.replace(/^\/?\?/, ''));
        for (const key of ['id', 'campus']) {
            if (!params.has(key) && stateParams.has(key)) params.set(key, stateParams.get(key));
        }
    }
    return params;
}

function normalizeCampus(value) {
    return Object.hasOwn(CAMPUS_CONFIG, value) ? value : 'kindergarten';
}

let activeCampus = normalizeCampus(getNewsParams().get('campus'));

function getArticleCampuses(article) {
    return Array.isArray(article.targetCampuses) && article.targetCampuses.length
        ? article.targetCampuses
        : ['kindergarten'];
}

function isArticleInCampus(article, campus = activeCampus) {
    return getArticleCampuses(article).includes(campus);
}

function getNewsroomPath(articleId = null, campus = activeCampus) {
    const params = new URLSearchParams({ campus });
    if (articleId) params.set('id', articleId);
    return `/?${params}`;
}

function updateCampusIdentity() {
    const config = CAMPUS_CONFIG[activeCampus];
    document.title = `最新消息 - ${config.name}`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${config.name}最新消息與公告`);
    const home = document.querySelector('.site-home-btn');
    if (home) {
        home.href = config.website;
        home.setAttribute('aria-label', `前往${config.name}官網`);
        home.title = `前往${config.name}官網`;
    }
    document.querySelectorAll('[data-campus]').forEach(button => {
        button.setAttribute('aria-pressed', String(button.dataset.campus === activeCampus));
    });
}
