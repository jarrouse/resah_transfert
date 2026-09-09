import fs from 'fs';
import path from 'path';
import { ROOT } from './config.js';

export function resolveWithinRoot(requestPath) {
    const filePath = path.resolve(ROOT, `.${requestPath}`);
    const relativePath = path.relative(ROOT, filePath);

    if (relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
        throw new Error(`Path is outside the configured root: ${requestPath}`);
    }

    return filePath;
}

export function fixDomain(content){
    return content.replaceAll("https://www.resah.fr","")
        .replaceAll("https://resah.fr","")
        .replaceAll("http://resah.fr","")
        .replaceAll("http://www.resah.fr","")
}

export function transformQueryString(query) {
    const queryArray = Object.entries(query);

    if (!query || queryArray.length === 0) {
        return ;
    }

    return "__"+queryArray
        .map(([key, value]) => `${encodeURIComponent(key)}_${encodeURIComponent(value)}`)
        .join('');
}

export async function readFile(filePath, encoding, query) {
    const queryString = transformQueryString(query);
    
    try{
        return await fs.promises.readFile(path.join(filePath, queryString ?? '', 'index.html'), encoding)
    }catch(err) {
        // read all the file matching the filepath in the parent directory
        const dir = path.dirname(filePath);
        const files = await fs.promises.readdir(dir);

        for (const file of files) {

            if (file.startsWith(path.basename(filePath))) {
                return await fs.promises.readFile(path.join(dir, file, 'index.html'), encoding);
            }
        }
    };
    

    throw new Error(`File not found: ${filePath}`);
}