import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
const ROOT = process.argv[2] ?? path.join(__dirname);
const INDEX_PATH = process.argv[3]

// Handle CSS files specially

app.get(/.*\.css$/, async (req, res, next) => {
    console.log('CSS requested:', req.path);

    try {
        const cssPath = path.join(ROOT, req.path);
        const realPath = await fs.promises.realpath(cssPath);
        const content = await fs.promises.readFile(path.join(realPath,'index.html'), 'utf8');

        res.setHeaders(new Headers({ 'Content-Type': 'text/css'}));
        res.send(content);
    } catch (err) { 
        console.log(err)
        next();
    }

});

if(INDEX_PATH != null){
    const inedxContent = await fs.promises.readFile(INDEX_PATH, 'utf8');

    app.get("/index.html", async (req,res,next) => {
        try {

            res.setHeaders(new Headers({ 'Content-Type': 'text/html'}));
            res.send(inedxContent);
        } catch (err) { 
            console.log(err)
            next();
        }
    })
}

// // Serve all other static files
app.use(express.static(ROOT, {
    extensions: ['html'],
    
}));

app.listen(3000, () => {
    console.log('Server running on port 3000');
});