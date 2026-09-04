import fs from 'node:fs/promises';
import path from 'node:path';
import config from "./config.js" ;

const { WP_SITE_URL,WP_USERNAME,APPLICATION_PASSWORD } = config

const JSON_FOLDER = process.argv[2]; // Dossier contenant vos fichiers JSON

// Encodage des identifiants pour l'authentification Basic
const authHeader = `Basic ${Buffer.from(`${WP_USERNAME}:${APPLICATION_PASSWORD}`).toString('base64')}`;

async function createCategory(categoryData) {
  try {
    // WordPress requiert au minimum un nom pour créer une catégorie
    if (!categoryData.name) {
      console.warn(`⚠️ Élément ignoré : propriété 'name' manquante.`);
      return;
    }

    const response = await fetch(`${WP_SITE_URL}/wp-json/wp/v2/categories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        name: categoryData.name,
        slug: categoryData.slug || undefined,
        description: categoryData.description || '',
        parent: categoryData.parent || undefined
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log(`✅ Catégorie créée avec succès : "${result.name}" (ID: ${result.id})`);
    } else {
      // Gère le cas où la catégorie existe déjà (code: term_exists)
      if (result.code === 'term_exists') {
        console.log(`ℹ️ La catégorie "${categoryData.name}" existe déjà (ID existant: ${result.data.term_id}).`);
      } else {
        console.error(`❌ Erreur API pour "${categoryData.name}":`, result.message);
      }
    }
  } catch (error) {
    console.error(`❌ Erreur réseau lors de la création de "${categoryData.name}":`, error.message);
  }
}

async function main() {
  try {
    console.log(`🔍 Recherche récursive des fichiers JSON dans : ${JSON_FOLDER}`);

    // Récupère récursivement tous les fichiers et dossiers
    const entries = await fs.readdir(JSON_FOLDER, { 
      withFileTypes: true, 
      recursive: true 
    });

    // Filtre pour ne garder que les fichiers qui se terminent par .json
    const jsonFiles = entries
      .filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.html')
      .map(entry => path.join(entry.parentPath, entry.name)); // Reconstruit le chemin complet

    if (jsonFiles.length === 0) {
      console.log('❌ Aucun fichier .json trouvé.');
      return;
    }

    console.log(`📂 ${jsonFiles.length} fichier(s) JSON trouvé(s) dans l'arborescence. Début de l'importation...`);

    for (const filePath of jsonFiles) {
      console.log(`\n📄 Lecture : ${filePath}`);
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (Array.isArray(data)) {
        for (const item of data) {
          await createCategory(item);
        }
      } else {
        await createCategory(data);
      }
    }

    console.log('\n🏁 Importation récursive terminée !');
  } catch (error) {
    console.error('Erreur générale :', error.message);
  }
}


main();
