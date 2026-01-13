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
};