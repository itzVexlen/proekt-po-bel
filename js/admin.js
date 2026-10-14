const categories = {
    sport: 'Спорт',
    science: 'Наука и открития',
    'young-scientists': 'Младите учени',
    'school-life': 'Училищен живот',
    achievements: 'Нашите успехи',
    creative: 'Творчески път'
};
const adminPassword = '244466666';
const githubRepository = 'itzVexlen/proekt-po-bel';
const githubBranch = 'main';
const githubContentRoot = 'js/content';
const authPanel = document.getElementById('auth-panel');
const authForm = document.getElementById('auth-form');
const workspace = document.getElementById('admin-workspace');
const authMessage = document.getElementById('auth-message');
let content = normalizeContent(window.siteContent || {});
let selectedPostImage = '';
let githubToken = '';
const remoteIndexes = {
    posts: { entries: [], sha: null },
    team: { entries: [], sha: null }
};
const remoteFiles = { posts: new Map(), team: new Map() };
let githubConnected = false;
let saveInProgress = false;

function normalizeContent(source) {
    return {
        posts: Array.isArray(source.posts) ? source.posts : [],
        team: Array.isArray(source.team) ? source.team.map(member => ({
            id: member.id,
            name: member.name,
            role: member.role,
            description: member.description || ''
        })) : []
    };
}

async function saveEntry(type, entry, message) {
    const status = document.getElementById('save-message');
    if (!githubConnected || !githubToken) {
        status.textContent = 'Свържи се с GitHub и зареди данните преди да записваш.';
        document.getElementById('github-token').focus();
        return false;
    }

    if (saveInProgress) return false;
    saveInProgress = true;
    status.textContent = 'Записване като commit в GitHub…';
    try {
        const previous = remoteFiles[type].get(String(entry.id));
        const name = type === 'posts' ? entry.title : entry.name;
        const path = previous ? previous.path : `${githubContentRoot}/${type}/${slugify(name)}-${entry.id}.json`;
        const fileResult = await putGitHubJson(path, entry, previous && previous.sha, message);
        remoteFiles[type].set(String(entry.id), { path, sha: fileResult.content.sha });

        const entries = remoteIndexes[type].entries.filter(item => String(item.id) !== String(entry.id));
        entries.unshift({ id: entry.id, path });
        const indexResult = await putGitHubJson(`${githubContentRoot}/${type}/index.json`, entries, remoteIndexes[type].sha, `Update ${type} index`);
        remoteIndexes[type] = { entries, sha: indexResult.content.sha };
        content[type] = [entry, ...content[type].filter(item => String(item.id) !== String(entry.id))];
        renderLists();
        status.textContent = `Записано в GitHub: ${path}. GitHub Pages ще обнови сайта след кратко изчакване.`;
        return true;
    } catch (error) {
        status.textContent = error.message || 'Неуспешна връзка с GitHub.';
        return false;
    } finally {
        saveInProgress = false;
    }
}

async function deleteEntry(type, id, message) {
    const status = document.getElementById('save-message');
    if (!githubConnected || !githubToken) {
        status.textContent = 'Свържи се с GitHub преди да изтриваш.';
        return false;
    }
    if (saveInProgress) return false;

    const file = remoteFiles[type].get(String(id));
    if (!file) {
        status.textContent = 'Не намерих JSON файла в GitHub. Свържи се отново и опитай пак.';
        return false;
    }

    saveInProgress = true;
    status.textContent = 'Изтриване от GitHub…';
    try {
        const response = await fetch(githubContentsUrl(file.path), {
            method: 'DELETE',
            headers: { ...githubHeaders(githubToken), 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, sha: file.sha, branch: githubBranch })
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `GitHub не изтри файла (HTTP ${response.status}).`);
        }
        remoteFiles[type].delete(String(id));
        const entries = remoteIndexes[type].entries.filter(item => String(item.id) !== String(id));
        const indexResult = await putGitHubJson(`${githubContentRoot}/${type}/index.json`, entries, remoteIndexes[type].sha, `Update ${type} index`);
        remoteIndexes[type] = { entries, sha: indexResult.content.sha };
        content[type] = content[type].filter(item => String(item.id) !== String(id));
        renderLists();
        status.textContent = 'Изтрито от GitHub; сайтът ще се обнови след публикуването от Pages.';
        return true;
    } catch (error) {
        status.textContent = error.message || 'Неуспешна връзка с GitHub.';
        return false;
    } finally {
        saveInProgress = false;
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
document.getElementById('post-form').addEventListener('submit', async event => {
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
    const saved = await saveEntry('posts', post, previous ? `Update post: ${post.title}` : `Add post: ${post.title}`);
    if (saved) clearPostForm();
});

document.getElementById('team-form').addEventListener('submit', async event => {
    event.preventDefault();
    const idValue = document.getElementById('team-id').value;
    const previous = content.team.find(member => String(member.id) === idValue);
    const member = {
        id: previous ? previous.id : Date.now(),
        name: document.getElementById('team-name').value.trim(),
        role: document.getElementById('team-role').value.trim(),
        description: document.getElementById('team-description').value.trim()
    };
    const saved = await saveEntry('team', member, previous ? `Update team member: ${member.name}` : `Add team member: ${member.name}`);
    if (saved) clearTeamForm();
});

document.getElementById('post-list').addEventListener('click', async event => {
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
        await deleteEntry('posts', deleteId, 'Delete newspaper post');
    }
});

document.getElementById('team-list').addEventListener('click', async event => {
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
        await deleteEntry('team', deleteId, 'Delete newspaper team member');
    }
});

document.getElementById('cancel-post-edit').addEventListener('click', clearPostForm);
document.getElementById('cancel-team-edit').addEventListener('click', clearTeamForm);
document.getElementById('lock-button').addEventListener('click', () => {
    window.location.reload();
});

function githubHeaders(token) {
    return {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
    };
}

function githubContentsUrl(path) {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    return `https://api.github.com/repos/${githubRepository}/contents/${encodedPath}`;
}

function slugify(value) {
    return String(value || 'entry').toLocaleLowerCase().trim()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-|-$/g, '') || 'entry';
}

function decodeGitHubContent(encoded) {
    const binary = atob(encoded.replace(/\s/g, ''));
    return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
}

async function readGitHubJson(path, allowMissing = true) {
    const response = await fetch(`${githubContentsUrl(path)}?ref=${githubBranch}`, {
        headers: githubHeaders(githubToken),
        cache: 'no-store'
    });
    if (response.status === 404 && allowMissing) return { value: [], sha: null };
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `GitHub не успя да прочете ${path} (HTTP ${response.status}).`);
    }
    const file = await response.json();
    return { value: JSON.parse(decodeGitHubContent(file.content)), sha: file.sha };
}

async function putGitHubJson(path, value, sha, message) {
    const bytes = new TextEncoder().encode(`${JSON.stringify(value, null, 4)}\n`);
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    const body = { message, content: btoa(binary), branch: githubBranch };
    if (sha) body.sha = sha;
    const response = await fetch(githubContentsUrl(path), {
        method: 'PUT',
        headers: { ...githubHeaders(githubToken), 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(response.status === 409 || response.status === 422
            ? 'GitHub има по-нова промяна. Свържи се отново и опитай пак.'
            : error.message || `GitHub не записа ${path} (HTTP ${response.status}).`);
    }
    return response.json();
}

document.getElementById('connect-github-button').addEventListener('click', connectToGitHub);

async function connectToGitHub() {
    const tokenInput = document.getElementById('github-token');
    const token = tokenInput.value.trim();
    const connectButton = document.getElementById('connect-github-button');
    const status = document.getElementById('save-message');
    if (!token) {
        status.textContent = 'Постави GitHub token, за да заредиш съдържанието от repository.';
        tokenInput.focus();
        return;
    }

    connectButton.disabled = true;
    status.textContent = 'Зареждане на последното съдържание от GitHub…';
    githubToken = token;
    try {
        const kinds = ['posts', 'team'];
        const loaded = await Promise.all(kinds.map(async type => {
            const index = await readGitHubJson(`${githubContentRoot}/${type}/index.json`);
            const entries = Array.isArray(index.value) ? index.value : [];
            const files = await Promise.all(entries.map(async reference => {
                const result = await readGitHubJson(reference.path, false);
                remoteFiles[type].set(String(result.value.id), { path: reference.path, sha: result.sha });
                return result.value;
            }));
            remoteIndexes[type] = { entries, sha: index.sha };
            return [type, files];
        }));

        content = normalizeContent(Object.fromEntries(loaded));
        githubConnected = true;
        window.siteContent = content;
        renderLists();
        status.textContent = 'Свързано. Данните са заредени от GitHub; всеки запис създава JSON файл и commit.';
    } catch (error) {
        githubConnected = false;
        githubToken = '';
        status.textContent = error.message || 'Неуспешна връзка с GitHub. Провери token-а и интернет връзката.';
    } finally {
        connectButton.disabled = false;
    }
}
document.getElementById('backup-button').addEventListener('click', () => {
    downloadFile('newspaper-content.json', JSON.stringify(content, null, 2), 'application/json');
});
document.getElementById('import-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const imported = JSON.parse(await file.text());
        if (!Array.isArray(imported.posts) || !Array.isArray(imported.team)) throw new Error('Invalid content');
        for (const post of imported.posts) {
            if (!await saveEntry('posts', post, `Import post: ${post.title}`)) return;
        }
        for (const member of imported.team) {
            if (!await saveEntry('team', member, `Import team member: ${member.name}`)) return;
        }
        document.getElementById('save-message').textContent = 'JSON записите са публикувани в GitHub.';
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
