# 🌲 Yggdrasil Ecosystem

> **"Gravez vos projets dans le code comme les runes dans la pierre."**

Yggdrasil est une plateforme de gestion de projet moderne et immersive, conçue pour les développeurs qui veulent allier productivité et esthétique. Elle combine un suivi de tâches rigoureux à la puissance de l'IA générative.

## 🌟 Fonctionnalités Clés

### 1. 📂 Gestion de Projets ("Runes")
-   **Tableau de bord** : Vue d'ensemble de tous les projets actifs, favoris et récents.
-   **Suivi de progression** : Calcul automatique du pourcentage d'avancement (Statut "Stable").
-   **Missions** : Gestion des tâches (To Do / In Progress / Done) avec descriptions détaillées.

### 2. 🧠 Brainstorming IA (Powered by Gemini)
-   **Assistant Intelligent** : Discutez avec votre projet grâce à Google Gemini 1.5/2.5.
-   **Contexte Automatique** : L'IA connaît déjà le nom du projet et les tâches existantes.
-   **Suggestions Actionnables** : L'IA propose des tâches concrètes que vous pouvez transformer en missions d'un simple clic.
-   **Mémoire Persistante** : L'historique de vos discussions et les suggestions sont sauvegardés.

### 3. 🔗 Intégration GitHub
-   **Auth & Import** : Connectez-vous via GitHub et importez vos repos existants en un clic.
-   **Synchro Bidirectionnelle** : 
    -   Les tâches mises "En cours" sont automatiquement ajoutées dans un fichier `taches.md` sur votre repo GitHub.

### 4. 📝 Mémoire Technique
-   **Journal de bord** : Consignez les logs techniques, les erreurs rencontrées et les milestones atteints pour chaque projet.

## 🛠 Stack Technique

-   **Backend** : Node.js & Express
-   **Base de données** : MySQL (avec gestion automatique des migrations au démarrage)
-   **IA** : Google Gemini API (`gemini-2.5-flash`)
-   **Frontend** : HTML5, Vanilla JS, TailwindCSS (via CDN)
-   **Style** : Design System "Nordic Dark" (Glassmorphism, Emerald/Purple accents, FontAwesome)

## 🚀 Installation

1.  Cloner le projet.
2.  Installer les dépendances : `npm install`
3.  Configurer le `.env` (voir `.env.example`).
4.  Lancer le serveur : `npm start`
5.  Accéder à `http://localhost:3000` (ou votre `APP_URL`).

---
*Développé avec passion par [Votre Nom/Pseudo]*
