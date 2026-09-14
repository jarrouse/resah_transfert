import * as cheerio from 'cheerio';

export async function cleanHeader(html){
    const $ = cheerio.load(html);
    $('div[data-id="e61a28e"]').remove();

    return $.html();
}