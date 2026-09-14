import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';

const TEMPLATE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'template.html');

let templateCache;

async function getTemplate() {
    templateCache ??= await fs.readFile(TEMPLATE_PATH, 'utf8');

    return templateCache;
}

export async function replaceMenu(html) {
    const $ = cheerio.load(html);
    const menus = $('nav.e-n-menu[data-widget-number="125"], nav.e-n-menu[data-widget-number="211"]');

    if (menus.length === 0) {
        return html;
    }

    const template = await getTemplate();

    menus.each((_, el) => {
        $(el).replaceWith(template);
    });

    // if ($(`head link[href="${STYLESHEET_HREF}"]`).length === 0) {
    //     $('head').append(`<link rel="stylesheet" href="${STYLESHEET_HREF}" media="all">`);
    // }

    return $.html();
}

export default replaceMenu;
