const categories = {
    sport: 'Спорт',
    science: 'Наука и открития',
    'young-scientists': 'Младите учени',
    'school-life': 'Училищен живот',
    achievements: 'Нашите успехи',
    creative: 'Творчески път'
};
const contentKey = 'newspaper-content';
const adminPassword = '244466666';
const authPanel = document.getElementById('auth-panel');
const authForm = document.getElementById('auth-form');
const workspace = document.getElementById('admin-workspace');
const authMessage = document.getElementById('auth-message');
let content = loadContent();
let selectedPostImage = '';

function loadContent() {
    try {
        const saved = localStorage.getItem(contentKey);
        const source = saved ? JSON.parse(saved) : (window.siteContent || {});
        return {
            posts: Array.isArray(source.posts) ? source.posts : [],
            team: Array.isArray(source.team) ? source.team.map(member => ({
                id: member.id,
                name: member.name,
                role: member.role,
                description: member.description || ''
            })) : []
        };
    } catch {
        return { posts: [], team: [] };
    }
}

function saveContent(message = 'Промените са записани в този браузър.') {
    try {
        localStorage.setItem(contentKey, JSON.stringify(content));
        document.getElementById('save-message').textContent = message;
        renderLists();
    } catch {
        document.getElementById('save-message').textContent = 'Неуспешен запис. Намали размера на снимките или изтегли резервно копие.';
    }
}

function unlock() {
    authPanel.hidden = true;
    workspace.hidden = false;
    document.getElementById('lock-button').hidden = false;
    renderLists();
}

function initializeAuth() {
    document.getElementById('auth-title').textContent = 'Вход за редактори';
    document.getElementById('auth-description').textContent = 'Въведи паролата, за да управляваш съдържанието.';
    document.getElementById('auth-submit').textContent = 'Отключи редактора';

    authForm.addEventListener('submit', event => {
        event.preventDefault();
        const password = document.getElementById('admin-password').value;
        if (password !== adminPassword) {
            authMessage.textContent = 'Паролата е неправилна.';
            return;
        }
        unlock();
    });
}

function readImage(input, callback, messageElement) {
    const file = input.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
        messageElement.textContent = 'Избери PNG, JPEG, WebP или GIF изображение.';
        input.value = '';
        return;
    }
    if (file.size > 700 * 1024) {
        messageElement.textContent = 'Снимката е по-голяма от 700 KB. Намали размера ѝ и опитай отново.';
        input.value = '';
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        callback(String(reader.result));
        messageElement.textContent = '';
    };
    reader.onerror = () => { messageElement.textContent = 'Снимката не може да бъде прочетена.'; };
    reader.readAsDataURL(file);
}

function setPreview(elementId, source) {
    const container = document.getElementById(elementId);
    if (!source) {
        container.hidden = true;
        container.replaceChildren();
        return;
    }
    const image = document.createElement('img');
    image.src = source;
    image.alt = 'Преглед на избраната снимка';
    container.replaceChildren(image);
    container.hidden = false;
}

function renderLists() {
    document.getElementById('post-count').textContent = `${content.posts.length} общо`;
    document.getElementById('team-count').textContent = `${content.team.length} общо`;
    document.getElementById('post-list').innerHTML = content.posts.length ? content.posts.map(post => `
        <article class="admin-list-item"><div><h4>${escapeHtml(post.title)}</h4><p>${escapeHtml(categories[post.category] || post.categoryName || '')} · ${escapeHtml(post.date || '')}</p></div><div class="item-actions"><button class="small-button" data-edit-post="${post.id}" type="button">Редактирай</button><button class="small-button danger-button" data-delete-post="${post.id}" type="button">Изтрий</button></div></article>
    `).join('') : '<p class="form-note">Няма записани статии.</p>';
    document.getElementById('team-list').innerHTML = content.team.length ? content.team.map(member => `
        <article class="admin-list-item"><div><h4>${escapeHtml(member.name)}</h4><p>${escapeHtml(member.role)}</p></div><div class="item-actions"><button class="small-button" data-edit-team="${member.id}" type="button">Редактирай</button><button class="small-button danger-button" data-delete-team="${member.id}" type="button">Изтрий</button></div></article>
    `).join('') : '<p class="form-note">Няма добавени членове.</p>';
}

function escapeHtml(value) {
    const node = document.createElement('span');
    node.textContent = String(value || '');
    return node.innerHTML;
}

function clearPostForm() {
    document.getElementById('post-form').reset();
    document.getElementById('post-id').value = '';
    document.getElementById('post-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('post-form-title').textContent = 'Нова статия';
    document.getElementById('cancel-post-edit').hidden = true;
    document.getElementById('remove-post-image').checked = false;
    selectedPostImage = '';
    setPreview('post-image-preview', '');
}

function clearTeamForm() {
    document.getElementById('team-form').reset();
    document.getElementById('team-id').value = '';
    document.getElementById('team-form-title').textContent = 'Добави член на екипа';
    document.getElementById('cancel-team-edit').hidden = true;
}

document.getElementById('post-date').value = new Date().toISOString().slice(0, 10);
document.getElementById('post-image').addEventListener('change', event => readImage(event.target, image => {
    selectedPostImage = image;
    setPreview('post-image-preview', image);
}, document.getElementById('post-message')));
document.getElementById('post-form').addEventListener('submit', event => {
    event.preventDefault();
    const idValue = document.getElementById('post-id').value;
    const previous = content.posts.find(post => String(post.id) === idValue);
    const category = document.getElementById('post-category').value;
    const post = {
        id: previous ? previous.id : Date.now(),
        title: document.getElementById('post-title').value.trim(),
        category,
        categoryName: categories[category],
        excerpt: document.getElementById('post-excerpt').value.trim(),
        content: document.getElementById('post-content').value.trim(),
        date: document.getElementById('post-date').value,
        author: document.getElementById('post-author').value.trim(),
        image: document.getElementById('remove-post-image').checked ? '' : (selectedPostImage || (previous && previous.image) || ''),
        imageCaption: document.getElementById('post-image-caption').value.trim(),
        imageAlt: document.getElementById('post-title').value.trim()
    };
    content.posts = [post, ...content.posts.filter(item => item.id !== post.id)];
    saveContent(previous ? 'Статията е обновена.' : 'Статията е добавена.');
    clearPostForm();
});

document.getElementById('team-form').addEventListener('submit', event => {
    event.preventDefault();
    const idValue = document.getElementById('team-id').value;
    const previous = content.team.find(member => String(member.id) === idValue);
    const member = {
        id: previous ? previous.id : Date.now(),
        name: document.getElementById('team-name').value.trim(),
        role: document.getElementById('team-role').value.trim(),
        description: document.getElementById('team-description').value.trim()
    };
    content.team = [...content.team.filter(item => item.id !== member.id), member];
    saveContent(previous ? 'Членът на екипа е обновен.' : 'Членът на екипа е добавен.');
    clearTeamForm();
});

document.getElementById('post-list').addEventListener('click', event => {
    const editId = event.target.dataset.editPost;
    const deleteId = event.target.dataset.deletePost;
    if (editId) {
        const post = content.posts.find(item => String(item.id) === editId);
        if (!post) return;
        document.getElementById('post-id').value = post.id;
        document.getElementById('post-title').value = post.title;
        document.getElementById('post-category').value = post.category;
        document.getElementById('post-date').value = post.date;
        document.getElementById('post-author').value = post.author || '';
        document.getElementById('post-excerpt').value = post.excerpt;
        document.getElementById('post-content').value = post.content;
        document.getElementById('post-image-caption').value = post.imageCaption || '';
        selectedPostImage = post.image || '';
        setPreview('post-image-preview', selectedPostImage);
        document.getElementById('post-form-title').textContent = 'Редактирай статия';
        document.getElementById('cancel-post-edit').hidden = false;
        document.getElementById('post-form').scrollIntoView({ behavior: 'smooth' });
    }
    if (deleteId && confirm('Да изтрия ли тази статия?')) {
        content.posts = content.posts.filter(item => String(item.id) !== deleteId);
        saveContent('Статията е изтрита.');
    }
});

document.getElementById('team-list').addEventListener('click', event => {
    const editId = event.target.dataset.editTeam;
    const deleteId = event.target.dataset.deleteTeam;
    if (editId) {
        const member = content.team.find(item => String(item.id) === editId);
        if (!member) return;
        document.getElementById('team-id').value = member.id;
        document.getElementById('team-name').value = member.name;
        document.getElementById('team-role').value = member.role;
        document.getElementById('team-description').value = member.description || '';
        document.getElementById('team-form-title').textContent = 'Редактирай член на екипа';
        document.getElementById('cancel-team-edit').hidden = false;
        document.getElementById('team-form').scrollIntoView({ behavior: 'smooth' });
    }
    if (deleteId && confirm('Да изтрия ли този член на екипа?')) {
        content.team = content.team.filter(item => String(item.id) !== deleteId);
        saveContent('Членът на екипа е изтрит.');
    }
});

document.getElementById('cancel-post-edit').addEventListener('click', clearPostForm);
document.getElementById('cancel-team-edit').addEventListener('click', clearTeamForm);
document.getElementById('lock-button').addEventListener('click', () => {
    window.location.reload();
});

document.getElementById('publish-button').addEventListener('click', () => {
    downloadFile('content-data.js', `window.siteContent = ${JSON.stringify(content, null, 4)};\n`, 'text/javascript');
    document.getElementById('save-message').textContent = 'Файлът е готов. Замени js/content-data.js в проекта с изтегления файл и публикувай сайта.';
});
document.getElementById('backup-button').addEventListener('click', () => {
    downloadFile('newspaper-content.json', JSON.stringify(content, null, 2), 'application/json');
});
document.getElementById('import-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const imported = JSON.parse(await file.text());
        if (!Array.isArray(imported.posts) || !Array.isArray(imported.team)) throw new Error('Invalid content');
        content = imported;
        saveContent('Съдържанието е импортирано.');
    } catch {
        document.getElementById('save-message').textContent = 'Файлът не е валиден JSON архив на съдържанието.';
    }
    event.target.value = '';
});

function downloadFile(filename, contents, mimeType) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([contents], { type: `${mimeType};charset=utf-8` }));
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

initializeAuth();
