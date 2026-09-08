
import fs from 'fs'
import path from 'node:path';

import { changeResourceURI, cleanHtml } from './src/utils.js'


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
    const elementorData = jsonSource.spectra_custom_meta?._elementor_data ?? '';
    // const metaData2 = {
    //     ...metaData,
    //     ...jsonSource.spectra_custom_meta,
    //     "site-sidebar-layout": jsonSource.meta["site-sidebar-layout"][0] ?? "",
    //     "site-content-layout": jsonSource.spectra_custom_meta["site-sidebar-layout"]?.[0] ?? "",
    //     "ast-site-content-layout": jsonSource.spectra_custom_meta["ast-site-content-layout"]?.[0] ?? "",
    //     "site-content-style": jsonSource.spectra_custom_meta["site-content-style"]?.[0] ?? "",
    //     "site-post-title": jsonSource.spectra_custom_meta["site-post-title"]?.[0] ?? "",
    //     "ast-featured-img": jsonSource.spectra_custom_meta["ast-featured-img"]?.[0] ?? "",
    //     "theme-transparent-header-meta": jsonSource.spectra_custom_meta["theme-transparent-header-meta"]?.[0] ?? "",
    //     "adv-header-id-meta": jsonSource.spectra_custom_meta["adv-header-id-meta"]?.[0] ?? "",
    //     "stick-header-meta": jsonSource.spectra_custom_meta["stick-header-meta"]?.[0] ?? "",
    //     "astra-migrate-meta-layouts": jsonSource.spectra_custom_meta["astra-migrate-meta-layouts"]?.[0] ?? "",
    //     "footnotes": jsonSource.spectra_custom_meta["footnotes"]?.[0] ?? "",
    //     "_elementor_edit_mode": jsonSource.spectra_custom_meta["_elementor_edit_mode"]?.[0] ?? "",
    //     "_elementor_template_type": jsonSource.spectra_custom_meta["_elementor_template_type"]?.[0] ?? "",
    //     "_elementor_data": jsonSource.spectra_custom_meta["_elementor_data"]?.[0] ?? "",
    //     "_elementor_edit_mode": "builder",
    //     "_elementor_template_type": "wp-page",
    //     "site-sidebar-style": jsonSource.spectra_custom_meta["site-sidebar-style"]?.[0] ?? ""
    //   }
    if (!elementorData) {
      console.warn('⚠️ Attention : Aucune donnée "_elementor_data" trouvée dans le JSON. La page risque d\'être vide dans Elementor.');
    }

    // 5. Préparation de la requête pour l'API WordPress
    const pageData = {
      title: jsonSource.title?.rendered || jsonSource.title || 'Page Importée Elementor',
      status: 'publish', // 'publish' pour la mettre en ligne, 'draft' pour un brouillon
      type: 'page',
      content: {
        // raw: jsonSource.content?.raw || "",
        // rendered: jsonSource.content?.rendered || ""
      }, // Elementor utilise les meta, le contenu principal reste généralement vide
      meta: {
        ...jsonSource.meta,
        ...transformSpectraMetadata(jsonSource.spectra_custom_meta)
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
    console.log(error)
    console.error('❌ Échec de l\'importation :', error.message);
  }
}

function transformSpectraMetadata(obj){
  return Object.keys(obj).reduce((acc, key) => {
    acc[key] = obj[key][0];
    return acc;
  }, {});
}



async function main(){
  const entries = await fs.promises.readdir(path.join(import.meta.dirname,archivePath), { 
    withFileTypes: true, 
    recursive: true 
  });

  const jsonFilePaths = entries
    .filter(entry => entry.isFile() && path.extname(entry.name).toLowerCase() === '.html' )
    .filter(entry => (id != null ? entry.parentPath.endsWith('pages/'+id) : true) )
    .map(entry => path.join(entry.parentPath, entry.name)); // Reconstruit le chemin complet


  console.log(jsonFilePaths)

  for(let jsonFilePath of jsonFilePaths ){
    
    await fs.promises.readFile(jsonFilePath, 'utf8')
      .then(rawData => changeResourceURI(rawData))
      .then(rawData =>{

        return JSON.parse(rawData)
      })
      .then(json => importElementorPage(json))
  }
}

await main()