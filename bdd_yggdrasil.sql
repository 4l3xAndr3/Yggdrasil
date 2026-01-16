-- phpMyAdmin SQL Dump
-- version 5.2.3
-- https://www.phpmyadmin.net/
--
-- Hôte : 127.0.0.1:3306
-- Généré le : ven. 16 jan. 2026 à 11:11
-- Version du serveur : 8.0.44-0ubuntu0.22.04.1
-- Version de PHP : 8.1.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de données : `Yggdrasil-bdd`
--
CREATE DATABASE IF NOT EXISTS `Yggdrasil-bdd` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `Yggdrasil-bdd`;

-- --------------------------------------------------------

--
-- Structure de la table `logs`
--

CREATE TABLE `logs` (
  `id` int NOT NULL,
  `project_id` int NOT NULL,
  `content` text COLLATE utf8mb4_general_ci NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `logs`
--

INSERT INTO `logs` (`id`, `project_id`, `content`, `created_at`) VALUES
(1, 1, 'L\'architecture Yggdrasil est désormais opérationnelle. Le serveur Node.js communique parfaitement avec MySQL et GitHub.', '2026-01-13 13:31:12'),
(2, 1, 'Le Skald a été initié. Gemini génère maintenant des résumés cohérents basés sur l\'activité réelle du code.', '2026-01-13 13:31:12');

-- --------------------------------------------------------

--
-- Structure de la table `projects`
--

CREATE TABLE `projects` (
  `id` int NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_general_ci NOT NULL,
  `description` text COLLATE utf8mb4_general_ci,
  `repo_url` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_general_ci DEFAULT 'En cours',
  `progress` int DEFAULT '0',
  `is_favorite` tinyint(1) DEFAULT '0',
  `github_repo` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id` int DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `projects`
--

INSERT INTO `projects` (`id`, `name`, `description`, `repo_url`, `status`, `progress`, `is_favorite`, `created_at`, `updated_at`, `user_id`) VALUES
(1, 'Aurora', 'Système intelligent de gestion de projet. Intègre Gemini 2.5 Flash pour l\'analyse automatique des commits GitHub et la rédaction des chroniques. Design basé sur le concept Yggdrasil avec un thème émeraude et du verre dépoli.', NULL, 'En cours', 33, 1, '2026-01-13 13:31:12', '2026-01-13 14:24:29', NULL),
(2, 'Mjölnir', 'API de micro-services pour le traitement de données massives. Focus sur la rapidité et la robustesse.', NULL, 'En pause', 50, 0, '2026-01-13 13:31:12', '2026-01-13 13:50:28', NULL),
(3, 'Yggdrasil', '', NULL, 'En cours', 50, 0, '2026-01-13 18:06:17', '2026-01-13 18:36:58', 1),
(4, 'tewt', '', NULL, 'En cours', 0, 0, '2026-01-13 18:23:13', '2026-01-13 18:36:57', 1),
(5, 'aurora', 'second cerveau', NULL, 'En cours', 10, 1, '2026-01-13 18:34:08', '2026-01-13 18:37:29', 1);

-- --------------------------------------------------------

--
-- Structure de la table `project_logs`
--

CREATE TABLE `project_logs` (
  `id` int NOT NULL,
  `project_id` int NOT NULL,
  `content` text COLLATE utf8mb4_general_ci NOT NULL,
  `entry_type` enum('log','error','milestone','antigravity') COLLATE utf8mb4_general_ci DEFAULT 'log',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Structure de la table `tasks`
--

CREATE TABLE `tasks` (
  `id` int NOT NULL,
  `project_id` int NOT NULL,
  `description` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `long_description` text COLLATE utf8mb4_general_ci,
  `status` enum('todo','in_progress','done') COLLATE utf8mb4_general_ci DEFAULT 'todo',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `tasks`
--

INSERT INTO `tasks` (`id`, `project_id`, `description`, `long_description`, `status`, `created_at`) VALUES
(1, 1, 'Architecture MySQL', 'Définition des relations entre Projets, Tâches et Logs. Mise en place des clés étrangères pour la suppression en cascade.', 'done', '2026-01-13 13:31:12'),
(2, 1, 'OAuth GitHub Flow', 'Configuration de l\'application OAuth sur GitHub. Gestion du callback et sécurisation par cookies JWT httpOnly.', 'todo', '2026-01-13 13:31:12'),
(3, 1, 'Système de Modale', 'Développement de l\'interface pour afficher et éditer les détails longs des tâches sans quitter le tableau.', 'in_progress', '2026-01-13 13:31:12'),
(5, 1, 'Export PDF des Chroniques', 'Permettre de générer un rapport PDF de toute l\'évolution du projet pour les archives.', 'done', '2026-01-13 13:31:12'),
(6, 2, 'Initialisation Repo', 'Création du dépôt Git et structure de base Express.', 'done', '2026-01-13 13:31:12'),
(7, 2, 'Benchmarking', 'Tester les performances entre PostgreSQL et MySQL pour ce cas d\'usage.', 'todo', '2026-01-13 13:31:12'),
(8, 1, 'test', NULL, 'todo', '2026-01-13 13:52:18'),
(9, 1, 'test', NULL, 'todo', '2026-01-13 14:24:29'),
(10, 3, 'pourvoir mettre un lien github ou autre', '', 'in_progress', '2026-01-13 18:08:32'),
(11, 3, 'v1', '', 'done', '2026-01-13 18:08:43'),
(12, 5, 'Fondations Supabase', 'Créer le projet et les tables notes et esquisses. Sans cette base, l\'app n\'a pas de mémoire.', 'done', '2026-01-13 18:34:20'),
(13, 5, 'Squelette Flutter (UI)', 'Créer l\'interface à 3 onglets (Accueil, Notes, Esquisses). C\'est le corps de l\'application.', 'in_progress', '2026-01-13 18:34:28'),
(14, 5, 'Le Pont des Esquisses', 'Relier l\'onglet \"Esquisses\" à Supabase. Permet de tester si l\'app peut écrire dans la base de données.', 'todo', '2026-01-13 18:34:34'),
(15, 5, 'Le Micro & Permissions', 'Configurer l\'accès au micro (Android/iOS) et l\'enregistrement local d\'un fichier .m4a.', 'todo', '2026-01-13 18:34:39'),
(16, 5, 'Le Cerveau Gemini (Vocal)', 'Envoyer l\'audio à Gemini pour obtenir la transcription et le JSON structuré (Titre, Résumé, Thème).', 'todo', '2026-01-13 18:34:45'),
(17, 5, 'La Galerie de Mémoire', 'Coder l\'affichage des cartes dans l\'onglet \"Notes\" avec mise à jour en temps réel (Stream).', 'todo', '2026-01-13 18:34:51'),
(18, 5, 'Mémoire Sémantique (Vecteurs)', 'Générer les \"signatures\" (embeddings) pour que l\'app puisse lier tes notes entre elles.', 'todo', '2026-01-13 18:34:57'),
(19, 5, 'Dialogue & Voix (TTS)', 'Faire parler l\'IA pour qu\'elle te pose des questions et relancer le micro automatiquement.', 'todo', '2026-01-13 18:35:02'),
(20, 5, 'L\'Ancre Notion', 'Utiliser l\'API Notion pour envoyer tes notes de \"Cours\" directement dans tes pages Notion.', 'todo', '2026-01-13 18:35:08'),
(21, 5, 'Le Gardien Hors-ligne', 'Gérer le stockage local des idées quand tu n\'as pas de Wi-Fi et l\'envoi automatique après.', 'todo', '2026-01-13 18:35:14');

-- --------------------------------------------------------

--
-- Structure de la table `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `github_id` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `username` varchar(255) COLLATE utf8mb4_general_ci NOT NULL,
  `avatar_url` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `github_access_token` varchar(255) COLLATE utf8mb4_general_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Déchargement des données de la table `users`
--

INSERT INTO `users` (`id`, `github_id`, `username`, `avatar_url`, `created_at`) VALUES
(1, '144145372', '4l3xAndr3', 'https://avatars.githubusercontent.com/u/144145372?v=4', '2026-01-13 17:57:49');

--
-- Index pour les tables déchargées
--

--
-- Index pour la table `logs`
--
ALTER TABLE `logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `project_id` (`project_id`);

--
-- Index pour la table `projects`
--
ALTER TABLE `projects`
  ADD PRIMARY KEY (`id`),
  ADD KEY `fk_projects_user` (`user_id`);

--
-- Index pour la table `project_logs`
--
ALTER TABLE `project_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `project_id` (`project_id`);

--
-- Index pour la table `tasks`
--
ALTER TABLE `tasks`
  ADD PRIMARY KEY (`id`),
  ADD KEY `project_id` (`project_id`);

--
-- Index pour la table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `github_id` (`github_id`);

--
-- AUTO_INCREMENT pour les tables déchargées
--

--
-- AUTO_INCREMENT pour la table `logs`
--
ALTER TABLE `logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT pour la table `projects`
--
ALTER TABLE `projects`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT pour la table `project_logs`
--
ALTER TABLE `project_logs`
  MODIFY `id` int NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT pour la table `tasks`
--
ALTER TABLE `tasks`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT pour la table `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Contraintes pour les tables déchargées
--

--
-- Contraintes pour la table `logs`
--
ALTER TABLE `logs`
  ADD CONSTRAINT `logs_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `projects`
--
ALTER TABLE `projects`
  ADD CONSTRAINT `fk_projects_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Contraintes pour la table `project_logs`
--
ALTER TABLE `project_logs`
  ADD CONSTRAINT `project_logs_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE;

--
-- Contraintes pour la table `tasks`
--
ALTER TABLE `tasks`
  ADD CONSTRAINT `tasks_ibfk_1` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
