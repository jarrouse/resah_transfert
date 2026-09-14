
import * as cheerio from 'cheerio';

export async function replaceFooter(html){
    //61caf38

    const $ = cheerio.load(html);
    $('div[data-id="61caf38"], div[data-id="211"]').remove();
    $('div[data-id="a23a0b9"]').remove();
    $('.elementor-repeater-item-b273602').remove();

    return $.html();
}
