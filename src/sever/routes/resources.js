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
        // const realPath = await fs.promises.realpath(filePath + queryString);
        if(!lookupMap.has(filePath)) {
            const file = await readFile(filePath , 'utf8', req.query).then(fixDomain);
            lookupMap.set(filePath,  file);
        }
        const content = lookupMap.get(filePath);

        res.setHeader('Content-Type', req.path.endsWith('.css') ? 'text/css' : 'application/javascript');
        res.send(content);
    } catch (err) { 
        console.log(err)
        next();
    }

}