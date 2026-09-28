# NavFOR — Navigation Focus Objectives & Results

**NavFOR** est une application intégrée de gestion de tâches et de projets combinant une organisation hiérarchique par dossiers (**Explorer**), une chronologie de planification de type Gantt par dates ou par phases (**Project Timeline**), un éditeur détaillé multi-onglets avec écran scindé (**Task / Folder Detail**), ainsi qu'une synchronisation cloud en temps réel doublée d'une sauvegarde locale rotative sur 3 fichiers.

---

## Sommaire (Table of Contents)

1. [Architecture générale de l'écran (Disposition en 3 volets)](#1-architecture-générale-de-lécran-disposition-en-3-volets)
2. [Explorer (Volet gauche : Dossiers hiérarchiques & Focus)](#2-explorer-volet-gauche--dossiers-hiérarchiques--focus)
3. [Ajout de tâches & Focus (Tâches prioritaires)](#3-ajout-de-tâches--focus-tâches-prioritaires)
4. [Project Timeline (Volet central : Planification & Phases)](#4-project-timeline-volet-central--planification--phases)
5. [Mode paysage mobile (Bascule Plein écran / Vue complète)](#5-mode-paysage-mobile-bascule-plein-écran--vue-complète)
6. [Task & Folder Detail (Volet droit : Multi-onglets & Écran scindé)](#6-task--folder-detail-volet-droit--multi-onglets--écran-scindé)
7. [Calendar / Archive / Trash & Nettoyage automatique](#7-calendar--archive--trash--nettoyage-automatique)
8. [Synchronisation locale (Sauvegarde rotative sur 3 fichiers CSV)](#8-synchronisation-locale-sauvegarde-rotative-sur-3-fichiers-csv)
9. [Raccourcis clavier](#9-raccourcis-clavier)
10. [Exécution en local (Installation & Build)](#10-exécution-en-local-installation--build)

---

## 1. Architecture générale de l'écran (Disposition en 3 volets)

Le **Dashboard** (écran principal) s'inspire des environnements de développement intégrés (IDE) avec une **disposition en 3 volets redimensionnables**. Vous pouvez faire glisser les bordures entre les volets pour ajuster leur largeur ou les réduire à tout moment.

| Zone | Nom | Rôle principal |
| :--- | :--- | :--- |
| **Barre supérieure** | **Header & Workspaces** | Changement d'espace de travail, navigation (Dashboard / Calendar / Archive / Trash / Settings), Annuler/Rétablir (Undo/Redo), état de synchronisation locale et Guide d'utilisation (`Guide`) |
| **Volet gauche** | **Explorer** | Section `Focus` (tâches prioritaires), alertes d'échéances proches et arborescence hiérarchique des dossiers et tâches |
| **Volet central** | **Project Timeline** | Visualisation et planification inter-projets par dates calendaires (`Dates`) ou par étapes personnalisées (`Phase 1–5`, etc.) |
| **Volet droit** | **Task / Folder Detail** | Éditeur détaillé pour les tâches et dossiers sélectionnés (gestion multi-onglets et division d'écran jusqu'à 4 sous-volets : Gauche/Droite, Haut/Bas ou Grille 2x2) |

---

## 2. Explorer (Volet gauche : Dossiers hiérarchiques & Focus)

Le volet **Explorer** à gauche permet de structurer vos projets en dossiers et sous-dossiers sur autant de niveaux que nécessaire.

### Fonctionnalités principales
- **Gestion hiérarchique des dossiers** :
  - Créez des sous-dossiers sur plusieurs niveaux en utilisant le séparateur `/` (ex. `ProjetA/UI/Composants`) ou via le bouton **Créer un sous-dossier** du menu d'un dossier.
  - **Glisser-déposer (Drag & Drop)** : Déplacez une tâche d'un dossier à l'autre, ou déposez un dossier sur un autre pour l'imbriquer comme sous-dossier (déposez-le sur l'en-tête de l'Explorer pour le replacer à la racine).
- **Menu contextuel (`...`) & Actions rapides** :
  - Le bouton `...` sur chaque dossier ou tâche permet de **Renommer**, **Créer une tâche**, **Créer un sous-dossier**, **Ajouter une étoile (Star)**, **Épingler (Pin)**, **Dupliquer**, ou **Déplacer vers Archive / Corbeille**.
  - **Duplication de dossier** : La duplication d'un dossier copie récursivement toute son arborescence de sous-dossiers ainsi que l'ensemble de ses tâches.
  - **Calcul automatique de l'échéance parente** : Chaque dossier parent calcule et affiche automatiquement l'échéance la plus proche parmi ses sous-dossiers et tâches.
- **Redimensionnement et réduction** :
  - Faites glisser la bordure droite de l'Explorer pour ajuster sa largeur, ou cliquez sur l'icône de réduction pour le minimiser en une fine barre latérale.

---

## 3. Ajout de tâches & Focus (Tâches prioritaires)

### Comment ajouter une tâche
1. **Bouton circulaire `+` en bas à droite (Fenêtre complète de création de tâche)** :
   - Cliquez sur le **bouton circulaire `+`** situé **en bas à droite de la Project Timeline** sur PC, ou **en bas à droite des écrans Explorer et Timeline** sur mobile, pour ouvrir la fenêtre complète de création de tâche.
   - **Sélection & création automatique de dossier** : Saisissez ou sélectionnez un dossier de projet avec suggestion automatique des dossiers existants. Si vous saisissez un chemin de dossier inexistant (y compris un sous-dossier tel que `ProjetA/NouveauSousDossier`), NavFOR **crée automatiquement le dossier et y ajoute la tâche**.
   - **Toutes les options de Task Detail** : Configurez dès la création le titre, le statut terminé, la catégorie (`ToDo` / `Focus`), l'étoile (Star), l'épingle (Pin), la date/heure de début, l'échéance (Deadline), le mode toute la journée, la récurrence, les notes et les URL associées.
2. **Depuis l'Explorer** :
   - Cliquez sur l'icône `+` à côté d'un dossier (ou `...` > `Nouvelle tâche`) pour créer immédiatement une tâche dans ce dossier.
3. **Directement sur la Project Timeline (Création rapide)** :
   - **Double-cliquez** sur n'importe quelle cellule vide de la Timeline (un créneau date/heure, une étape de Phase ou la colonne ToDo List) pour créer instantanément une tâche pré-planifiée à cet emplacement.
   - Vous pouvez également cliquer sur le bouton `+` à côté du nom de chaque ligne de projet (Project Lane) ou sur le **bouton circulaire `+` en bas à droite de la Timeline**.

### Focus (Tâches prioritaires) & Alertes d'échéance
- **Section Focus** :
  - Placez vos tâches les plus importantes du moment (limite par défaut : **3 tâches simultanées**, modifiable dans `Settings` > `Capacité Focus`) dans la section **Focus** (signalée par un éclair rouge ⚡) tout en haut de l'Explorer.
  - Basculez une tâche entre `Focus` et `ToDo` à tout moment depuis le volet Task Detail, la fenêtre de création de tâche ou le menu contextuel.
- **Alertes d'échéance** :
  - Les tâches dont la date limite approche (par défaut à moins de **3 jours**) sont mises en évidence en jaune, et les tâches en retard s'affichent avec une icône et un badge rouges.

---

## 4. Project Timeline (Volet central : Planification & Phases)

Le volet central **Project Timeline** affiche chaque dossier de projet sous forme de **ligne horizontale (Project Lane)** afin de visualiser et d'organiser l'ordre d'exécution et les plannings de tous vos projets.

### Deux modes d'affichage
1. **Mode Dates calendaires (`Dates`)** :
   - Affiche un calendrier horizontal (`7 jours` / `14 jours` / `21 jours`, avec navigation `◀ Aujourd'hui ▶`).
   - Représente les tâches sous forme de barres allant de la **Date/Heure de début** à la **Date/Heure d'échéance**, avec une ligne indiquant l'heure actuelle et le déploiement automatique des tâches récurrentes (quotidiennes, hebdomadaires, etc.).
   - **Ajustement direct à la souris** : Faites glisser l'extrémité gauche ou droite d'une barre de tâche pour modifier directement sa date de début ou d'échéance.
2. **Mode Périodes personnalisées / Étapes (`Custom / Stages`)** :
   - Permet de gérer les projets par phases abstraites (par défaut : `Phase 1` à `Phase 5`) sans contrainte de dates fixes.
   - Cliquez sur `+ Ajouter une colonne` pour ajouter des phases, **double-cliquez** sur l'en-tête d'une colonne pour la renommer (ex. `Conception`, `Développement`, `Validation`), ou réinitialisez les colonnes à tout moment.

### Granularité de la grille & Colonne ToDo List
- **Activation de la grille & Granularité** :
  - En mode `Dates`, activez une grille horaire précise (**1h / 2h / 4h / 6h / 12h / 24h**).
  - En mode `Custom / Stages`, divisez chaque phase en **2 à 5 sous-étapes** pour ordonner finement vos tâches.
- **Colonne ToDo List (Tâches non planifiées)** :
  - Affichez ou masquez la colonne `ToDo List` depuis la barre d'outils. Les tâches sans date ni phase y sont regroupées par projet (les tâches actives en haut, les tâches terminées en bas) et peuvent être glissées-déposées directement vers la Timeline.
- **Redimensionnement libre des colonnes** :
  - Faites glisser la bordure droite des colonnes `Project Lanes`, `ToDo List` ou de chaque `Phase` pour ajuster leur largeur.
- **Numérotation automatique de l'ordre d'exécution** :
  - Les tâches non terminées de chaque ligne de projet sont numérotées automatiquement selon leur ordre chronologique.

---

## 5. Mode paysage mobile (Bascule Plein écran / Vue complète)

Pour offrir un confort de lecture optimal sur smartphone, la Project Timeline dispose d'un **Mode Plein écran (Fullscreen)** dédié.

- **Passage automatique en plein écran en mode paysage** :
  - Lorsque vous tournez votre appareil mobile à l'horizontale (paysage), la barre supérieure, la barre de navigation inférieure, la barre d'outils de la Timeline (`Dates`, `Add Folder`, etc.) ainsi que la colonne `ToDo List` sont automatiquement masquées pour laisser toute la place au planning. Le retour en mode portrait restaure automatiquement la vue complète.
- **Bascule en un geste entre « Plein écran » et « Vue complète »** :
  - **Touchez la barre d'en-tête des dates (ou des phases)** en haut de la Timeline pour basculer instantanément entre le mode **Plein écran** et la **Vue complète**.
  - Vous pouvez aussi utiliser le **bouton flottant en bas à droite** ou le bouton `Plein écran` de la barre d'outils.
  - En mode plein écran, la barre flottante en bas à droite permet également de naviguer entre les semaines (`◀ Aujourd'hui ▶`) et d'afficher/masquer la colonne **`Lignes` (Project Lanes)** à gauche.
- **Ajustement de la largeur des Project Lanes en plein écran** :
  - Même en mode plein écran, faites glisser du doigt la bordure droite de la colonne `Project Lanes` (entre `56px` et `450px`) pour adapter l'espace réservé aux noms des dossiers.

---

## 6. Task & Folder Detail (Volet droit : Multi-onglets & Écran scindé)

Cliquer sur une tâche ou un dossier ouvre le volet **Detail** à droite (disponible aussi bien sur le Dashboard que dans les vues **Archive** et **Trash**).

### Multi-onglets & Écran scindé jusqu'à 4 vues
- **Onglets d'aperçu et onglets épinglés** :
  - Un **clic simple** ouvre la tâche dans un onglet d'aperçu ; un **double-clic** (ou un clic sur l'icône d'épingle) fixe l'onglet pour le conserver ouvert.
- **4 dispositions d'écran scindé (Split View)** :
  - Les boutons de disposition en haut du volet Detail permettent de choisir entre **Volet unique**, **Division Gauche/Droite (2 colonnes)**, **Division Haut/Bas (2 lignes)** et **Grille 2x2 (4 vues)**.
  - Faites glisser les onglets d'un sous-volet à l'autre pour comparer ou éditer plusieurs éléments simultanément.
- **Redimensionnement & Réduction** :
  - Faites glisser la bordure gauche du volet Detail pour ajuster sa largeur (double-cliquez sur la bordure pour réinitialiser la largeur).
  - Le bouton `－` minimise le volet sur le côté droit tout en conservant vos onglets ouverts, tandis que `×` ferme tous les onglets.

### Champs d'édition d'une tâche
- **Paramètres généraux** : Titre, dossier de projet parent, statut terminé, bascule Focus (⚡), Étoile (★) et Épingle (📌).
- **Date/Heure de début & Échéance (Deadline)** : Choix de la date et de l'heure ou option `Toute la journée (All Day)` (avec validation par rapport à l'échéance du dossier parent).
- **Récurrence (Recurrence)** : `Aucune` / `Quotidienne` / `Tous les N jours` / `Hebdomadaire (jours au choix)` / `Toutes les N semaines` (avec date de fin optionnelle).
- **Affectation de Phase** : Choix de l'étape (`Phase`) et de la sous-étape.
- **Liste d'URL associées** : Ajoutez plusieurs liens web ou documents de référence ouvrables en un clic.
- **Notes / Mémo** : Rédigez des notes détaillées avec sauvegarde automatique.
- **Dates de création et de mise à jour** : Affiche tout en bas du volet Task Detail la **date de création** et la **date de dernière modification** du fichier.

### Détails d'un dossier (Folder Detail)
- Cliquez sur le **nom d'un dossier** dans l'Explorer ou la Timeline pour ouvrir son onglet dédié **Folder Detail**.
- Gérez l'**échéance globale du dossier**, les **notes du dossier**, la barre de progression et l'archivage groupé des tâches terminées.
- Affiche tout en bas du volet Folder Detail la **date de création du dossier** ainsi que la **date de dernière mise à jour des fichiers enfants**.

---

## 7. Calendar / Archive / Trash & Nettoyage automatique

- **Calendar (Calendrier mensuel)** :
  - Affiche l'ensemble des tâches et échéances récurrentes sur une grille mensuelle interactive.
- **Archive & Trash (Vue Explorer + Volet Detail)** :
  - Consultez et recherchez vos tâches archivées ou placées dans la corbeille tout en conservant l'arborescence d'origine de vos dossiers.
  - Sélectionnez une tâche pour ouvrir ses détails à droite, la **Restaurer (Restore)** dans son dossier d'origine ou la **Supprimer définitivement**.
- **Traitement des tâches terminées & Corbeille (`Settings` > `Cycle de vie Terminé & Corbeille`)** :
  - **Terminé vers Corbeille (`Done to Trash`)** : Déplace automatiquement les tâches terminées de ToDo/Focus vers la corbeille après N jours (par défaut : **7 jours**).
  - **Nettoyage auto de la corbeille (`Trash Auto-Cleanup`)** : Supprime définitivement les éléments présents dans la corbeille après N jours (par défaut : **30 jours**).
- **Nettoyage automatique des archives (`Settings` > `Balayage d'archivage auto`)** :
  - **Seuil d'archivage (`Archive Threshold`)** : Déplace automatiquement les éléments inactifs vers les Archives après une période d'inactivité (par défaut : **90 jours**).
  - **Mise à la corbeille auto des archives terminées (`Auto-trash completed archive items`)** : Déplace automatiquement vers la corbeille les tâches marquées comme terminées dans les Archives après N jours (par défaut : **7 jours**).
  - **Mise à la corbeille auto des archives inactives (`Auto-trash inactive archive items`)** : Déplace les tâches non terminées et inactives des Archives vers la corbeille après la période choisie (par défaut : **Jamais / Manuel uniquement**).

---

## 8. Synchronisation locale (Rotation quotidienne sur 3 fichiers CSV)

En complément de la sauvegarde cloud en temps réel (Firebase Firestore), NavFOR propose une **sauvegarde automatique séparée par jour en rotation sur 3 fichiers dans un dossier local de votre ordinateur**.

### Fonctionnement et configuration
1. **Sélection du dossier local** :
   - Cliquez sur le bouton `Config. locale requise (Local Setting Needed)` dans l'en-tête (ou via `Settings` > `Local folder log`) et choisissez un dossier sur votre ordinateur.
2. **Rotation quotidienne sur 3 fichiers (`#1` → `#2` → `#3`)** :
   - Une fois activé, le badge vert **`Sync Active`** reste affiché de manière fixe dans l'en-tête.
   - Les sauvegardes sont séparées jour par jour sur **3 fichiers CSV rotatifs** : toutes les modifications effectuées **le même jour** écrasent le fichier du jour, et **le lendemain** NavFOR passe automatiquement au numéro suivant (`1 → 2 → 3 → 1...`) :
     - `NavFOR_Log_<Utilisateur>_1.csv`
     - `NavFOR_Log_<Utilisateur>_2.csv`
     - `NavFOR_Log_<Utilisateur>_3.csv`
3. **Reprise après redémarrage du navigateur** :
   - L'accès au dossier est mémorisé dans `IndexedDB` et peut être réactivé en un clic après un redémarrage du navigateur.
4. **Export / Import CSV manuel** :
   - Depuis `Settings` > `Data Lifecycle`, vous pouvez à tout moment exporter (`Export CSV`) ou importer (`Import CSV`) vos données manuellement.

---

## 9. Raccourcis clavier

Lorsqu'une tâche ou un dossier est sélectionné dans l'Explorer ou la Project Timeline :

| Touche | Action |
| :--- | :--- |
| `↑` `↓` `←` `→` | **Explorer** : Navigation verticale dans l'arbre, déplier (`→`) ou replier (`←`) un dossier<br>**Timeline** : Navigation spatiale 2D entre les lignes de projets (haut/bas) et les tâches (gauche/droite) |
| `Espace` | Basculer l'état **Terminé / Non terminé** de la tâche sélectionnée |
| `Entrée` ou `F2` | **Renommer en ligne** la tâche ou le dossier sélectionné |
| `Échap (Escape)` | Annuler l'édition en ligne / fermer le menu / désélectionner |
| `Double-clic` | **Cellule vide de la Timeline** : Créer une tâche à cette date/phase<br>**Nom de tâche/dossier** : Renommer en ligne (et épingler son onglet Detail) |

---

## 10. Exécution en local (Installation & Build)

**Prérequis :** Node.js (v18 ou supérieur recommandé)

1. Installer les dépendances :
   ```bash
   npm install
   ```
2. Lancer le serveur de développement (Port 3000) :
   ```bash
   npm run dev
   ```
3. Générer le build de production :
   ```bash
   npm run build
   ```
