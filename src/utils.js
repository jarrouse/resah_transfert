import * as cheerio from 'cheerio'

/**
 * 
 * @param {String} text 
 * @returns {String}
 */
export async function changeResourceURI(text){
  return text.replaceAll('https:\\/\\/resah.fr','')
    .replaceAll('https:\\/\\/www.resah.fr','')
    .replaceAll('\\/wp-content\\/uploads','\\/app\\/uploads')
}

export function cleanHtml(rawHtml){
  // 1. Charger le HTML sans ajouter de balises globales (html/body)
  const $ = cheerio.load(rawHtml, null, false);

  // 2. Cibler la racine Elementor
  const elementorRoot = $('.elementor').first();
  if (elementorRoot.length === 0) {
      throw new Error("Conteneur '.elementor' introuvable.");
  }

  // 3. Supprimer activement les balises de titre (h1, h2) qui polluent ce conteneur
  // (Utile si le titre est injecté dans un composant spécifique à l'intérieur)
  elementorRoot.find('h1, .elementor-heading-title').first().remove();

  // 4. Trouver le conteneur du contenu le plus bas / le plus direct
  // Elementor utilise généralement une structure avec un "wrap" interne ou des sections directes (.e-con / .elementor-section)
  let coreContent = elementorRoot.find('> .elementor-inner, > .elementor-section-wrap').first();

  // Si Elementor utilise le nouveau mode Flexbox/Grid, le contenu est directement dans les premiers conteneurs '.e-con'
  if (coreContent.length === 0) {
      coreContent = elementorRoot.find('> .e-con, > .elementor-section').first();
  }



  // Si aucune structure connue n'est isolée, on se rabat sur le premier enfant direct de la racine
  if (coreContent.length === 0) {
      coreContent = elementorRoot.children().first();
  }

  if (coreContent.length === 0) {
      throw new Error("Impossible d'isoler la sous-structure de contenu Elementor.");
  }

  // 5. Récupérer le HTML de cette zone isolée
  let cleanHtml = $.html(coreContent);

  // 6. Minification stricte pour bloquer le filtre 'wpautop' de WordPress
  cleanHtml = cleanHtml
      // .replace(/[\t\r\n]+/g, ' ')  // Supprime les retours à la ligne et tabulations
      .replace(/\s+/g, ' ')       // Condense les espaces multiples
      .replace(/&quot;/g, '"')
      .trim();

  return cleanHtml;
}