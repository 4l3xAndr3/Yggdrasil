/**
 * YGGDRASIL - Navigation & Gestion Globale
 */

// Charge la sidebar sur toutes les pages
async function includeSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    try {
        const response = await fetch('/sidebar.html');
        container.innerHTML = await response.text();
        await updateSidebarContent();
    } catch (err) {
        console.error("Erreur chargement sidebar:", err);
    }
}

// Remplit la liste des projets dans la sidebar
async function updateSidebarContent() {
    try {
        const token = localStorage.getItem('yggdrasil_token');
        if (!token) return;

        const resHome = await fetch('/api/dashboard-home', { headers: { 'Authorization': 'Bearer ' + token } });
        if (!resHome.ok) return; // Silent fail or redirect?
        const homeData = await resHome.json();
        const favId = homeData.favorite ? homeData.favorite.id : null;

        const resList = await fetch('/api/projects-list', { headers: { 'Authorization': 'Bearer ' + token } });
        const projects = await resList.json();

        const sideMenu = document.getElementById('side-menu-projects');
        if (!sideMenu) return;

        sideMenu.innerHTML = projects
            .sort((a, b) => (a.id === favId ? -1 : 1)) // Favori toujours en haut
            .map(p => `
                <a href="/project.html?name=${encodeURIComponent(p.name)}" class="flex items-center gap-3 p-3 rounded-xl text-sm transition ${p.id === favId ? 'text-emerald-400 font-bold bg-emerald-500/5 border border-emerald-500/10' : 'text-slate-500 hover:text-white hover:bg-white/5'}">
                    <i class="fa-solid ${p.id === favId ? 'fa-star text-yellow-500' : 'fa-folder'} w-5"></i>
                    ${p.name}
                </a>
            `).join('');
    } catch (err) { console.error("Erreur sidebar content:", err); }
}

// --- GESTION DE LA POP-UP (MODAL) ---

function openProjectModal() {
    const modal = document.getElementById('project-modal');
    modal.classList.remove('hidden');
    document.getElementById('modal-project-name').focus();
}

function closeProjectModal() {
    const modal = document.getElementById('project-modal');
    modal.classList.add('hidden');
    // Reset des champs
    document.getElementById('modal-project-name').value = '';
    document.getElementById('modal-project-desc').value = '';
}

async function submitNewProject() {
    const name = document.getElementById('modal-project-name').value.trim();
    const description = document.getElementById('modal-project-desc').value.trim();
    const token = localStorage.getItem('yggdrasil_token');

    if (!name) return alert("Le nom est requis");

    try {
        const response = await fetch('/api/projects/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ name, description })
        });

        if (response.ok) {
            // Redirection immédiate vers le nouveau projet
            window.location.href = `/project.html?name=${encodeURIComponent(name)}`;
        }
    } catch (err) {
        console.error("Erreur création:", err);
    }
}

// Fermeture de la modal au clic extérieur
window.onclick = function (event) {
    const modal = document.getElementById('project-modal');
    if (event.target == modal) closeProjectModal();

    const ghModal = document.getElementById('github-modal');
    if (event.target == ghModal) closeGithubModal();
};


// --- GESTION IMPORT GITHUB ---

let selectedRepos = new Set();

function openGithubModal() {
    document.getElementById('github-modal').classList.remove('hidden');
    selectedRepos.clear();
    fetchGithubRepos();
}

function closeGithubModal() {
    document.getElementById('github-modal').classList.add('hidden');
}

async function fetchGithubRepos() {
    const loading = document.getElementById('github-loading');
    const content = document.getElementById('github-content');
    const errorDiv = document.getElementById('github-error');
    const list = document.getElementById('github-repos-list');
    const token = localStorage.getItem('yggdrasil_token');

    loading.classList.remove('hidden');
    content.classList.add('hidden');
    errorDiv.classList.add('hidden');

    try {
        const response = await fetch('/api/github/repos', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Erreur inconnue');
        }

        const repos = await response.json();

        list.innerHTML = repos.map(repo => `
            <div class="flex items-center gap-4 p-4 rounded-xl bg-slate-900/50 border border-white/5 hover:border-emerald-500/30 transition cursor-pointer" 
                 onclick="toggleRepoSelection(this, '${repo.name}', '${repo.description ? repo.description.replace(/'/g, "&apos;") : ""}', '${repo.html_url}')">
                <div class="repo-checkbox w-5 h-5 rounded border border-slate-600 flex items-center justify-center transition">
                    <i class="fa-solid fa-check text-xs text-black opacity-0 transition"></i>
                </div>
                <div class="overflow-hidden">
                    <h4 class="font-bold text-sm text-white truncate">${repo.name}</h4>
                    <p class="text-xs text-slate-500 truncate">${repo.description || 'Pas de description'}</p>
                </div>
                <i class="fa-brands fa-github ml-auto text-slate-700 text-lg"></i>
            </div>
        `).join('');

        loading.classList.add('hidden');
        content.classList.remove('hidden');

    } catch (err) {
        loading.classList.add('hidden');
        errorDiv.classList.remove('hidden');
        document.getElementById('github-error-msg').innerText = err.message;
    }
}

function toggleRepoSelection(el, name, description, url) {
    const checkbox = el.querySelector('.repo-checkbox');
    const checkIcon = checkbox.querySelector('.fa-check');
    const repoData = { name, description, html_url: url };

    // We use JSON stringify to store object in Set is tricky, so we map by name
    if (el.classList.contains('border-emerald-500')) {
        // Deselect
        el.classList.remove('border-emerald-500', 'bg-emerald-500/10');
        el.classList.add('bg-slate-900/50');
        checkbox.classList.remove('bg-emerald-500', 'border-emerald-500');
        checkbox.classList.add('border-slate-600');
        checkIcon.classList.add('opacity-0');

        // Remove from set (find by name)
        for (let item of selectedRepos) {
            if (item.name === name) selectedRepos.delete(item);
        }
    } else {
        // Select
        el.classList.add('border-emerald-500', 'bg-emerald-500/10');
        el.classList.remove('bg-slate-900/50');
        checkbox.classList.add('bg-emerald-500', 'border-emerald-500');
        checkbox.classList.remove('border-slate-600');
        checkIcon.classList.remove('opacity-0');

        selectedRepos.add(repoData);
    }
}

async function submitGithubImport() {
    if (selectedRepos.size === 0) return alert("Aucun projet sélectionné");

    const token = localStorage.getItem('yggdrasil_token');
    const btn = document.querySelector('#github-content button');
    const originalText = btn.innerText;

    btn.disabled = true;
    btn.innerText = "IMPORTATION...";

    try {
        const response = await fetch('/api/projects/import-github', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ repos: Array.from(selectedRepos) })
        });

        const res = await response.json();

        if (response.ok) {
            closeGithubModal();
            updateSidebarContent(); // Update sidebar list
            // If on projects page, reload
            if (window.location.pathname.includes('projects.html')) {
                window.location.reload();
            } else {
                // Relocate to dashboard or first imported project? Layout refresh is safer
                window.location.reload();
            }
        } else {
            alert("Erreur: " + res.error);
        }

    } catch (err) {
        console.error(err);
        alert("Erreur lors de l'import");
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}