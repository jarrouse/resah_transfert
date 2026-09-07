# Guide : Versionnage Git, WP-CLI et Connexion Production (Bedrock + DDEV)

Ce guide explique comment structurer votre projet Bedrock/DDEV pour versionner le contenu via des exports SQL et comment configurer **WP-CLI** en local pour piloter directement votre instance de production à travers des alias SSH (WP-CLI Aliases).

---

## 1. Structure du projet et `.gitignore`

Avec Bedrock, le cœur de WordPress et les plugins tiers sont gérés par Composer. Vous ne devez versionner que votre code personnalisé (thèmes, plugins maison) et les configurations de l'environnement.

Créez un dossier `db/` à la racine pour accueillir vos exports de base de données.

### Fichier `.gitignore` recommandé
Créez ou modifiez le fichier `.gitignore` à la racine de votre projet :

```text
# Éléments d'environnement et de serveurs
.env
.env.*
!.env.example
web/.htaccess

# DDEV (Optionnel : à conserver si vous partagez la config avec l'équipe)
#.ddev/
.ddev/.importdb*

# Cœur de WordPress (géré par Composer)
web/wp/

# Dépendances (Composer & NPM)
vendor/
node_modules/

# Contenu WordPress (Plugins et thèmes tiers gérés par Composer)
web/app/plugins/*
web/app/mu-plugins/*
web/app/upgrade/
web/app/cache/

# Exceptions pour vos développements personnalisés
!web/app/plugins/.gitkeep
!web/app/mu-plugins/.gitkeep
!web/app/themes/votre-theme-sur-mesure/

# Médias et fichiers téléversés (Ne jamais versionner)
web/app/uploads/*
!web/app/uploads/.gitkeep

# Base de données (On ne garde que le fichier latest.sql mis à jour)
db/*
!db/latest.sql
```

---

## 2. Flux de travail : Versionner le contenu via SQL

### En local (Export avant commit)
Lorsque vous modifiez du contenu ou des configurations dans l'admin locale, exportez la base de données dans le fichier suivi par Git avant de commit :

```bash
ddev wp db export db/latest.sql
```

Ajoutez le fichier à Git et poussez vos modifications :
```bash
git add db/latest.sql
git commit -m "Feat: Mise à jour du contenu et de la configuration"
git push origin main
```

### En Production (Importation manuelle de secours)
Si vous devez importer ce fichier manuellement sur le serveur via SSH :
```bash
# 1. Importer le fichier SQL mis à jour
wp db import db/latest.sql

# 2. Remplacer les URLs locales par les URLs de production
wp search-replace 'https://mon-projet.ddev.site' 'https://www.mon-site-production.fr' --all-tables
```

---

## 3. Connecter WP-CLI local à l'instance de Production

Pour éviter de vous connecter en SSH à chaque fois, vous pouvez configurer des **alias WP-CLI**. Cela vous permet d'exécuter des commandes sur votre serveur de production directement depuis votre terminal local (ou depuis le conteneur DDEV).

### Prérequis
* Un accès **SSH par clé publique** fonctionnel vers votre serveur de production depuis votre machine.
* **WP-CLI** installé sur le serveur de production.

### Étape 1 : Créer le fichier de configuration WP-CLI
Créez un fichier nommé `wp-cli.yml` (ou `wp-cli.local.yml`) à la **racine de votre projet** (au même niveau que le `composer.json`).

### Étape 2 : Configurer l'alias de production
Ajoutez la configuration suivante en l'adaptant à vos accès serveurs. 

*Note pour Bedrock :* Il est crucial de spécifier le chemin exact vers le dossier du cœur de WordPress (`web/wp`) dans le paramètre `path`.

```yaml
# Configuration des alias WP-CLI
@prod:
  ssh: user_ssh@adresse_ip_serveur:port_ssh/chemin/vers/votre/projet/current
  path: web/wp
  url: https://www.mon-site-production.fr
```

> **Explication du chemin SSH :** Si vous utilisez un déploiement atomique (comme Deployer ou Capistrano), pointez vers le lien symbolique `current`. Le chemin complet doit correspondre à l'endroit où se trouve le fichier `wp-config.php` (qui, chez Bedrock, redirige vers `web/wp`).

### Étape 3 : Utiliser l'alias depuis votre machine locale

Une fois configuré, vous pouvez piloter votre site de production à distance. **Plus besoin de faire un SSH manuel.**

#### Tester la connexion :
```bash
# Hors DDEV (si wp-cli est installé sur votre machine hôte)
wp @prod core version

# Depuis DDEV (Recommandé pour s'assurer que les clés SSH sont partagées)
ddev wp @prod core version
```

#### Synchroniser la BDD de Production vers le Local en une ligne :
Grâce à cet alias, vous pouvez importer la base de données de production directement sur votre instance DDEV locale de manière sécurisée :
```bash
ddev wp @prod db export - | ddev wp db import -
ddev wp search-replace 'https://www.mon-site-production.fr' 'https://mon-projet.ddev.site' --all-tables
```

#### Autres commandes de production à distance utiles :
```bash
# Voir les plugins actifs en production
ddev wp @prod plugin list

# Vider le cache d'object cache ou de transiants en prod
ddev wp @prod cache flush

# Mettre à jour les traductions en prod
ddev wp @prod core language update
```

---

## 4. Sécurité et Bonnes Pratiques

1. **Ne poussez jamais de données sensibles :** Si votre base de données locale contient des comptes utilisateurs avec des mots de passe faibles, utilisez l'option `--skip-columns=user_pass` lors de l'export ou nettoyez la table `wp_users`.
2. **Clés SSH et DDEV :** Si DDEV ne parvient pas à se connecter à l'alias `@prod`, assurez-vous que votre clé SSH est chargée dans l'agent DDEV en exécutant localement :
   ```bash
   ddev auth ssh
   ```