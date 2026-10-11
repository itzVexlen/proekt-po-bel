const publishedContent = window.siteContent || { posts: [], team: [] };
const localContent = readSavedContent();
let posts = localContent ? localContent.posts : publishedContent.posts;
let teamMembers = localContent ? localContent.team : (publishedContent.team || []);

function readSavedContent() {
    try {
        const saved = localStorage.getItem('newspaper-content');
        return saved ? JSON.parse(saved) : null;
    } catch {
        return null;
    }
}

// Get posts by category
function getPostsByCategory(categorySlug) {
    return posts.filter(post => post.category === categorySlug);
}

// Get latest posts (up to 3)
function getLatestPosts() {
    return posts.slice(0, 3);
}

// Render latest posts on homepage
function renderLatestPosts() {
    const container = document.getElementById('latest-posts');
    if (!container) return;
    
    const latest = getLatestPosts();
    
    if (latest.length === 0) {
        container.innerHTML = `
            <article class="post-card empty-state">
                <h3>Все още няма публикации</h3>
                <p>Тук ще се показват най-новите статии от всички рубрики.</p>
            </article>
        `;
        return;
    }
    
    container.innerHTML = latest.map(post => `
        <article class="post-card">
            ${renderPostImage(post, 'post-card-image')}
            <div class="post-card-category">${post.categoryName}</div>
            <h3 class="post-card-title">
                <a href="post.html?id=${post.id}">${escapeHtml(post.title)}</a>
            </h3>
            <div class="post-card-meta">
                <span class="post-card-date">${formatDate(post.date)}</span>
                ${post.author ? `<span class="post-card-author">• ${escapeHtml(post.author)}</span>` : ''}
            </div>
            <p class="post-card-excerpt">${escapeHtml(post.excerpt)}</p>
            <a href="post.html?id=${post.id}" class="read-more">Прочети повече →</a>
        </article>
    `).join('');
}

// Render posts in a category page
function renderCategoryPosts(categorySlug, categoryName) {
    const container = document.getElementById('category-posts');
    if (!container) return;
    
    const categoryPosts = getPostsByCategory(categorySlug);
    
    if (categoryPosts.length === 0) {
        container.innerHTML = `
            <article class="article-item empty-state">
                <h3>Все още няма публикации в тази рубрика</h3>
                <p>Ще бъдат добавени скоро.</p>
            </article>
        `;
        return;
    }
    
    container.innerHTML = categoryPosts.map(post => `
        <article class="article-item">
            ${renderPostImage(post, 'article-item-image')}
            <h2>
                <a href="../post.html?id=${post.id}">${escapeHtml(post.title)}</a>
            </h2>
            <div class="article-meta">
                <span class="article-date">${formatDate(post.date)}</span>
                ${post.author ? `<span class="article-author">• ${escapeHtml(post.author)}</span>` : ''}
            </div>
            <p class="article-excerpt">${escapeHtml(post.excerpt)}</p>
            <a href="../post.html?id=${post.id}" class="read-more">Прочети цялата статия</a>
        </article>
    `).join('');
}

// Render a single post
function renderPost() {
    const container = document.getElementById('post-content');
    if (!container) return;
    
    const params = new URLSearchParams(window.location.search);
    const postId = parseInt(params.get('id'));
    
    const post = posts.find(p => p.id === postId);
    
    if (!post) {
        container.innerHTML = `
            <div class="article-header">
                <h1>Статията не е намерена</h1>
            </div>
            <div class="article-content">
                <p>Тази статия не съществува или е била преместена.</p>
                <p><a href="index.html">Обратно към началото</a></p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div class="article-header">
            <div class="breadcrumb">
                <a href="index.html">Начало</a> / 
                <a href="categories/${post.category}.html">${escapeHtml(post.categoryName)}</a> / 
                <span>${escapeHtml(post.title)}</span>
            </div>
            <h1>${escapeHtml(post.title)}</h1>
            <div class="article-meta">
                <span class="article-date">${formatDate(post.date)}</span>
                ${post.author ? `<span class="article-author">• ${escapeHtml(post.author)}</span>` : ''}
                <span class="article-category">• <a href="categories/${post.category}.html">${escapeHtml(post.categoryName)}</a></span>
            </div>
        </div>
        ${renderPostImage(post, 'article-hero-image')}
        <div class="article-content">
            ${formatContent(post.content)}
        </div>
    `;
}

function renderTeamMembers() {
    const container = document.getElementById('team-members');
    if (!container) return;

    if (teamMembers.length === 0) {
        container.innerHTML = '<p class="empty-state">Все още няма добавени членове на екипа.</p>';
        return;
    }

    container.innerHTML = teamMembers.map(member => `
        <article class="team-member">
            <h3>${escapeHtml(member.name)}</h3>
            <p class="team-member-role">${escapeHtml(member.role)}</p>
            ${member.description ? `<p class="team-member-description">${escapeHtml(member.description)}</p>` : ''}
        </article>
    `).join('');
}

function renderPostImage(post, className) {
    const source = safeImageSource(post.image);
    if (!source) return '';
    const caption = post.imageCaption ? `<figcaption>${escapeHtml(post.imageCaption)}</figcaption>` : '';
    return `<figure class="${className}"><img src="${source}" alt="${escapeHtml(post.imageAlt || post.title)}">${caption}</figure>`;
}

function safeImageSource(source) {
    if (typeof source !== 'string') return '';
    if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(source)) return escapeHtml(source);
    if (/^https?:\/\//i.test(source)) return escapeHtml(source);
    return '';
}

// Format date to Bulgarian format
function formatDate(dateString) {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('bg-BG', options);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Format content - convert newlines to paragraphs and handle basic markdown-like formatting
function formatContent(content) {
    return String(content || '').split('\n\n').map(paragraph => {
        const lines = paragraph.split('\n').map(line => line.trim()).filter(Boolean);
        if (lines.length && lines.every(line => /^[-•]\s/.test(line))) {
            return `<ul>${lines.map(line => `<li>${escapeHtml(line.replace(/^[-•]\s/, ''))}</li>`).join('')}</ul>`;
        }
        if (lines.length && lines.every(line => /^\d+\.\s/.test(line))) {
            return `<ol>${lines.map(line => `<li>${escapeHtml(line.replace(/^\d+\.\s/, ''))}</li>`).join('')}</ol>`;
        }
        return lines.length ? `<p>${lines.map(escapeHtml).join('<br>')}</p>` : '';
    }).join('\n');
}

// Initialize based on page
document.addEventListener('DOMContentLoaded', function() {
    // Check which page we're on
    const pageTitle = document.title;
    
    if (pageTitle.includes('Начало') || pageTitle === 'Гео Милев: Отвъд дъската') {
        renderLatestPosts();
    }
    
    // Category pages
    if (pageTitle.includes('Спорт')) {
        renderCategoryPosts('sport', 'Спорт');
    } else if (pageTitle.includes('Наука и открития')) {
        renderCategoryPosts('science', 'Наука и открития');
    } else if (pageTitle.includes('Младите учени')) {
        renderCategoryPosts('young-scientists', 'Младите учени');
    } else if (pageTitle.includes('Училищен живот')) {
        renderCategoryPosts('school-life', 'Училищен живот');
    } else if (pageTitle.includes('Нашите успехи')) {
        renderCategoryPosts('achievements', 'Нашите успехи');
    } else if (pageTitle.includes('Творчески път')) {
        renderCategoryPosts('creative', 'Творчески път');
    }
    
    // Post page
    if (pageTitle.includes('Публикация') || document.getElementById('post-content')) {
        renderPost();
    }

    renderTeamMembers();
});
