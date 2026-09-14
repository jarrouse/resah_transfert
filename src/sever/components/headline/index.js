import * as cheerio from 'cheerio';
import fs from 'fs';

const template = await fs.promises.readFile(new URL('./template.html', import.meta.url), 'utf8');

export async function replaceHeadline(html) {

    const $ = cheerio.load(html);
    $('#e-n-menu-title-4531').remove();
    $('#e-n-menu-title-4535').remove();

    $('div[data-id="6d48450"]').prepend(template);

    return $.html();
}