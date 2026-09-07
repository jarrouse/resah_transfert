# Instructions pour la Migration Manuelle d'une Page Elementor

Ce guide détaille la procédure étape par étape pour migrer une page spécifique d'un site WordPress source vers votre nouveau projet **WordPress Bedrock** en utilisant les fonctionnalités natives d'import/export d'Elementor. Cette méthode préserve l'intégralité du design, des structures (Flexbox/Grilles) et réintègre proprement les fichiers médias.

---

## 📋 Étape 1 : Exporter la page depuis le site Source

1. Connectez-vous à l'administration du site WordPress d'origine.
2. Allez dans l'onglet **Pages** et cliquez sur **Modifier avec Elementor** sur la page concernée.
3. En bas à gauche de la barre latérale d'Elementor, localisez le bouton de mise à jour. Cliquez sur la **petite flèche du haut (▲)** située juste à côté.
4. Sélectionnez **Enregistrer comme modèle** (*Save as Template*).
5. Donnez un nom explicite à votre modèle (ex: `Migration - Page Accueil`) et cliquez sur **Enregistrer**.
6. Une fois dans la bibliothèque de modèles, cliquez sur les **trois petits points (ou l'icône d'option)** à côté de votre modèle et choisissez **Exporter**.
7. Enregistrez le fichier généré au format `.json` sur votre ordinateur.

---

## 📥 Étape 2 : Importer le modèle sur le site Cible (Bedrock)

1. Connectez-vous à l'administration de votre site cible Bedrock.
2. Naviguez vers **Elementor** > **Modèles enregistrés** (*Saved Templates*).
3. Cliquez sur le bouton **Importer des modèles** tout en haut de la page.
4. Choisissez le fichier `.json` précédemment téléchargé et cliquez sur **Importer maintenant**.
5. Votre modèle apparaît désormais dans la liste de vos structures Elementor disponibles.

---

## 📄 Étape 3 : Créer et appliquer le modèle sur la nouvelle page

1. Dans l'administration Bedrock, allez dans **Pages** > **Ajouter une page**.
2. Saisissez le **Titre officiel** de votre page.
3. Dans les réglages de la page (colonne de droite), repérez l'option **Modèle de page** (*Template*) :
   - Choisissez **Elementor Pleine Largeur** (*Elementor Full Width*) pour conserver vos en-têtes et pieds de page Astra.
   - Ou choisissez **Elementor Canvas** si vous souhaitez une page blanche totale.
   *(Cette action empêche le thème Astra d'injecter de force un titre <h1> doublé en haut du contenu)*.
4. Cliquez sur **Enregistrer le brouillon** puis sur le grand bouton bleu **Modifier avec Elementor**.
5. Dans la zone de construction centrale, cliquez sur l'icône du **petit dossier gris** (*Ajouter un modèle*).
6. Allez dans l'onglet **Mes modèles**, recherchez votre page importée et cliquez sur **Insérer**.
7. À la question *"Souhaitez-vous également importer les réglages de document de ce modèle ?"*, sélectionnez **Oui**.

---

## ⚡ Étape 4 : Actions Post-Migration indispensables (Bedrock / DDEV)

L'importation native d'Elementor s'occupe de recréer les métadonnées. Cependant, pour finaliser le rendu visuel et corriger les chemins de fichiers dans votre environnement Bedrock, exécutez les actions suivantes :

### 1. Régénérer les fichiers CSS d'Elementor
Si les styles (couleurs, espacements) ne s'appliquent pas immédiatement à l'écran, forcez Elementor à reconstruire ses fichiers CSS physiques.

* **Via l'interface :** Allez dans **Elementor** > **Outils** > onglet **Général** et cliquez sur **Régénérer les fichiers et les données**.
* **Via WP-CLI / DDEV (Recommandé sur Bedrock) :**
  ```bash
  ddev wp elementor flush-css
  ```

### 2. Mettre à jour les URLs des images
Si certaines images pointent encore vers l'ancien nom de domaine du site source, utilisez l'outil de remplacement sécurisé d'Elementor pour corriger les chaînes JSON sérialisées en base de données.

* **Via l'interface :** Allez dans **Elementor** > **Outils** > onglet **Remplacer l'URL**.
* **Via WP-CLI / DDEV :**
  ```bash
  ddev wp elementor replace-urls https://ancien-domaine.com https://nouveau-domaine.local --all-post-types
  ```

### 3. Vider le cache du thème Astra
Pour finir, videz le cache dynamique généré par Astra pour s'assurer de la parfaite synchronisation des structures globales :
1. Allez dans **Astra** > **Tableau de bord**.
2. Cliquez sur le bouton **Clear CSS Cache**.