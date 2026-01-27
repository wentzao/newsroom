/**
 * Article Detail Page - Fetches and displays a single news article
 */

const API_URL = 'https://kcb.wentzao.com/api/news/';
const PLACEHOLDER_IMAGE = 'assets/backdrop.png';

/**
 * Get article ID from URL query string
 */
function getArticleId() {
    const params = new URLSearchParams(window.location.search);
    const idFromUrl = params.get('id');

    if (idFromUrl) {
        return idFromUrl;
    }

    // Fallback to sessionStorage
    const idFromStorage = sessionStorage.getItem('currentArticleId');
    console.log('ID from URL missing, checking storage:', idFromStorage);
    return idFromStorage;
}

/**
 * Format date as "YYYY 年 M 月 D 日"
 */
function formatDate(dateString) {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${year} 年 ${month} 月 ${day} 日`;
    } catch (e) {
        return '';
    }
}

/**
 * Render article content blocks
 */
function renderContentBlocks(blocks) {
    if (!blocks || blocks.length === 0) return '';

    return blocks.map(block => {
        switch (block.type) {
            case 'text':
                // Convert newlines to paragraphs
                const paragraphs = block.content.split('\n').filter(p => p.trim());
                return paragraphs.map(p => `<p>${p}</p>`).join('');

            case 'image':
                return `
                    <figure class="content-image">
                        <img src="${block.url}" alt="${block.caption || ''}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMAGE}'">
                        ${block.caption ? `<figcaption>${block.caption}</figcaption>` : ''}
                    </figure>
                `;

            case 'video':
                // Simple YouTube ID extraction
                const ytMatch = block.url && block.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                const youtubeId = ytMatch ? ytMatch[1] : null;

                if (youtubeId) {
                    return `
                        <figure class="content-video">
                            <div class="video-wrapper">
                                <iframe 
                                    src="https://www.youtube.com/embed/${youtubeId}" 
                                    title="${block.caption || 'YouTube video player'}" 
                                    frameborder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowfullscreen>
                                </iframe>
                            </div>
                            ${block.caption ? `<figcaption>${block.caption}</figcaption>` : ''}
                        </figure>
                    `;
                }
                return '';

            case 'link':
                return `
                    <div class="content-link-wrapper">
                        <a href="${block.url}" target="_blank" rel="noopener noreferrer" class="content-link">
                            <span class="link-icon">🔗</span>
                            <span class="link-text">${block.label || block.url}</span>
                        </a>
                    </div>
                `;

            default:
                return '';
        }
    }).join('');
}

/**
 * Render the article
 */
function renderArticle(article) {
    // Update page title
    document.title = `${article.title} - 文藻幼兒園`;

    // Update header
    document.querySelector('.article-tag').textContent = article.tag || '公告';
    document.querySelector('.article-date').textContent = formatDate(article.publishAt);
    document.querySelector('.article-title').textContent = article.title;

    // Build content
    let contentHtml = '';

    // Cover image logic
    if (article.coverImage) {
        contentHtml += `
            <figure class="article-cover">
                <img src="${article.coverImage}" alt="${article.title}" onerror="this.src='${PLACEHOLDER_IMAGE}'">
            </figure>
        `;
    }

    // Content blocks
    contentHtml += renderContentBlocks(article.contentBlocks);

    // Survey Notice
    if (article.surveyId) {
        contentHtml += `
            <div class="content-link-wrapper">
                <div class="content-link survey-card">
                    <span class="link-icon">📝</span>
                    <span class="link-text">本篇有問卷，請至電子聯絡簿填寫</span>
                </div>
            </div>
        `;
    }

    // Author
    if (article.author) {
        contentHtml += `<div class="article-author">— ${article.author}</div>`;
    }

    document.getElementById('article-content').innerHTML = contentHtml;
}

/**
 * Show error state
 */
function showError(message) {
    document.querySelector('.article-title').textContent = '找不到文章';
    document.getElementById('article-content').innerHTML = `<p>${message}</p>`;
}

/**
 * Copy current page link
 */
function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
        alert('連結已複製！');
    }).catch(() => {
        alert('無法複製連結');
    });
}

/**
 * Fetch and display article
 */
async function fetchArticle() {
    const articleId = getArticleId();

    console.log('Article ID from URL:', articleId);

    if (!articleId) {
        showError('未指定文章 ID');
        return;
    }

    // Start fetching more news in parallel
    fetchMoreNews(articleId);

    const apiUrl = API_URL + articleId;
    console.log('Fetching from:', apiUrl);

    try {
        const response = await fetch(apiUrl);
        console.log('Response status:', response.status);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const article = await response.json();
        console.log('Article data:', article);
        renderArticle(article);

    } catch (error) {
        console.error('Failed to fetch article:', error);
        showError('無法載入文章，請稍後再試。');
    }
}

/**
 * Render More News items
 */
function renderMoreNews(newsItems) {
    const container = document.getElementById('more-news-list');
    if (!container || newsItems.length === 0) return;

    container.innerHTML = newsItems.map(news => {
        const imageUrl = news.coverImage || PLACEHOLDER_IMAGE;
        // Determine if cover specific or fallback for opacity class
        const isFallback = !news.coverImage;

        return `
            <a href="article.html?id=${news.id}" class="more-news-item" onclick="handleMoreNewsClick(event, '${news.id}')">
                <div class="more-news-image-wrapper">
                    <img src="${imageUrl}" alt="${news.title}" loading="lazy" class="${isFallback ? 'fallback' : ''}" onerror="this.src='${PLACEHOLDER_IMAGE}'">
                </div>
                <div class="more-news-content">
                    <span class="more-news-tag">${news.tag || '公告'}</span>
                    <h3 class="more-news-title">${news.title}</h3>
                    <time class="more-news-date">${formatDate(news.publishAt)}</time>
                </div>
            </a>
        `;
    }).join('');
}

/**
 * Handle click on more news item to ensure SessionStorage is set
 */
function handleMoreNewsClick(event, id) {
    // We let the link navigation happen, but set storage first just in case
    sessionStorage.setItem('currentArticleId', id);
}

/**
 * Fetch "More News" (recent items excluding current)
 */
async function fetchMoreNews(currentId) {
    try {
        // Fetch recent news
        const response = await fetch(API_URL + '?limit=4'); // Fetch 4 to have buffer if current is in top list
        if (!response.ok) return;

        const data = await response.json();
        const items = data.items || data;

        // Filter out current article and limit to 3
        const relatedNews = items
            .filter(item => item.id !== currentId)
            .slice(0, 3);

        renderMoreNews(relatedNews);

    } catch (error) {
        console.error('Failed to fetch more news:', error);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', fetchArticle);
