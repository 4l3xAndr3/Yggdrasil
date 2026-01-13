🌲 Cahier des Charges : Yggdrasil Ecosystem
1. Vision du Projet
Yggdrasil est une infrastructure de gestion de projet "Nordic-Tech" conçue pour centraliser le flux de travail entre le développement logiciel (via Antigravity) et l'organisation stratégique (via Notion). L'objectif est de transformer le suivi de projet en une expérience immersive et automatisée.

2. Objectifs Principaux
Centralisation Holistique : Unifier les missions (tâches) et la mémoire technique (logs).

Calcul de Stabilité : Suivi de progression dynamique basé sur l'achèvement des tâches.

Documentation Assistée : Intégration des rapports de session générés par l'IA Antigravity.

Scalabilité : Passage d'un outil personnel à une plateforme multi-utilisateurs avec espaces privés.

3. Architecture Technique
Stack Technologique
Frontend : HTML5 / Tailwind CSS (Thème Deep Dark) / Vanilla JavaScript.

Backend : Node.js / Express.js.

Base de Données : MySQL (Relationnelle).

Auth : OAuth GitHub & JSON Web Tokens (JWT).

Schéma de la Base de Données
SQL

-- Structure simplifiée
projects (id, name, description, owner, progress, status, created_at)
tasks (id, project_id, description, status, owner)
project_logs (id, project_id, entry_type, content, problems_encountered, created_at)
4. Spécifications Fonctionnelles
A. Le Dashboard (Navigation Racine)
Sidebar Universelle : Navigation constante, accès aux cours Notion et liste dynamique des projets favoris.

Initialisation Runique : Pop-up (Modal) de création de projet incluant Nom et Description.

Statut Global : Visualisation rapide des projets récents et du nombre de projets actifs.

B. Interface Projet (Le Menu "Style Google")
Le projet est divisé en deux modules distincts via un système d'onglets :

Module "Missions" (Kanban Light) :

Gestion des tâches par colonnes : À Faire, En Cours, Terminé.

Ajout rapide "In-line" pour ne pas casser le flux de travail.

Mise à jour automatique du % de progression à chaque changement d'état.

Module "Logs Code" (Mémoire Antigravity) :

Historique chronologique des sessions de développement.

Saisie des comptes-rendus techniques pour garder une trace des problèmes résolus.

Formatage optimisé pour la lecture de code et de logs techniques.

5. Design & UI/UX (Charte Graphique)
Palette de Couleurs :

Fond : #02040a (Noir Abyssal)

Accent : #10b981 (Vert Émeraude)

Texte : #e2e8f0 (Gris Ardoise Clair)

Esthétique : Glassmorphism, bordures runiques lumineuses, animations de transition fluides.

6. Roadmap de Développement
[x] Architecture de base et Dashboard.

[x] Système de composants partagés (Sidebar Fetch).

[x] Système d'onglets (Missions vs Logs).

[ ] Phase Imminente : Migration vers le système d'espaces privés (Multi-utilisateurs).

[ ] V3 : Intégration API directe pour Antigravity.
