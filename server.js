import express from 'express';
import path from 'path';
import { ROOT } from './src/sever/config.js';
import { handleIndex, handleRoot, handlePage } from './src/sever/routes/index.js';
import { handleResources,handleJQuery } from './src/sever/routes/resources.js';

const app = express();


app.get("/index.html", handleIndex)
app.get(/\/qui-sommes-nous\//, handlePage('qui-sommes-nous'))
app.get(/^\/.*\.(css|js)$/i, handleResources)

app.get(/.*\/$/, handleRoot)

app.get(/.*jquery.min.js$/, handleJQuery);

// // Serve all other static files
app.use(express.static(ROOT, {
    extensions: ['html'],    
}));

app.use(express.static(path.join(import.meta.dirname, 'public')));
app.use((req, res) => {
    res.status(404).send('Resource not found');
});

const server = app.listen(3000, () => {
    console.log('Server running on port 3000');
});

let isShuttingDown = false;

function shutdown(signal) {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}, shutting down`);

    server.close((error) => {
        if (error) {
            console.error('Error while shutting down:', error);
            process.exitCode = 1;
        }
    });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));