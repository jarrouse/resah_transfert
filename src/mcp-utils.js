import * as cheerio from 'cheerio'

/**
 * Strips the <head> and any <style> tags from a full scraped HTML document,
 * to shrink it before further processing (cleanHtml) or feeding it to a model.
 *
 * @param {String} rawHtml
 * @returns {String}
 */
export function stripHeadAndStyles(rawHtml){
  const $ = cheerio.load(rawHtml);

  $('head').remove();
  $('style').remove();

  return $.html();
}

/**
 * Removes references to the old site's domain (resah.fr / www.resah.fr, any
 * scheme or protocol-relative) so links/resources become absolute paths on
 * the current site, and remaps /wp-content/uploads to Bedrock's /app/uploads.
 *
 * @param {String} rawHtml
 * @returns {String}
 */
export function stripSiteDomain(rawHtml){
  return rawHtml
      .replace(/(https?:)?\/\/(www\.)?resah\.fr/gi, '')
      .replace(/\/wp-content\/uploads/g, '/app/uploads');
}

/**
 * Like utils.js#cleanHtml, but targets the actual page-content Elementor root
 * (data-elementor-type="wp-page") instead of the first '.elementor' match
 * (which is usually the header), and keeps ALL top-level content sections
 * instead of only the first one.
 *
 * @param {String} rawHtml
 * @returns {String}
 */
export function cleanHtml(rawHtml){
  // 1. Charger le HTML sans ajouter de balises globales (html/body)
  const $ = cheerio.load(rawHtml, null, false);

  // 2. Cibler la racine Elementor du contenu de page (pas le header/footer,
  // qui sont aussi des conteneurs '.elementor' apparaissant avant le contenu dans le DOM)
  const elementorRoot = $('.elementor[data-elementor-type="wp-page"], .elementor[data-elementor-type="single-page"]').first()
      .length ? $('.elementor[data-elementor-type="wp-page"], .elementor[data-elementor-type="single-page"]').first() : $('.elementor').first();
  if (elementorRoot.length === 0) {
      throw new Error("Conteneur '.elementor' introuvable.");
  }

  // 3. Supprimer activement les balises de titre (h1, h2) qui polluent ce conteneur
  // (Utile si le titre est injecté dans un composant spécifique à l'intérieur)
  elementorRoot.find('h1, .elementor-heading-title').first().remove();

  // 4. Trouver le(s) conteneur(s) du contenu le plus bas / le plus direct
  // Elementor utilise généralement une structure avec un "wrap" interne ou des sections directes (.e-con / .elementor-section)
  // Une page peut être composée de plusieurs sections de premier niveau : on les garde toutes.
  let coreContent = elementorRoot.find('> .elementor-inner, > .elementor-section-wrap');

  // Si Elementor utilise le nouveau mode Flexbox/Grid, le contenu est directement dans les conteneurs '.e-con'
  if (coreContent.length === 0) {
      coreContent = elementorRoot.find('> .e-con, > .elementor-section');
  }

  // Si aucune structure connue n'est isolée, on se rabat sur les enfants directs de la racine
  if (coreContent.length === 0) {
      coreContent = elementorRoot.children();
  }

  if (coreContent.length === 0) {
      throw new Error("Impossible d'isoler la sous-structure de contenu Elementor.");
  }

  // 5. Récupérer le HTML de chaque section isolée
  let cleanHtml = coreContent.toArray().map((el) => $.html(el)).join('');

  // 6. Minification stricte pour bloquer le filtre 'wpautop' de WordPress
  cleanHtml = cleanHtml
      .replace(/\s+/g, ' ')       // Condense les espaces multiples
      .replace(/&quot;/g, '"')
      .trim();

  return cleanHtml;
}
