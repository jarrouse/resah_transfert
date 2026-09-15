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
    return content.replaceAll(/https?:\/\/(?:www\.)?resah\.fr\/?/g, "/");
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
    const directPath = path.join(filePath, queryString ?? '', 'index.html');
    
    try{
        return await fs.promises.readFile(directPath, encoding)
    }catch(err) {
        // Fallback: scan sibling folders that start with the same basename.
        const dir = path.dirname(filePath);
        let files;

        try {
            files = await fs.promises.readdir(dir);
        } catch (dirErr) {
            if (dirErr?.code === 'ENOENT') {
                throw new Error(`File not found: ${filePath}`);
            }

            throw dirErr;
        }

        for (const file of files) {

            if (file.startsWith(path.basename(filePath))) {
                try {
                    return await fs.promises.readFile(path.join(dir, file, 'index.html'), encoding);
                } catch {
                    // Keep scanning sibling candidates.
                }
            }
        }
    };
    

    throw new Error(`File not found: ${filePath}`);
}