/**
 * Newsroom App - Fetches and displays news from kcb.wentzao.com API
 * Includes SPA overlay logic for seamless article viewing.
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
 * Render article content blocks (Copied from article.js logic)
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
 * Render full article HTML for the overlay
 */
function buildArticleHtml(article) {
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

    return `
        <article class="article-container">
            <!-- Article Header -->
            <header class="article-header-wrapper">
                <a href="#" class="back-btn-circle" id="overlay-back-btn" aria-label="返回">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                        stroke-linecap="round" stroke-linejoin="round">
                        <path d="M15 18l-6-6 6-6" />
                    </svg>
                </a>
                <div class="article-header-content">
                    <div class="article-meta">
                        <span class="article-tag">${article.tag || '公告'}</span>
                        <span class="article-date">${formatDate(article.publishAt)}</span>
                    </div>
                    <h1 class="article-title">${article.title}</h1>
                </div>
            </header>

            <!-- Article Content -->
            <div id="article-content" class="article-content">
                ${contentHtml}
            </div>
        </article>
        
        <!-- More News Section -->
        <section class="more-news-section">
            <div class="more-news-container">
                <h2 class="more-news-title">文藻幼兒園 的更多資訊</h2>
                <div id="more-news-list" class="more-news-list">
                    <!-- Populated by JS -->
                </div>
            </div>
        </section>
    `;
}

/**
 * Render More News items
 */
function renderMoreNews(currentId) {
    const container = document.getElementById('more-news-list');
    if (!container) return;

    // Use globally loaded items, filter current, take 3
    const relatedNews = allNewsItems
        .filter(item => item.id !== currentId)
        .slice(0, 3);

    if (relatedNews.length === 0) {
        container.innerHTML = '<p>沒有更多消息</p>';
        return;
    }

    container.innerHTML = relatedNews.map(news => {
        const imageUrl = getEffectiveCoverImage(news);
        // Determine if cover specific or fallback for opacity class
        const isFallback = !news.coverImage;

        return `
            <a href="?id=${news.id}" class="more-news-item" data-id="${news.id}" onclick="handleCardClick(event)">
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
 * SPA Overlay Logic
 */
async function openArticleOverlay(articleId) {
    const overlay = document.getElementById('article-overlay');
    if (!overlay) return;

    // Show overlay with loading state or skeleton if needed
    // For now, assume fast load or simple placeholder
    overlay.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';
    overlay.classList.add('active');
    document.body.classList.add('noscroll');

    try {
        const response = await fetch(API_URL + articleId);
        if (!response.ok) throw new Error('Network response was not ok');
        const article = await response.json();

        // Render content
        overlay.innerHTML = buildArticleHtml(article);

        // Render More News
        renderMoreNews(articleId);

        // Bind back button
        const backBtn = document.getElementById('overlay-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', (e) => {
                e.preventDefault();
                closeArticleOverlay();
            });
        }

        // Swipe to close logic
        let touchStartX = 0;
        let touchStartY = 0;
        let currentX = 0;
        let isDragging = false;
        let isScrolling = false;

        overlay.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isDragging = false;
            isScrolling = false;
            overlay.style.transition = 'none'; // Disable transition for 1:1 movement
        }, { passive: true });

        overlay.addEventListener('touchmove', (e) => {
            if (isScrolling) return;

            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const deltaX = touchX - touchStartX;
            const deltaY = Math.abs(touchY - touchStartY);

            // Determine if horizontal swipe or vertical scroll
            if (!isDragging && deltaX > 10 && deltaX > deltaY) {
                isDragging = true;
            } else if (!isDragging && deltaY > 10) {
                isScrolling = true;
            }

            if (isDragging && deltaX > 0) {
                e.preventDefault(); // Prevent browser navigation
                overlay.style.transform = `translateX(${deltaX}px)`;
            }
        }, { passive: false });

        overlay.addEventListener('touchend', (e) => {
            if (isDragging) {
                const deltaX = e.changedTouches[0].clientX - touchStartX;
                const threshold = window.innerWidth * 0.3; // Close if dragged 30% width

                if (deltaX > threshold) {
                    closeArticleOverlay();
                } else {
                    // Snap back
                    overlay.style.transition = 'transform 0.3s ease-out';
                    overlay.style.transform = 'translateX(0)';
                }
            }
            // Reset flags
            isDragging = false;
            isScrolling = false;
            // Restore transition if we didn't close (close() handles its own)
            if (overlay.classList.contains('active')) {
                // Wait for snap back if needed, but close() resets it anyway
            }
        });
    } catch (error) {
        console.error('Failed to load article', error);
        overlay.innerHTML = '<div class="error-message"><p>無法載入文章</p><button onclick="closeArticleOverlay()">關閉</button></div>';
    }
}

function closeArticleOverlay() {
    const overlay = document.getElementById('article-overlay');
    if (overlay) {
        overlay.classList.remove('active');
        // Clear content after transition to save memory/clean state
        setTimeout(() => {
            overlay.innerHTML = '';
        }, 400);
    }
    document.body.classList.remove('noscroll');

    // Reset URL if we pushed state
    const url = new URL(window.location);
    if (url.searchParams.has('id')) {
        // Go back in history if we pushed a state
        if (history.state && history.state.articleOpen) {
            history.back();
        } else {
            // Just replace
            const newUrl = window.location.pathname;
            history.replaceState(null, '', newUrl);
        }
    }
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

// State for pagination
let allNewsItems = [];
let renderedCount = 0;
const INITIAL_BATCH_SIZE = 11; // 1 featured + 4 grid + 6 small
const LOAD_MORE_BATCH_SIZE = 6; // Load 6 at a time (2 rows)

// Scroll Observer
const scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            scrollObserver.unobserve(entry.target); // Trigger once
        }
    });
}, {
    threshold: 0.1, // Trigger when 10% visible
    rootMargin: '50px' // Start slightly early
});

/**
 * Helper to observe new elements
 */
function observeElements(elements) {
    elements.forEach(el => scrollObserver.observe(el));
}

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
    const newElements = []; // Track new elements to observe

    // 1. Featured Item (1)
    if (renderedCount < allNewsItems.length) {
        const featured = allNewsItems[renderedCount];
        featuredSection.innerHTML = createFeaturedCard(featured);
        const card = featuredSection.querySelector('.featured-card, .pinned-wrapper');
        if (card) {
            card.classList.add('reveal-on-scroll');
            newElements.push(card);
        }
        renderedCount++;
    }

    // 2. Main Grid Items (Next 4)
    const mainBatchSize = 4;
    const mainItems = allNewsItems.slice(renderedCount, renderedCount + mainBatchSize);
    if (mainItems.length > 0) {
        const html = mainItems.map(news => createNewsCard(news)).join('');
        newsGrid.insertAdjacentHTML('beforeend', html);

        // Find the newly added cards (this is a bit broad but safe for initial render)
        const cards = newsGrid.querySelectorAll('.news-card:not(.reveal-on-scroll)');
        cards.forEach(card => {
            card.classList.add('reveal-on-scroll');
            newElements.push(card);
        });

        renderedCount += mainItems.length;
    }

    // 3. Small Grid Items (Initial Batch - Next 6)
    const smallBatchSize = 6;
    const smallItems = allNewsItems.slice(renderedCount, renderedCount + smallBatchSize);

    // Create container
    const smallContainerHtml = `<div id="news-grid-small-container" class="news-grid-small"></div>`;
    newsGrid.insertAdjacentHTML('beforeend', smallContainerHtml);
    const smallGridContainer = document.getElementById('news-grid-small-container');

    if (smallItems.length > 0) {
        const html = smallItems.map(news => createNewsCard(news, true)).join('');
        smallGridContainer.innerHTML = html;

        const cards = smallGridContainer.querySelectorAll('.news-card');
        cards.forEach(card => {
            card.classList.add('reveal-on-scroll');
            newElements.push(card);
        });

        renderedCount += smallItems.length;
    }

    // Check if we need to show Load More button
    updateLoadMoreButton();

    // Start observing
    observeElements(newElements);
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
            // Append new items
            const newCardsHtml = nextBatch.map(news => createNewsCard(news, true)).join('');

            // We need to parse this HTML to find elements to observe
            // Inserting adjacent HTML is fine, but we need to select the new ones.
            // A simple trick is to query all '.news-card' inside container that DO NOT have .reveal-on-scroll class yet
            // Wait, createNewsCard doesn't enable it by default in my implementation here, I add it manually.
            // Let's modify createNewsCard logic slightly in code or just handle it here.
            // Actually, inserting HTML string makes it hard to get refs immediately without querying.

            // To be robust: Insert, then query un-initialized cards.
            smallGridContainer.insertAdjacentHTML('beforeend', newCardsHtml);

            const newCards = Array.from(smallGridContainer.querySelectorAll('.news-card')).filter(c => !c.classList.contains('reveal-on-scroll'));

            newCards.forEach(card => {
                card.classList.add('reveal-on-scroll');
                scrollObserver.observe(card); // Observe directly
            });

            // Re-bind click handlers
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
        const response = await fetch(API_URL + '?limit=50');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        hideLoading();

        renderNews(data.items || data);
        return data.items || data;

    } catch (error) {
        console.error('Failed to fetch news:', error);
        hideLoading();
        showError();
    }
}

/**
 * Handle card click - SPA Navigation
 */
function handleCardClick(event) {
    event.preventDefault();

    const card = event.currentTarget.closest('.featured-card, .news-card') || event.currentTarget;
    const articleId = card.dataset.id;

    if (articleId) {
        // Update URL and History
        history.pushState({ articleOpen: true, articleId: articleId }, '', `?id=${articleId}`);
        openArticleOverlay(articleId);
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

// Handle Browser Back Button
window.addEventListener('popstate', (event) => {
    // If we have state, it means we might be popping back to a state that is 'open' 
    // BUT usually popstate happens when we go *back* to null state (home).
    // Let's check: if the new URL has no ID, close overlay.

    // Simplest logic: Check URL param
    const params = new URLSearchParams(window.location.search);
    if (!params.get('id')) {
        const overlay = document.getElementById('article-overlay');
        if (overlay && overlay.classList.contains('active')) {
            // We interpret this as "Close overlay"
            // We manually close it, but we DON'T call history.back() again 
            // because we are already here due to a back action.
            const overlay = document.getElementById('article-overlay');
            overlay.classList.remove('active');
            setTimeout(() => { overlay.innerHTML = ''; }, 400);
            document.body.classList.remove('noscroll');
        }
    } else {
        // If we popped TO a state with ID, we should open it (e.g. Forward button)
        const id = params.get('id');
        openArticleOverlay(id);
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check if loaded with ID (direct link)
    const params = new URLSearchParams(window.location.search);
    const initialId = params.get('id');

    // Fetch news first to populate background
    await fetchNews();
    addCardClickHandlers();

    // Add load more listener
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', handleLoadMore);
    }

    if (initialId) {
        // If direct link, open overlay immediately
        // Note: The list in background is already fetching/rendering
        openArticleOverlay(initialId);
    }
});

