// import-elementor-page.js
import fs from 'fs'
import path from 'node:path';
import { changeResourceURI } from './src/utils.js'

// 1. Configuration de l'accès WordPress
import config from "./config.js" ;

const { WP_SITE_URL,WP_USERNAME,APPLICATION_PASSWORD } = config


// 2. Encodage des identifiants (Authentification Basic)
const credentials = Buffer.from(`${WP_USERNAME}:${APPLICATION_PASSWORD}`).toString('base64');

const archivePath = process.argv[2]
const id = process.argv[3]

async function importElementorPage(jsonSource) {
  try {

    console.log('📖 Fichier JSON chargé avec succès.');

    // 4. Extraction et validation des données Elementor
    // Nous vérifions si les métadonnées Elementor existent dans le JSON d'origine
    const metaData = jsonSource.meta || {};
    const elementorData = metaData._elementor_data ?? jsonSource.content.rendered ?? '';

    if (!elementorData) {
      console.warn('⚠️ Attention : Aucune donnée "_elementor_data" trouvée dans le JSON. La page risque d\'être vide dans Elementor.');
    }

    // 5. Préparation de la requête pour l'API WordPress
    const pageData = {
      title: jsonSource.title?.rendered || jsonSource.title || 'Page Importée Elementor',
      status: 'publish', // 'publish' pour la mettre en ligne, 'draft' pour un brouillon
      type: 'page',
      content: elementorData, // Elementor utilise les meta, le contenu principal reste généralement vide
      meta: {
        _elementor_edit_mode: 'builder',
        _elementor_template_type: 'page',
        _elementor_data: typeof elementorData === 'object' ? JSON.stringify(elementorData) : elementorData
      }
    };

    console.log(`🚀 Envoi de la page "${pageData.title}" vers WordPress...`);

    // 6. Envoi de la requête API
    const endpoint = `${WP_SITE_URL}/wp-json/wp/v2/pages`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${credentials}`
      },
      body: JSON.stringify(pageData)
    }).catch(e => console.log(e));

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Erreur API WordPress: ${data.message} (${data.code})`);
    }

    console.log('✅ Page Elementor créée et configurée avec succès !');
    console.log(`🔗 Lien de la page : ${data.link}`);
    console.log(`🆔 ID de la page : ${data.id} / ${data.title.rendered}`);
    console.log('💡 Allez sur votre tableau de bord WordPress et cliquez sur "Modifier avec Elementor" pour vérifier.');

  } catch (error) {
    console.error('❌ Échec de l\'importation :', error.message);
  }
}



async function main(){
  const entries = await fs.promises.readdir(archivePath, { 
    withFileTypes: true, 
    recursive: true 
  });

  const jsonFilePaths = entries
    .filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.html')
    .filter(entry => id != null ? entry.parentPath.includes(id) : true )
    .map(entry => path.join(entry.parentPath, entry.name)); // Reconstruit le chemin complet

  for(let jsonFilePath of jsonFilePaths ){
    
    await fs.promises.readFile(jsonFilePath, 'utf8')
      .then(rawData => changeResourceURI(rawData))
      .then(rawData =>JSON.parse(rawData))
      .then(json => importElementorPage(json))
  }
}

main()