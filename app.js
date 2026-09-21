/**
 * Newsroom App - Fetches and displays news from kcb.wentzao.com API
 * Includes SPA overlay logic for seamless article viewing.
 */

const API_URL = 'https://kcb.wentzao.com/api/news/';
const PLACEHOLDER_IMAGE = 'assets/backdrop.png';
const CANONICAL_ORIGIN = 'https://newsroom.wentzao.com';
const LEFT_EDGE_SWIPE_ZONE = 32;
const LEFT_EDGE_SWIPE_DISTANCE = 96;
let liffSdkPromise = null;
let liffInitializationPromise = null;

function getLiffId() {
    return document.querySelector('meta[name="liff-id"]')?.content.trim() || '';
}

function getArticleUrl(articleId) {
    return `${CANONICAL_ORIGIN}/?id=${encodeURIComponent(articleId)}`;
}

function getLiffArticleUrl(articleId) {
    const liffId = getLiffId();
    return liffId
        ? `https://liff.line.me/${encodeURIComponent(liffId)}?id=${encodeURIComponent(articleId)}`
        : getArticleUrl(articleId);
}

function getAbsoluteImageUrl(imageUrl) {
    try {
        return new URL(imageUrl || PLACEHOLDER_IMAGE, CANONICAL_ORIGIN).href;
    } catch (error) {
        return new URL(PLACEHOLDER_IMAGE, CANONICAL_ORIGIN).href;
    }
}

function setShareStatus(overlay, message, sourceButton = null) {
    const actionGroup = sourceButton?.closest('.article-share-actions');
    const statuses = actionGroup
        ? [actionGroup.querySelector('.share-status')]
        : [...overlay.querySelectorAll('.share-status')];

    statuses.filter(Boolean).forEach(status => {
        status.textContent = message;
    });
}

async function shareWithSystemSheet(article, overlay, sourceButton) {
    const shareData = {
        title: article.title,
        text: `${article.tag || '公告'}｜${article.title}`,
        url: getArticleUrl(article.id)
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
            setShareStatus(overlay, '已開啟分享選單。', sourceButton);
            return;
        }

        await navigator.clipboard.writeText(shareData.url);
        setShareStatus(overlay, '連結已複製，可貼到要分享的地方。', sourceButton);
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('System sharing failed', error);
            setShareStatus(overlay, '目前無法分享，請稍後再試。', sourceButton);
        }
    }
}

function loadLiffSdk() {
    if (window.liff) return Promise.resolve(window.liff);
    if (liffSdkPromise) return liffSdkPromise;

    liffSdkPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
        script.async = true;
        script.onload = () => resolve(window.liff);
        script.onerror = () => reject(new Error('LIFF SDK failed to load'));
        document.head.appendChild(script);
    });

    return liffSdkPromise;
}

function isLikelyLineClient() {
    return /\bLine\//i.test(navigator.userAgent || '');
}

async function prepareLiff() {
    const liffId = getLiffId();
    if (!liffId) return null;

    const liff = await loadLiffSdk();

    // LINE documents allow this check before init. Avoiding init outside the
    // LIFF browser prevents an external-browser redirect/reload on button tap.
    if (!liff.isInClient()) return null;

    if (!liffInitializationPromise) {
        liffInitializationPromise = liff.init({
            liffId,
            withLoginOnExternalBrowser: false
        }).then(() => liff);
    }

    return liffInitializationPromise;
}

function buildLineFlexMessage(article) {
    const imageUrl = getAbsoluteImageUrl(getEffectiveCoverImage(article));
    const articleUrl = getLiffArticleUrl(article.id);

    return {
        type: 'flex',
        altText: `${article.tag || '公告'}｜${article.title}`,
        contents: {
            type: 'bubble',
            hero: {
                type: 'image',
                url: imageUrl,
                size: 'full',
                aspectRatio: '20:13',
                aspectMode: 'cover',
                action: { type: 'uri', uri: articleUrl }
            },
            body: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [
                    {
                        type: 'text',
                        text: article.tag || '公告',
                        size: 'xs',
                        color: '#6E6E73',
                        weight: 'bold'
                    },
                    {
                        type: 'text',
                        text: article.title,
                        wrap: true,
                        weight: 'bold',
                        size: 'lg',
                        maxLines: 3
                    },
                    {
                        type: 'text',
                        text: formatDate(article.publishAt),
                        size: 'xs',
                        color: '#8A8A8E'
                    }
                ]
            },
            footer: {
                type: 'box',
                layout: 'vertical',
                spacing: 'sm',
                contents: [{
                    type: 'button',
                    style: 'primary',
                    height: 'sm',
                    action: { type: 'uri', label: '查看消息', uri: articleUrl }
                }]
            }
        }
    };
}

async function shareToLine(article, overlay, sourceButton) {
    if (!getLiffId()) {
        setShareStatus(overlay, '請先在 index.html 填入 LIFF ID，才能傳送 Flex Message。', sourceButton);
        return;
    }

    const button = sourceButton;
    button?.setAttribute('aria-busy', 'true');
    button?.setAttribute('disabled', '');

    try {
        const liff = await prepareLiff();

        if (!liff) {
            setShareStatus(overlay, '請由 LINE App 的 LIFF 開啟這則消息後再分享。', sourceButton);
            return;
        }

        if (!liff.isApiAvailable('shareTargetPicker')) {
            setShareStatus(overlay, '此 LINE 環境無法開啟分享清單，請從 LIFF 重新開啟。', sourceButton);
            return;
        }

        const result = await liff.shareTargetPicker([buildLineFlexMessage(article)]);
        setShareStatus(overlay, result ? '已傳送 LINE Flex Message。' : '已取消 LINE 分享。', sourceButton);
    } catch (error) {
        console.error('LINE sharing failed', error);
        setShareStatus(overlay, 'LINE 分享失敗，請確認 LIFF ID 與 App 設定。', sourceButton);
    } finally {
        button?.removeAttribute('aria-busy');
        button?.removeAttribute('disabled');
    }
}

function bindShareControls(overlay, article) {
    overlay.querySelectorAll('.system-share-btn').forEach(button => {
        button.addEventListener('click', () => {
            shareWithSystemSheet(article, overlay, button);
        });
    });

    configureLineShareControls(overlay, article);
}

function removeLineShareButtons(overlay) {
    overlay.querySelectorAll('.line-share-btn').forEach(button => button.remove());
}

async function configureLineShareControls(overlay, article) {
    if (!isLikelyLineClient()) {
        removeLineShareButtons(overlay);
        return;
    }

    try {
        const liff = await prepareLiff();
        if (!liff || !liff.isApiAvailable('shareTargetPicker')) {
            removeLineShareButtons(overlay);
            return;
        }

        overlay.querySelectorAll('.line-share-btn').forEach(button => {
            button.addEventListener('click', () => {
                shareToLine(article, overlay, button);
            });
        });
    } catch (error) {
        console.error('Unable to prepare LINE sharing', error);
        removeLineShareButtons(overlay);
    }
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
                // Rich text HTML from Quill editor — render directly
                if (/<[a-z][\s\S]*>/i.test(block.content)) {
                    return block.content;
                }
                // Plain text fallback — convert newlines to paragraphs
                return block.content.split('\n').filter(p => p.trim())
                    .map(p => `<p>${p}</p>`).join('');

            case 'image':
                return `
                    <figure class="content-image">
                        <img src="${block.url}" alt="${block.caption || ''}" loading="lazy" onerror="this.src='${PLACEHOLDER_IMAGE}'">
                        ${block.caption ? `<figcaption>${block.caption}</figcaption>` : ''}
                    </figure>
                `;

            case 'video':
                // Simple YouTube ID extraction
                const videoUrl = block.youtubeUrl || block.url;
                const ytMatch = videoUrl && videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
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
function buildArticleShareActions(position) {
    return `
        <div class="article-share-actions article-share-actions-${position}" aria-label="分享這則消息">
            <button class="article-share-btn system-share-btn" type="button" aria-label="分享這則消息">
                <svg class="share-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 15.5V3.5M7.5 8 12 3.5 16.5 8M5 12.5v6.25c0 .69.56 1.25 1.25 1.25h11.5c.69 0 1.25-.56 1.25-1.25V12.5" />
                </svg>
                <span>分享</span>
            </button>
            <button class="article-share-btn line-share-btn" type="button" aria-label="透過 LINE 分享">
                <span>透過 LINE 分享</span>
            </button>
            <p class="share-status" role="status" aria-live="polite"></p>
        </div>
    `;
}

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
                <div class="article-header-content">
                    <div class="article-meta">
                        <span class="article-tag">${article.tag || '公告'}</span>
                        <span class="article-date">${formatDate(article.publishAt)}</span>
                    </div>
                    <h1 class="article-title">${article.title}</h1>
                    ${buildArticleShareActions('header')}
                </div>
            </header>

            <!-- Article Content -->
            <div id="article-content" class="article-content">
                ${contentHtml}
            </div>

            <!-- Repeat the action at the end of a long article. -->
            ${buildArticleShareActions('bottom')}
        </article>
        
        <!-- More News Section -->
        <section class="more-news-section">
            <div class="more-news-container">
                <h2 class="more-news-title">文藻幼兒園 的更多資訊</h2>
                <div id="more-news-list" class="more-news-list">
                    <!-- Populated by JS -->
                </div>
                <!-- Back to Homepage Button -->
                <div class="back-to-home-container">
                    <button class="back-to-home-btn" onclick="closeAllOverlays()">回到消息主頁</button>
                </div>
            </div>
        </section>
    `;
}

/**
 * Render More News items
 */
/**
 * Render More News items into specific container
 */
function renderMoreNews(currentId, overlayContext) {
    // Find list within the specific overlay context
    const container = overlayContext.querySelector('.more-news-list');
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
 * SPA Overlay Logic - Stacked Implementation
 */
let closeTimer = null; // Global timer isn't enough for stack, but we keep simple debounce if needed

async function openArticleOverlay(articleId) {
    // Prevent duplicate open if already top
    const existingOverlays = document.querySelectorAll('.article-overlay');
    if (existingOverlays.length > 0) {
        const top = existingOverlays[existingOverlays.length - 1];
        if (top.dataset.id === articleId) return;
    }

    // 1. Create NEW overlay element
    const overlay = document.createElement('div');
    overlay.className = 'article-overlay';
    // Add specific ID for debugging or checking, though we rely on class and DOM order
    overlay.dataset.id = articleId;

    // Reset Scroll & Styles
    overlay.scrollTop = 0;
    overlay.style.transition = '';
    overlay.style.transform = '';

    // 2. Set Initial Content (Loading)
    overlay.innerHTML = '<div class="loading"><div class="loading-spinner"></div></div>';

    // 3. Append to body (Starts invisible/translated out via CSS)
    document.body.appendChild(overlay);

    // 4. Trigger Animation (Next Tick) and scroll to top instantly
    requestAnimationFrame(() => {
        overlay.classList.add('active');
        overlay.classList.add('active');

        // Hide main page content to prevent it showing through
        const mainContent = document.querySelector('.main-content');
        if (mainContent && mainContent.style.display !== 'none') {
            // Save scroll position ONLY if main content is currently visible
            // This prevents overwriting with 0 if opening a 2nd overlay
            window.mainPageScrollPosition = window.scrollY;
            mainContent.style.display = 'none';
        }

        // Scroll overlay to top instantly (must be AFTER hiding main content to avoid jump)
        window.scrollTo(0, 0);

        // Keep previous layers intact so browser Back and the left-edge gesture
        // can return to the exact article without a blank intermediate state.
    });

    // 5. Global Scroll Lock (Idempotent with padding fix)
    lockBodyScroll();

    try {
        const response = await fetch(API_URL + articleId);
        if (!response.ok) throw new Error('Network response was not ok');
        const article = await response.json();

        // Render content
        overlay.innerHTML = buildArticleHtml(article);

        // Bind article-specific actions after the dynamic markup exists.
        bindShareControls(overlay, article);

        // Render More News (Scoped to this overlay)
        renderMoreNews(articleId, overlay);

        bindLeftEdgeBackSwipe(overlay);

    } catch (error) {
        console.error('Failed to load article', error);
        overlay.innerHTML = '<div class="error-message"><p>無法載入文章</p><button class="close-btn-error">關閉</button></div>';
        const closeBtn = overlay.querySelector('.close-btn-error');
        if (closeBtn) closeBtn.onclick = () => closeArticleOverlay(overlay);
    }
}

/**
 * Helper to Mark Overlay State (No longer locks scroll)
 */
function lockBodyScroll() {
    // No longer prevent body scroll - we want unified scrolling
    // Just mark that an overlay is open for potential styling
    document.body.classList.add('overlay-open');
}

/**
 * Helper to Unmark Overlay State
 */
function unlockBodyScroll() {
    // Remove overlay marker class
    document.body.classList.remove('overlay-open');

    // Show main content again
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.style.display = '';
        // Restore scroll position instantly
        if (typeof window.mainPageScrollPosition !== 'undefined') {
            // Use 'instant' behavior to override any CSS scroll-behavior: smooth
            window.scrollTo({
                top: window.mainPageScrollPosition,
                behavior: 'instant'
            });
        }
    }
}

/**
 * iOS-style navigation: begin at the physical left edge, then drag right.
 * Vertical reading gestures remain untouched because a horizontal intent is
 * required before the overlay follows the finger.
 */
function bindLeftEdgeBackSwipe(overlay) {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let horizontalIntent = false;

    overlay.addEventListener('touchstart', (event) => {
        if (event.touches.length !== 1) return;

        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        tracking = startX <= LEFT_EDGE_SWIPE_ZONE;
        horizontalIntent = false;
    }, { passive: true });

    overlay.addEventListener('touchmove', (event) => {
        if (!tracking || event.touches.length !== 1) return;

        const touch = event.touches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;

        if (!horizontalIntent) {
            if (Math.abs(deltaY) > 12 && Math.abs(deltaY) > Math.abs(deltaX)) {
                tracking = false;
                return;
            }
            if (deltaX > 12 && deltaX > Math.abs(deltaY)) {
                horizontalIntent = true;
                overlay.classList.add('is-swiping');
            }
        }

        if (horizontalIntent) {
            const progress = Math.min(Math.max(deltaX, 0), window.innerWidth * 0.35);
            overlay.style.transform = `translateX(${progress}px)`;
        }
    }, { passive: true });

    overlay.addEventListener('touchend', (event) => {
        if (!tracking) return;

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        const shouldGoBack = horizontalIntent
            && deltaX >= LEFT_EDGE_SWIPE_DISTANCE
            && deltaX > Math.abs(deltaY) * 1.2;

        overlay.classList.remove('is-swiping');
        overlay.style.transform = '';
        tracking = false;

        if (shouldGoBack) history.back();
    }, { passive: true });

    overlay.addEventListener('touchcancel', () => {
        overlay.classList.remove('is-swiping');
        overlay.style.transform = '';
        tracking = false;
    }, { passive: true });
}

/**
 * Close Specific Overlay (or top one if not specified)
 */
function closeArticleOverlay(specificOverlay = null) {
    // If no specific overlay passed, FIND the top-most one
    let overlay = specificOverlay;
    if (!overlay) {
        const overlays = document.querySelectorAll('.article-overlay');
        if (overlays.length > 0) {
            overlay = overlays[overlays.length - 1]; // Top-most
        }
    }

    if (overlay) {
        // Animate Out
        overlay.classList.remove('active');

        // Wait for transition then Remove from DOM
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }

            // Allow scroll ONLY if no overlays left
            const remaining = document.querySelectorAll('.article-overlay');
            if (remaining.length === 0) {
                unlockBodyScroll();
            }
        }, 400); // Match CSS transition duration

        // Handle URL History Sync
        // If we just closed the top overlay, we should essentially "Pop" the history logic
        // But typically the user initiates this via Back Button (handled in popstate) 
        // OR via UI Click (which needs to update history).

        // If we are NOT in a popstate event (implied), we should go back.
        // Checking if ID matches current URL ID is a good heuristic.
        const params = new URLSearchParams(window.location.search);
        if (params.get('id') === overlay.dataset.id) {
            history.back();
        }
    }
}

/**
 * Close All Overlays and Return to Homepage
 */
function closeAllOverlays() {
    const overlays = document.querySelectorAll('.article-overlay');

    // Close all overlays with animation
    overlays.forEach(overlay => {
        overlay.classList.remove('active');
    });

    // Remove all overlays after animation
    setTimeout(() => {
        overlays.forEach(overlay => {
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        });

        // Restore main page
        unlockBodyScroll();

        // Update URL to homepage
        const url = new URL(window.location);
        url.searchParams.delete('id');
        window.history.pushState({}, '', url);
    }, 400);
}

// Handle Browser Back Button
window.addEventListener('popstate', (event) => {
    // Current URL state
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('id');

    // Current DOM state - Get ALL overlays (active or implicitly in stack)
    // We treat the DOM order as the truth of the stack.
    const allOverlays = Array.from(document.querySelectorAll('.article-overlay'));

    if (!targetId) {
        // Target is Home. We must ensure NO overlays are visible.
        // Close ALL overlays.
        allOverlays.forEach(overlay => closeOverlayInternal(overlay));
        return;
    }

    // Check if targetId exists in our current stack
    // We find the index of the overlay that represents the target URL
    const targetIndex = allOverlays.findIndex(overlay => overlay.dataset.id === targetId);

    if (targetIndex !== -1) {
        // Target IS in the stack.
        // We want to return TO this layer.
        // Ideally, this means closing everything ON TOP of it (indices > targetIndex).

        // Loop from the top down to the target (exclusive)
        for (let i = allOverlays.length - 1; i > targetIndex; i--) {
            closeOverlayInternal(allOverlays[i]);
        }

        // Just in case, ensure the target is marked active (should be already)
        if (!allOverlays[targetIndex].classList.contains('active')) {
            allOverlays[targetIndex].classList.add('active');
        }
    } else {
        // This covers browser Forward, or a history entry created before the
        // overlay existed in the current DOM.
        openArticleOverlay(targetId);
    }
});

// Make site-header clickable to return to homepage
document.querySelector('.site-header').addEventListener('click', () => {
    // Check if there are any overlays
    const overlays = document.querySelectorAll('.article-overlay');
    if (overlays.length > 0) {
        // Close all overlays and return to homepage
        closeAllOverlays();
    }
    // If already on homepage, do nothing
});

/**
 * Internal Close Helper (Does NOT touch History)
 * Used by popstate to reflect state change visually
 */
function closeOverlayInternal(overlay) {
    if (!overlay) return;
    overlay.classList.remove('active');
    setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (document.querySelectorAll('.article-overlay').length === 0) {
            unlockBodyScroll();
        }
    }, 400);
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check if loaded with ID (direct link)
    const params = new URLSearchParams(window.location.search);
    const initialId = params.get('id');
    // Initialize immediately in the LIFF browser. This must finish before we
    // rewrite a LIFF deep-link URL, because LIFF may temporarily add liff.*
    // parameters while establishing its session.
    const liffReady = isLikelyLineClient()
        ? prepareLiff().catch(error => {
            console.error('LIFF initialization failed', error);
            return null;
        })
        : Promise.resolve(null);

    // Fetch news first to populate background
    await fetchNews();
    addCardClickHandlers();

    // Add load more listener
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', handleLoadMore);
    }

    if (initialId) {
        await liffReady;
        // A LIFF/deep link has no in-app "home" history entry. Add one so the
        // left-edge gesture always returns to the news list rather than exiting.
        const homeUrl = new URL(window.location.href);
        homeUrl.searchParams.delete('id');
        history.replaceState({ articleOpen: false }, '', homeUrl);
        history.pushState({ articleOpen: true, articleId: initialId }, '', `?id=${encodeURIComponent(initialId)}`);
        openArticleOverlay(initialId);
    }
});
