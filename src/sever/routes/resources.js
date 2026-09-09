import { fixDomain, resolveWithinRoot, readFile } from '../utils.js';
const lookupMap = new Map();

export async function handleResources(req, res, next) {

    try {
        const filePath = resolveWithinRoot(req.path);
        // const realPath = await fs.promises.realpath(filePath + queryString);
        if(!lookupMap.has(filePath)) {
            lookupMap.set(filePath,  await readFile(filePath , 'utf8', req.query).then(fixDomain));
        }
        const content = lookupMap.get(filePath);

        res.setHeader('Content-Type', req.path.endsWith('.css') ? 'text/css' : 'application/javascript');
        res.send(content);
    } catch (err) { 
        console.log(err)
        next();
    }

}