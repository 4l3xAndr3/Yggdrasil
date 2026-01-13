require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(express.static('public'));
app.use(cors());

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
};

// --- AUTHENTICATION GITHUB ---

// 1. Redirect to GitHub
app.get('/api/auth/github', (req, res) => {
    const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=http://localhost:3000/api/auth/github/callback&scope=read:user`;
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
        let db;

        try {
            db = await mysql.createConnection(dbConfig);

            // Ensure Users Table Exists
            await db.execute(`
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    github_id VARCHAR(255) UNIQUE NOT NULL,
                    username VARCHAR(255) NOT NULL,
                    avatar_url VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Upsert User
            const [rows] = await db.execute('SELECT * FROM users WHERE github_id = ?', [githubUser.id]);
            let userId;

            if (rows.length === 0) {
                const [result] = await db.execute(
                    'INSERT INTO users (github_id, username, avatar_url) VALUES (?, ?, ?)',
                    [githubUser.id, githubUser.login, githubUser.avatar_url]
                );
                userId = result.insertId;
            } else {
                userId = rows[0].id;
                await db.execute('UPDATE users SET username = ?, avatar_url = ? WHERE id = ?', [githubUser.login, githubUser.avatar_url, userId]);
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
        } finally {
            if (db) await db.end();
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
async function updateProjectProgress(db, projectId) {
    const [stats] = await db.execute(
        'SELECT COUNT(*) as total, SUM(CASE WHEN status = "done" THEN 1 ELSE 0 END) as done FROM tasks WHERE project_id = ?',
        [projectId]
    );
    const total = stats[0].total || 0;
    const done = stats[0].done || 0;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    await db.execute('UPDATE projects SET progress = ? WHERE id = ?', [progress, projectId]);
}

// --- LOGS & ANTIGRAVITY API (SECURED) ---

app.get('/api/projects/:id/logs', authenticateToken, async (req, res) => {
    let db;
    try {
        db = await mysql.createConnection(dbConfig);
        const [proj] = await db.execute('SELECT user_id FROM projects WHERE id = ?', [req.params.id]);
        if (proj.length === 0 || (proj[0].user_id && proj[0].user_id !== req.user.id)) return res.sendStatus(403);

        const [rows] = await db.execute('SELECT * FROM project_logs WHERE project_id = ? ORDER BY created_at DESC', [req.params.id]);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (db) await db.end(); }
});

app.post('/api/logs', authenticateToken, async (req, res) => {
    const { project_id, content, entry_type } = req.body;
    let db;
    try {
        db = await mysql.createConnection(dbConfig);
        const [proj] = await db.execute('SELECT user_id FROM projects WHERE id = ?', [project_id]);
        if (proj.length === 0 || (proj[0].user_id && proj[0].user_id !== req.user.id)) return res.sendStatus(403);

        await db.execute(
            'INSERT INTO project_logs (project_id, content, entry_type) VALUES (?, ?, ?)',
            [project_id, content, entry_type || 'log']
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (db) await db.end(); }
});

// Antigravity Push (API Key - Public/Admin Agent access)
app.post('/api/antigravity/push', async (req, res) => {
    const apiKey = req.headers['x-antigravity-key'];
    if (apiKey !== process.env.ANTIGRAVITY_KEY) return res.status(403).json({ error: 'Unauthorized' });

    const { project_name, content, type } = req.body;
    if (!project_name || !content) return res.status(400).json({ error: 'Missing data' });

    let db;
    try {
        db = await mysql.createConnection(dbConfig);
        const [projects] = await db.execute('SELECT id FROM projects WHERE name LIKE ? LIMIT 1', [project_name]);

        if (projects.length === 0) return res.status(404).json({ error: 'Project not found' });

        await db.execute(
            'INSERT INTO project_logs (project_id, content, entry_type) VALUES (?, ?, ?)',
            [projects[0].id, content, type || 'antigravity']
        );
        res.json({ success: true });

    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (db) await db.end(); }
});

// --- CLIENT DATA ROUTES (SECURED) ---

app.post('/api/projects/create', authenticateToken, async (req, res) => {
    const { name, description } = req.body;
    let db;
    try {
        db = await mysql.createConnection(dbConfig);
        await db.execute('INSERT INTO projects (user_id, name, description, status, progress) VALUES (?, ?, ?, "En cours", 0)', [req.user.id, name, description || ""]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (db) await db.end(); }
});

app.get('/api/projects-list', authenticateToken, async (req, res) => {
    let db;
    try {
        db = await mysql.createConnection(dbConfig);
        const [rows] = await db.execute('SELECT id, name, status FROM projects WHERE user_id = ? ORDER BY name ASC', [req.user.id]);
        res.json(rows);
    } catch (err) { res.status(500).send(err.message); }
    finally { if (db) await db.end(); }
});

app.get('/api/dashboard-home', authenticateToken, async (req, res) => {
    let db;
    try {
        db = await mysql.createConnection(dbConfig);
        const [count] = await db.execute('SELECT COUNT(*) as total FROM projects WHERE user_id = ?', [req.user.id]);
        const [fav] = await db.execute('SELECT * FROM projects WHERE is_favorite = 1 AND user_id = ? LIMIT 1', [req.user.id]);
        const [recent] = await db.execute('SELECT name, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC LIMIT 4', [req.user.id]);
        res.json({ totalActive: count[0].total, favorite: fav[0] || null, recent });
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (db) await db.end(); }
});

app.get('/api/project-details/:name', authenticateToken, async (req, res) => {
    let db;
    try {
        db = await mysql.createConnection(dbConfig);
        const [projects] = await db.execute('SELECT * FROM projects WHERE name = ? AND user_id = ?', [req.params.name, req.user.id]);
        if (projects.length === 0) return res.status(404).json({ error: "Projet introuvable ou accès refusé" });
        const [tasks] = await db.execute('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC', [projects[0].id]);
        res.json({ ...projects[0], tasks });
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (db) await db.end(); }
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
    const { project_id, description, status } = req.body;
    let db;
    try {
        db = await mysql.createConnection(dbConfig);
        const [proj] = await db.execute('SELECT user_id FROM projects WHERE id = ?', [project_id]);
        if (proj.length === 0 || (proj[0].user_id && proj[0].user_id !== req.user.id)) return res.sendStatus(403);

        await db.execute('INSERT INTO tasks (project_id, description, status) VALUES (?, ?, ?)', [project_id, description, status || 'todo']);
        await updateProjectProgress(db, project_id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (db) await db.end(); }
});

app.post('/api/tasks/update-details', authenticateToken, async (req, res) => {
    const { id, description, long_description, status } = req.body;
    let db;
    try {
        db = await mysql.createConnection(dbConfig);
        const [task] = await db.execute('SELECT t.project_id, p.user_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ?', [id]);
        if (task.length === 0 || task[0].user_id !== req.user.id) return res.sendStatus(403);

        await db.execute('UPDATE tasks SET description = ?, long_description = ?, status = ? WHERE id = ?', [description, long_description, status, id]);
        await updateProjectProgress(db, task[0].project_id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (db) await db.end(); }
});

app.post('/api/tasks/delete', authenticateToken, async (req, res) => {
    const { id } = req.body;
    let db;
    try {
        db = await mysql.createConnection(dbConfig);
        const [task] = await db.execute('SELECT t.project_id, p.user_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ?', [id]);
        if (task.length === 0 || task[0].user_id !== req.user.id) return res.sendStatus(403);

        await db.execute('DELETE FROM tasks WHERE id = ?', [id]);
        await updateProjectProgress(db, task[0].project_id);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (db) await db.end(); }
});

app.post('/api/project-update', authenticateToken, async (req, res) => {
    const { name, status } = req.body;
    let db;
    try {
        db = await mysql.createConnection(dbConfig);
        const [proj] = await db.execute('SELECT id FROM projects WHERE name = ? AND user_id = ?', [name, req.user.id]);
        if (proj.length === 0) return res.sendStatus(403);

        await db.execute('UPDATE projects SET status = ? WHERE name = ? AND user_id = ?', [status, name, req.user.id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
    finally { if (db) await db.end(); }
});

// DB Init & Migration
(async () => {
    let db;
    try {
        db = await mysql.createConnection(dbConfig);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                github_id VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(255) NOT NULL,
                avatar_url VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create projects table with user_id key
        await db.execute(`
            CREATE TABLE IF NOT EXISTS projects (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                status ENUM('active', 'completed', 'archived', 'paused') DEFAULT 'active',
                progress INT DEFAULT 0,
                is_favorite BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        `);

        // Auto-Migration: Add user_id if missing (for legacy databases)
        try {
            await db.execute("ALTER TABLE projects ADD COLUMN user_id INT");
            await db.execute("ALTER TABLE projects ADD CONSTRAINT fk_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL");
            console.log("-> Migrated: Added user_id to projects table.");
        } catch (e) { /* Ignore if exists */ }

        await db.execute(`
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

        await db.execute(`
            CREATE TABLE IF NOT EXISTS project_logs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                project_id INT NOT NULL,
                content TEXT NOT NULL,
                entry_type ENUM('log', 'error', 'milestone', 'antigravity') DEFAULT 'log',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )
        `);

        console.log("✅ Tables & Schema Verified");
    } catch (e) { console.error("DB Init Error:", e); }
    finally { if (db) await db.end(); }
})();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🌲 Yggdrasil Online : Port ${PORT}`));