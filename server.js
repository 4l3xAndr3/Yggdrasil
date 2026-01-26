require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const { pool, testConnection } = require('./config/database');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(cors());

// --- GEMINI CONFIG ---
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "API_KEY_MISSING");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// --- AUTHENTICATION GITHUB ---

// 1. Redirect to GitHub
app.get('/api/auth/github', (req, res) => {
    const baseUrl = process.env.APP_URL || 'http://localhost:3000';
    const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${baseUrl}/api/auth/github/callback&scope=read:user`;
    res.redirect(url);
});

// 2. Callback from GitHub
app.get('/api/auth/github/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('No code provided');

    try {
        // Exchange code for token
        const tokenRes = await axios.post('https://github.com/login/oauth/access_token', {
            client_id: process.env.GITHUB_CLIENT_ID,
            client_secret: process.env.GITHUB_CLIENT_SECRET,
            code: code
        }, { headers: { Accept: 'application/json' } });

        const accessToken = tokenRes.data.access_token;
        if (!accessToken) return res.status(400).send('Authentication failed');

        // Get User Info
        const userRes = await axios.get('https://api.github.com/user', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const githubUser = userRes.data;

        try {
            // Ensure Users Table Exists (Moved to init but kept here for safety in auth flow for now or just trust init)
            // Ideally init handles this, but for now let's use the pool

            // Upsert User
            const [rows] = await pool.execute('SELECT * FROM users WHERE github_id = ?', [githubUser.id]);
            let userId;

            if (rows.length === 0) {
                const [result] = await pool.execute(
                    'INSERT INTO users (github_id, username, avatar_url, github_access_token) VALUES (?, ?, ?, ?)',
                    [githubUser.id, githubUser.login, githubUser.avatar_url, accessToken]
                );
                userId = result.insertId;
            } else {
                userId = rows[0].id;
                await pool.execute(
                    'UPDATE users SET username = ?, avatar_url = ?, github_access_token = ? WHERE id = ?',
                    [githubUser.login, githubUser.avatar_url, accessToken, userId]
                );
            }

            // Generate JWT
            const token = jwt.sign(
                { id: userId, username: githubUser.login, avatar: githubUser.avatar_url },
                process.env.JWT_SECRET || 'secret',
                { expiresIn: '24h' }
            );

            res.redirect(`/?token=${token}`);

        } catch (dbErr) {
            console.error('DB Error:', dbErr);
            res.status(500).send('Database Error');
        }

    } catch (err) {
        console.error('Auth Error:', err.message);
        res.status(500).send('Authentication Error');
    }
});

app.get('/api/me', (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        res.json(decoded);
    } catch (err) {
        res.status(401).json({ error: 'Invalid token' });
    }
});

// --- MIDDLEWARE AUTH ---
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET || 'secret', (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// --- LOGIQUE DE CALCUL AUTOMATIQUE DU POURCENTAGE ---
async function updateProjectProgress(projectId) {
    const [stats] = await pool.execute(
        'SELECT COUNT(*) as total, SUM(CASE WHEN status = "done" THEN 1 ELSE 0 END) as done FROM tasks WHERE project_id = ?',
        [projectId]
    );
    const total = stats[0].total || 0;
    const done = stats[0].done || 0;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    await pool.execute('UPDATE projects SET progress = ? WHERE id = ?', [progress, projectId]);
}

// --- LOGS & ANTIGRAVITY API (SECURED) ---

app.get('/api/projects/:id/logs', authenticateToken, async (req, res) => {
    try {
        const [proj] = await pool.execute('SELECT user_id FROM projects WHERE id = ?', [req.params.id]);
        if (proj.length === 0 || (proj[0].user_id && proj[0].user_id !== req.user.id)) return res.sendStatus(403);

        const [rows] = await pool.execute('SELECT * FROM project_logs WHERE project_id = ? ORDER BY created_at DESC', [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/logs', authenticateToken, async (req, res) => {
    const { project_id, content, entry_type } = req.body;
    try {
        const [proj] = await pool.execute('SELECT user_id FROM projects WHERE id = ?', [project_id]);
        if (proj.length === 0 || (proj[0].user_id && proj[0].user_id !== req.user.id)) return res.sendStatus(403);

        await pool.execute(
            'INSERT INTO project_logs (project_id, content, entry_type) VALUES (?, ?, ?)',
            [project_id, content, entry_type || 'log']
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Antigravity Push (API Key - Public/Admin Agent access)
app.post('/api/antigravity/push', async (req, res) => {
    const apiKey = req.headers['x-antigravity-key'];
    if (apiKey !== process.env.ANTIGRAVITY_KEY) return res.status(403).json({ error: 'Unauthorized' });

    const { project_name, content, type } = req.body;
    if (!project_name || !content) return res.status(400).json({ error: 'Missing data' });

    try {
        const [projects] = await pool.execute('SELECT id FROM projects WHERE name LIKE ? LIMIT 1', [project_name]);

        if (projects.length === 0) return res.status(404).json({ error: 'Project not found' });

        await pool.execute(
            'INSERT INTO project_logs (project_id, content, entry_type) VALUES (?, ?, ?)',
            [projects[0].id, content, type || 'antigravity']
        );
        res.json({ success: true });

    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- CLIENT DATA ROUTES (SECURED) ---

app.post('/api/projects/create', authenticateToken, async (req, res) => {
    const { name, description } = req.body;
    try {
        await pool.execute('INSERT INTO projects (user_id, name, description, status, progress) VALUES (?, ?, ?, "En cours", 0)', [req.user.id, name, description || ""]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- GITHUB IMPORT ROUTES ---

app.get('/api/github/repos', authenticateToken, async (req, res) => {
    try {
        // Recuperer le token github de l'utilisateur
        const [rows] = await pool.execute('SELECT github_access_token FROM users WHERE id = ?', [req.user.id]);
        if (rows.length === 0 || !rows[0].github_access_token) {
            return res.status(400).json({ error: 'GitHub Not Connected' });
        }

        const ghToken = rows[0].github_access_token;

        // Appeler GitHub API
        const ghRes = await axios.get('https://api.github.com/user/repos?sort=updated&per_page=100', {
            headers: {
                Authorization: `Bearer ${ghToken}`,
                Accept: 'application/vnd.github.v3+json'
            }
        });

        // Filtrer / Mapper les données
        const repos = ghRes.data.map(repo => ({
            id: repo.id,
            name: repo.name,
            description: repo.description,
            html_url: repo.html_url,
            private: repo.private
        }));

        res.json(repos);

    } catch (err) {
        console.error("Github Import Error:", err.message);
        if (err.response && err.response.status === 401) {
            return res.status(401).json({ error: 'GitHub Token Invalid' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/projects/import-github', authenticateToken, async (req, res) => {
    const { repos } = req.body; // Array of { name, description, html_url }
    if (!repos || !Array.isArray(repos)) return res.status(400).json({ error: 'Invalid data' });

    let importedCount = 0;
    const errors = [];

    try {
        for (let repo of repos) {
            // Check doublons
            const [existing] = await pool.execute('SELECT id FROM projects WHERE name = ? AND user_id = ?', [repo.name, req.user.id]);

            if (existing.length === 0) {
                await pool.execute(
                    'INSERT INTO projects (user_id, name, description, status, progress) VALUES (?, ?, ?, "En cours", 0)',
                    [req.user.id, repo.name, repo.description || "Importé depuis GitHub"]
                );
                importedCount++;
            }
        }
        res.json({ success: true, count: importedCount });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/projects-list', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT id, name, status FROM projects WHERE user_id = ? ORDER BY name ASC', [req.user.id]);
        res.json(rows);
    } catch (err) { res.status(500).send(err.message); }
});

app.get('/api/dashboard-home', authenticateToken, async (req, res) => {
    try {
        const [count] = await pool.execute('SELECT COUNT(*) as total FROM projects WHERE user_id = ?', [req.user.id]);
        const [fav] = await pool.execute('SELECT * FROM projects WHERE is_favorite = 1 AND user_id = ? LIMIT 1', [req.user.id]);
        const [recent] = await pool.execute('SELECT name, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT 4', [req.user.id]);
        res.json({ totalActive: count[0].total, favorite: fav[0] || null, recent });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/project-details/:name', authenticateToken, async (req, res) => {
    try {
        const [projects] = await pool.execute('SELECT * FROM projects WHERE name = ? AND user_id = ?', [req.params.name, req.user.id]);
        if (projects.length === 0) return res.status(404).json({ error: "Projet introuvable ou accès refusé" });
        const [tasks] = await pool.execute('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC', [projects[0].id]);
        res.json({ ...projects[0], tasks });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    const { project_id, description, long_description, status } = req.body;
    try {
        const [proj] = await pool.execute('SELECT user_id, github_repo FROM projects WHERE id = ?', [project_id]);
        if (proj.length === 0 || (proj[0].user_id && proj[0].user_id !== req.user.id)) return res.sendStatus(403);

        await pool.execute('INSERT INTO tasks (project_id, description, long_description, status) VALUES (?, ?, ?, ?)', [project_id, description, long_description || null, status || 'todo']);
        await updateProjectProgress(project_id);

        // Sync if needed (example if creating directly in progress)
        if (status === 'in_progress' && proj[0].github_repo) {
            const [users] = await pool.execute('SELECT github_access_token FROM users WHERE id = ?', [req.user.id]);
            if (users.length > 0 && users[0].github_access_token) {
                syncTaskToGithub(users[0].github_access_token, proj[0].github_repo, description).catch(console.error);
            }
        }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/tasks/update-details', authenticateToken, async (req, res) => {
    const { id, description, long_description, status } = req.body;
    try {
        const [task] = await pool.execute('SELECT t.project_id, p.user_id, p.github_repo FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ?', [id]);
        if (task.length === 0 || task[0].user_id !== req.user.id) return res.sendStatus(403);

        await pool.execute('UPDATE tasks SET description = ?, long_description = ?, status = ? WHERE id = ?', [description, long_description, status, id]);
        await updateProjectProgress(task[0].project_id);

        // --- SYNC GITHUB ---
        if ((status === 'in_progress' || status === 'en cours') && task[0].github_repo) {
            const [users] = await pool.execute('SELECT github_access_token FROM users WHERE id = ?', [req.user.id]);
            if (users.length > 0 && users[0].github_access_token) {
                // Background sync, don't await blocking response
                syncTaskToGithub(users[0].github_access_token, task[0].github_repo, description).catch(err => console.error("Sync Error:", err.message));
            }
        }

        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- HELPER FUNCTION : GITHUB SYNC ---
async function syncTaskToGithub(token, repoFullName, taskDesc) {
    const filePath = 'taches.md';
    const apiUrl = `https://api.github.com/repos/${repoFullName}/contents/${filePath}`;
    const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
    };

    try {
        // 1. Get current content
        let sha = null;
        let content = "";

        try {
            const resGet = await axios.get(apiUrl, { headers });
            sha = resGet.data.sha;
            content = Buffer.from(resGet.data.content, 'base64').toString('utf8');
        } catch (e) {
            if (e.response && e.response.status === 404) {
                // File doesn't exist, create it
                content = "# Tâches en cours\n\n";
            } else {
                throw e;
            }
        }

        // 2. Append task if not present
        const taskLine = `- [ ] ${taskDesc}`;
        if (!content.includes(taskLine)) {
            content += `\n${taskLine}`;

            // 3. Update file
            const payload = {
                message: `Add task: ${taskDesc}`,
                content: Buffer.from(content).toString('base64'),
                sha: sha // undefined if creating new
            };

            await axios.put(apiUrl, payload, { headers });
            console.log(`[GitHub Sync] Added "${taskDesc}" to ${repoFullName}`);
        }

    } catch (err) {
        console.error(`[GitHub Sync Failed] ${repoFullName} : ${err.message}`);
    }
}

app.post('/api/tasks/delete', authenticateToken, async (req, res) => {
    const { id } = req.body;
    try {
        const [task] = await pool.execute('SELECT t.project_id, p.user_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ?', [id]);
        if (task.length === 0 || task[0].user_id !== req.user.id) return res.sendStatus(403);

        await pool.execute('DELETE FROM tasks WHERE id = ?', [id]);
        await updateProjectProgress(task[0].project_id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/project-update', authenticateToken, async (req, res) => {
    const { name, status } = req.body;
    try {
        const [proj] = await pool.execute('SELECT id FROM projects WHERE name = ? AND user_id = ?', [name, req.user.id]);
        if (proj.length === 0) return res.sendStatus(403);

        await pool.execute('UPDATE projects SET status = ? WHERE name = ? AND user_id = ?', [status, name, req.user.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DB Init & Migration
async function initDatabase() {
    try {
        // Create Users Table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                github_id VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(255) NOT NULL,
                avatar_url VARCHAR(255),
                github_access_token VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create projects table with user_id key
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS projects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                status ENUM('active', 'completed', 'archived', 'paused') DEFAULT 'active',
                progress INT DEFAULT 0,
                is_favorite BOOLEAN DEFAULT FALSE,
                github_repo VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // Auto-Migration: Add user_id if missing (for legacy databases)
        try {
            await pool.execute("ALTER TABLE projects ADD COLUMN user_id INT");
            await pool.execute("ALTER TABLE projects ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL");
            console.log("-> Migrated: Added user_id to projects table.");
        } catch (e) { /* Ignore if exists */ }

        // Auto-Migration: Add github_repo if missing
        try {
            await pool.execute("ALTER TABLE projects ADD COLUMN github_repo VARCHAR(255)");
            console.log("-> Migrated: Added github_repo to projects table.");
        } catch (e) { /* Ignore if exists */ }

        // Create Links Table
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS project_links (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                type VARCHAR(50) NOT NULL,
                url VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);

        // Auto-Migration: Add github_access_token if missing
        try {
            await pool.execute("ALTER TABLE users ADD COLUMN github_access_token VARCHAR(255)");
            console.log("-> Migrated: Added github_access_token to users table.");
        } catch (e) { /* Ignore if exists */ }

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS tasks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                description VARCHAR(255) NOT NULL,
                long_description TEXT,
                status ENUM('todo', 'in_progress', 'done') DEFAULT 'todo',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS project_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                content TEXT NOT NULL,
                entry_type ENUM('log', 'error', 'milestone', 'antigravity') DEFAULT 'log',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS brainstorm_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                role ENUM('user', 'model') NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);

        await pool.execute(`
            CREATE TABLE IF NOT EXISTS brainstorm_suggestions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);

        console.log("✅ Tables & Schema Verified");
    } catch (e) { console.error("❌ DB Init Error:", e); }
}

app.get('/api/projects/:id/brainstorm', authenticateToken, async (req, res) => {
    try {
        const [proj] = await pool.execute('SELECT user_id FROM projects WHERE id = ?', [req.params.id]);
        if (proj.length === 0 || (proj[0].user_id && proj[0].user_id !== req.user.id)) return res.sendStatus(403);

        const [history] = await pool.execute('SELECT role, content FROM brainstorm_history WHERE project_id = ? ORDER BY created_at ASC', [req.params.id]);
        // Mapper history pour Gemini: [{ role: 'user', parts: [{ text: '...' }] }]
        const formattedHistory = history.map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.content }]
        }));

        const [suggestions] = await pool.execute('SELECT * FROM brainstorm_suggestions WHERE project_id = ? ORDER BY created_at DESC', [req.params.id]);

        res.json({ history: formattedHistory, suggestions });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/brainstorm/suggestions/:id', authenticateToken, async (req, res) => {
    try {
        // Verify ownership via join
        const [sugg] = await pool.execute('SELECT s.project_id, p.user_id FROM brainstorm_suggestions s JOIN projects p ON s.project_id = p.id WHERE s.id = ?', [req.params.id]);
        if (sugg.length === 0 || sugg[0].user_id !== req.user.id) return res.sendStatus(403);

        await pool.execute('DELETE FROM brainstorm_suggestions WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/brainstorm', authenticateToken, async (req, res) => {
    const { project_id, project_name, project_desc, current_tasks, message, history } = req.body;

    try {
        // Verify project ownership (using project_id if available, otherwise name logic but ID is safer and we should have it in front)
        // Let's assume frontend will send project_id now.
        let targetProjId = project_id;

        if (!targetProjId) {
            const [projects] = await pool.execute('SELECT id, user_id FROM projects WHERE name = ? AND user_id = ?', [project_name, req.user.id]);
            if (projects.length === 0) return res.status(404).json({ error: "Projet introuvable" });
            targetProjId = projects[0].id;
        }

        // 1. Save User Message
        await pool.execute('INSERT INTO brainstorm_history (project_id, role, content) VALUES (?, "user", ?)', [targetProjId, message]);

        const chat = model.startChat({
            history: history || [],
            generationConfig: {
                maxOutputTokens: 65536,
            },
        });

        const systemPrompt = `
        Tu es un expert Product Manager et Tech Lead. Tu aides l'utilisateur à brainstormer sur son projet "${project_name}" (${project_desc}).
        
        Ta mission :
        1. Répondre à la question ou discuter de l'idée de manière constructive et concise.
        2. Détecter si des actions concrètes émergent de la discussion.
        
        SI tu proposes des nouvelles fonctionnalités ou tâches, tu DOIS les lister à la toute fin de ta réponse au format JSON strict, dans un bloc \`\`\`json \`\`\`.
        Le JSON doit être une liste d'objets : [{"title": "Titre court", "description": "Description détaillée pour un développeur"}].
        
        Contexte des tâches existantes : 
        ${JSON.stringify(current_tasks)}
        
        Si aucune tâche n'est pertinente à créer maintenant, ne mets pas de bloc JSON.
        `;

        const result = await chat.sendMessage(systemPrompt + "\n\nUser: " + message);
        const response = result.response.text();

        // Extraction du JSON si présent
        let suggestedTasks = [];
        let cleanResponse = response;

        const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
            try {
                suggestedTasks = JSON.parse(jsonMatch[1]);
                cleanResponse = response.replace(jsonMatch[0], "").trim();
            } catch (e) {
                console.error("Failed to parse Gemini JSON suggestions", e);
            }
        }

        // 2. Save Model Response
        await pool.execute('INSERT INTO brainstorm_history (project_id, role, content) VALUES (?, "model", ?)', [targetProjId, cleanResponse]);

        // 3. Save Suggestions
        const savedSuggestions = [];
        for (let task of suggestedTasks) {
            const [resSugg] = await pool.execute(
                'INSERT INTO brainstorm_suggestions (project_id, title, description, status) VALUES (?, ?, ?, "pending")',
                [targetProjId, task.title, task.description]
            );
            savedSuggestions.push({ ...task, id: resSugg.insertId });
        }

        res.json({ reply: cleanResponse, suggestions: savedSuggestions });

    } catch (err) {
        console.error("Gemini Error:", err);
        res.status(500).json({ error: "L'IA est confuse... Vérifiez votre clé API." });
    }
});

// --- LINKS FEATURE ---
app.get('/api/projects/:id/links', authenticateToken, async (req, res) => {
    try {
        const [proj] = await pool.execute('SELECT user_id FROM projects WHERE id = ?', [req.params.id]);
        if (proj.length === 0 || (proj[0].user_id && proj[0].user_id !== req.user.id)) return res.sendStatus(403);
        const [links] = await pool.execute('SELECT * FROM project_links WHERE project_id = ? ORDER BY created_at DESC', [req.params.id]);
        res.json(links);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/projects/:id/links', authenticateToken, async (req, res) => {
    const { type, url } = req.body;
    try {
        const [proj] = await pool.execute('SELECT user_id FROM projects WHERE id = ?', [req.params.id]);
        if (proj.length === 0 || (proj[0].user_id && proj[0].user_id !== req.user.id)) return res.sendStatus(403);

        await pool.execute('INSERT INTO project_links (project_id, type, url) VALUES (?, ?, ?)', [req.params.id, type, url]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/links/:id', authenticateToken, async (req, res) => {
    try {
        const [link] = await pool.execute('SELECT l.project_id, p.user_id FROM project_links l JOIN projects p ON l.project_id = p.id WHERE l.id = ?', [req.params.id]);
        if (link.length === 0 || link[0].user_id !== req.user.id) return res.sendStatus(403);

        await pool.execute('DELETE FROM project_links WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 3000;

async function startServer() {
    const dbConnected = await testConnection();
    if (dbConnected) {
        await initDatabase();
        app.listen(PORT, () => console.log(`🌲 Yggdrasil Online : Port ${PORT}`));
    } else {
        console.error("❌ Aborting server start due to DB connection failure. Please check .env settings.");
    }
}

startServer();
