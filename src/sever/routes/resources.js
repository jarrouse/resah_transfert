import fs from 'fs/promises';
import path from 'path';
import { fixDomain, resolveWithinRoot, readFile } from '../utils.js';
const lookupMap = new Map();

//create a handler to catch request jquery
//  minimized files and serve them correctly from public js folder
export async function handleJQuery(req, res, next) {
    const filePath = path.join('./public/js', 'jquery.min.js');
    await fs.readFile(filePath, 'utf8').then(fixDomain)
        .then(content => {
            res.setHeader('Content-Type', 'application/javascript');
            res.send(content);        
        })
        .catch(err => {
            console.log(err);
            next();
        });

    
}

export async function handleResources(req, res, next) {

    try {
        const filePath = resolveWithinRoot(req.path);
        const queryKey = new URLSearchParams(req.query).toString();
        const cacheKey = `${filePath}?${queryKey}`;
        // const realPath = await fs.promises.realpath(filePath + queryString);
        if(!lookupMap.has(cacheKey)) {
            const file = await readFile(filePath , 'utf8', req.query).then(fixDomain);
            lookupMap.set(cacheKey,  file);
        }
        const content = lookupMap.get(cacheKey);

        res.setHeader('Content-Type', req.path.endsWith('.css') ? 'text/css' : 'application/javascript');
        res.send(content);
    } catch (err) { 
        // Missing archived assets are expected in local snapshots: fallback to next middleware/404.
        if (err?.code === 'ENOENT' || String(err?.message ?? '').startsWith('File not found:')) {
            return next();
        }

        console.log(err)
        next();
    }

}