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