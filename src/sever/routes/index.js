import fs from 'fs';
import path from 'path';
import { INDEX_PATH } from '../config.js';
import { fixDomain, resolveWithinRoot, readFile } from '../utils.js';
import replaceMenu from '../components/menu/index.js';

/** @type {Map<string, Promise<string>>} */
const pageCache = new Map();

function fixJQueryScript(content){
    return content.replace(/<script[^>]*data-src=["']([^"']*jquery[^"']*)["'][^>]*><\/script>/gi, '<script src="/public/js/jquery.min.js" type="text/javascript"></script>');
}

function getCached(cacheKey, readPath) {
    let content = pageCache.get(cacheKey);

    if (content == null) {
        console.log(`Caching content for key: ${cacheKey}`);
        content = fs.promises.readFile(readPath, 'utf8')
            .then(fixDomain)
            .then(fixJQueryScript)
            .then(replaceMenu)
            // avoid caching a rejected read
            .catch(err => {
                pageCache.delete(cacheKey);
                throw err;
            });
            
        pageCache.set(cacheKey, content);
    }

    return content;
}

function getIndex() {
    if (INDEX_PATH == null) {
        return Promise.reject(new Error('INDEX_PATH is not configured'));
    }

    return getCached(INDEX_PATH, INDEX_PATH);
}

function getPage(filePath) {
    return getCached(filePath, path.join(filePath, 'index.html'));
}

export async function handleIndex(req, res, next) {
    const d = new Date();
    
    console.log(d.toISOString(),'Index requested:', req.url);

    await getIndex()
        .then(content => {
            res.setHeader('Content-Type', 'text/html');
            res.send(content);
        })
        .catch(err => {
            console.log(err);
            next();
        });

    console.log(new Date().toISOString(),'Index handling completed for (duration):', new Date().getTime()-d.getTime(), req.url);
}

export function handlePage(name){
    return async (req,res,next) => getCached(name, path.join(process.cwd(), 'public', `${name}.html`))
        .then(content => {

            console.log('Page requested:', name);
            res.setHeader('Content-Type', 'text/html');
            res.send(content);
        })
        .catch(err => {
            console.log(err);
            next();
        });
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
        await handleIndex(req, res, next);
    } else {
        const filePath = resolveWithinRoot(req.path);
        await getPage(filePath)
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