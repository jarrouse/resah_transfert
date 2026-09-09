import fs from 'fs';
import path from 'path';
import { INDEX_PATH } from '../config.js';
import { fixDomain, resolveWithinRoot, readFile } from '../utils.js';

let indexContent;

if(INDEX_PATH != null){
    indexContent = await fs.promises.readFile(INDEX_PATH, 'utf8')
        .then(content => fixDomain(content))

}

export function handleIndex(req, res, next) {
    console.log('Index requested:', req.url);   
    try {
        res.setHeader('Content-Type', 'text/html');
        res.send(indexContent);
    } catch (err) { 
        console.log(err)
        next();
    }
}
/**
 * @param {import('express').Request} req 
 * @param {import('express').Response} res 
 * @param {import('express').NextFunction} next 
 */
export async function handleRoot(req, res, next) {
    console.log('Root requested:', req.url);

    //match root URL for the current hostname with port if there is one
    if(req.url === '/') {
        handleIndex(req, res, next);
    } else {
        const filePath = resolveWithinRoot(req.path);
        await fs.promises.readFile(path.join(filePath, 'index.html'), 'utf8')
            .then(fixDomain)
            .then(content => {
                res.setHeader('Content-Type', 'text/html');
                res.send(content);
            })
            .catch(err => {
                console.log(err);
                next();
            });

    }
}