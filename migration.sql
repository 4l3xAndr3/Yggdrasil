-- 1. Création de la table USERS (pour GitHub Auth)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    github_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Mise à jour de la table PROJECTS
-- Ajout de la colonne user_id (nullable pour les anciens projets)
ALTER TABLE projects ADD COLUMN user_id INT;

-- Ajout de la clé étrangère
ALTER TABLE projects 
ADD CONSTRAINT fk_projects_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

-- (Optionnel) Assignation des projets orphelins à un utilisateur spécifique (ID 1 par exemple)
-- UPDATE projects SET user_id = 1 WHERE user_id IS NULL;
