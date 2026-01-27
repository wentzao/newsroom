/**
 * Newsroom App - Fetches and displays news from kcb.wentzao.com API
 */

const API_URL = 'https://kcb.wentzao.com/api/news/';
const PLACEHOLDER_IMAGE = 'assets/backdrop.png';

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
 * Check if tag should be styled as important
 */
function isImportantTag(tag) {
    const importantTags = ['重要公告', '緊急通知', '重要'];
    return importantTags.includes(tag);
}

/**
 * Helper: Try to extract the first image URL from content blocks if coverImage is missing
 */
function getEffectiveCoverImage(news) {
    if (news.coverImage) return news.coverImage;

    // Check content blocks for first image
    if (news.contentBlocks && Array.isArray(news.contentBlocks)) {
        const imageBlock = news.contentBlocks.find(b => b.type === 'image' && b.url);
        if (imageBlock) return imageBlock.url;
    }

    return PLACEHOLDER_IMAGE;
}

/**
 * Create featured card HTML
 */
function createFeaturedCard(news) {
    const imageUrl = getEffectiveCoverImage(news);
    const tagClass = isImportantTag(news.tag) ? 'featured-tag important' : 'featured-tag';

    // Core Card HTML
    const cardHtml = `
        <article class="featured-card" data-id="${news.id}">
            <div class="featured-image skeleton">
                <img src="${imageUrl}" alt="${news.title}" loading="lazy" class="img-fade-in"
                     onload="this.classList.add('img-loaded'); this.parentElement.classList.remove('skeleton')"
                     onerror="this.src='${PLACEHOLDER_IMAGE}'; this.classList.add('img-loaded'); this.parentElement.classList.remove('skeleton')">
            </div>
            <div class="featured-content">
                <span class="${tagClass}">${news.tag || '公告'}</span>
                <h2 class="featured-title">${news.title}</h2>
                <time class="featured-date">${formatDate(news.publishAt)}</time>
            </div>
        </article>
    `;

    // SVG Bookmark Badge
    const bookmarkHtml = news.isPinned ? `
        <div class="bookmark-badge">
            <svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 0H22C23.1046 0 24 0.89543 24 2V36L12 28L0 36V2C0 0.895431 0.89543 0 2 0Z" fill="#FF3B30"/>
            </svg>
        </div>
    ` : '';

    // Wrap if pinned
    if (news.isPinned) {
        return `
            <div class="pinned-wrapper">
                ${cardHtml}
                ${bookmarkHtml}
            </div>
        `;
    }

    return cardHtml;
}

/**
 * Create news card HTML
 */
/**
 * Create news card HTML
 */
function createNewsCard(news, isSmall = false) {
    const imageUrl = getEffectiveCoverImage(news);
    const tagClass = isImportantTag(news.tag) ? 'news-card-tag important' : 'news-card-tag';
    const cardClass = isSmall ? 'news-card news-card-small' : 'news-card';

    // Core Card HTML
    const cardHtml = `
        <article class="${cardClass}" data-id="${news.id}">
            <div class="news-card-image skeleton">
                <img src="${imageUrl}" alt="${news.title}" loading="lazy" class="img-fade-in"
                     onload="this.classList.add('img-loaded'); this.parentElement.classList.remove('skeleton')"
                     onerror="this.src='${PLACEHOLDER_IMAGE}'; this.classList.add('img-loaded'); this.parentElement.classList.remove('skeleton')">
            </div>
            <div class="news-card-content">
                <span class="${tagClass}">${news.tag || '公告'}</span>
                <h3 class="news-card-title">${news.title}</h3>
                <time class="news-card-date">${formatDate(news.publishAt)}</time>
            </div>
        </article>
    `;

    // SVG Bookmark Badge
    const bookmarkHtml = news.isPinned ? `
        <div class="bookmark-badge">
            <svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 0H22C23.1046 0 24 0.89543 24 2V36L12 28L0 36V2C0 0.895431 0.89543 0 2 0Z" fill="#FF3B30"/>
            </svg>
        </div>
    ` : '';

    // Wrap if pinned
    if (news.isPinned) {
        return `
            <div class="pinned-wrapper">
                ${cardHtml}
                ${bookmarkHtml}
            </div>
        `;
    }

    return cardHtml;
}

/**
 * Render the news to the page
 */
// State for pagination
let allNewsItems = [];
let renderedCount = 0;
const INITIAL_BATCH_SIZE = 11; // 1 featured + 4 grid + 6 small
const LOAD_MORE_BATCH_SIZE = 6; // Load 6 at a time (2 rows)

/**
 * Render the news to the page
 */
function renderNews(newsItems) {
    const featuredSection = document.getElementById('featured');
    const newsGrid = document.getElementById('news-grid');

    // Store all items globally
    allNewsItems = newsItems || [];

    if (allNewsItems.length === 0) {
        featuredSection.innerHTML = '<p style="text-align: center; color: #6e6e73;">目前沒有新聞</p>';
        newsGrid.innerHTML = '';
        return;
    }

    // Reset grid
    renderedCount = 0;

    // 1. Featured Item (1)
    if (renderedCount < allNewsItems.length) {
        const featured = allNewsItems[renderedCount];
        featuredSection.innerHTML = createFeaturedCard(featured);
        renderedCount++;
    }

    // 2. Main Grid Items (Next 4)
    let mainNewsHtml = '';
    const mainBatchSize = 4;
    const mainItems = allNewsItems.slice(renderedCount, renderedCount + mainBatchSize);
    if (mainItems.length > 0) {
        mainNewsHtml = mainItems.map(news => createNewsCard(news)).join('');
        renderedCount += mainItems.length;
    }

    // 3. Small Grid Items (Initial Batch - Next 6)
    let smallNewsHtml = '';
    const smallBatchSize = 6;
    const smallItems = allNewsItems.slice(renderedCount, renderedCount + smallBatchSize);

    // Always create a container for small grid, even if first batch is empty or partial
    // This allows us to append to it later
    smallNewsHtml = `<div id="news-grid-small-container" class="news-grid-small">`;
    if (smallItems.length > 0) {
        smallNewsHtml += smallItems.map(news => createNewsCard(news, true)).join('');
        renderedCount += smallItems.length;
    }
    smallNewsHtml += `</div>`;

    newsGrid.innerHTML = mainNewsHtml + smallNewsHtml;

    // Check if we need to show Load More button
    updateLoadMoreButton();
}

/**
 * Update Load More Button Visibility
 */
function updateLoadMoreButton() {
    const btnContainer = document.getElementById('load-more-container');
    if (renderedCount < allNewsItems.length) {
        btnContainer.style.display = 'flex';
    } else {
        btnContainer.style.display = 'none';
    }
}

/**
 * Handle Load More Click
 */
function handleLoadMore() {
    const nextBatch = allNewsItems.slice(renderedCount, renderedCount + LOAD_MORE_BATCH_SIZE);

    if (nextBatch.length > 0) {
        const smallGridContainer = document.getElementById('news-grid-small-container');
        if (smallGridContainer) {
            // Append new items to the existing small grid container
            // Since we are adding string HTML, we can just insertAdjacentHTML
            const newCardsHtml = nextBatch.map(news => createNewsCard(news, true)).join('');
            smallGridContainer.insertAdjacentHTML('beforeend', newCardsHtml);

            // Re-bind click handlers for new elements (or delegate event handling)
            // For simplicity, we just re-run handler binding on all cards (a bit wasteful but safe)
            addCardClickHandlers();
        }

        renderedCount += nextBatch.length;
        updateLoadMoreButton();
    }
}

/**
 * Show loading state
 */
function showLoading() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('error').style.display = 'none';
    document.getElementById('featured').innerHTML = '';
    document.getElementById('news-grid').innerHTML = '';
    document.getElementById('load-more-container').style.display = 'none';
}

/**
 * Hide loading state
 */
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

/**
 * Show error state
 */
function showError() {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'block';
}

/**
 * Fetch news from API
 */
async function fetchNews() {
    showLoading();

    try {
        // Increase limit to allow for client-side pagination flow
        const response = await fetch(API_URL + '?limit=50');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        hideLoading();

        // API returns { items: [...], total, page, limit, hasMore }
        renderNews(data.items || data);
        return data.items || data;

    } catch (error) {
        console.error('Failed to fetch news:', error);
        hideLoading();
        showError();
    }
}

/**
 * Handle card click - navigate to article page
 */
function handleCardClick(event) {
    // Prevent default behavior if it's an anchor tag (though it's an article tag currently)
    event.preventDefault();

    const card = event.currentTarget.closest('.featured-card, .news-card') || event.currentTarget;
    const articleId = card.dataset.id; // Corrected from .dataset.id

    console.log('Navigating to article, ID:', articleId);

    if (articleId) {
        // Save to sessionStorage as backup in case query params are stripped
        sessionStorage.setItem('currentArticleId', articleId);

        // Use full path to be safe with local server behaviors
        const targetUrl = `article.html?id=${articleId}`;
        console.log('Setting window.location.href to:', targetUrl);
        window.location.href = targetUrl;
    } else {
        console.error('No article ID found on card', card);
    }
}

/**
 * Add click handlers to all cards
 */
function addCardClickHandlers() {
    const cards = document.querySelectorAll('.featured-card, .news-card');
    cards.forEach(card => {
        // Avoid adding duplicate listeners
        if (!card.dataset.hasClickListener) {
            card.addEventListener('click', handleCardClick);
            card.dataset.hasClickListener = 'true';
        }
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Add load more listener
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', handleLoadMore);
    }

    await fetchNews();
    addCardClickHandlers();
});

