import compression from 'compression';
import express from 'express';
import path from 'path';
import { ROOT } from './src/sever/config.js';
import { handleIndex, handleRoot, handlePage } from './src/sever/routes/index.js';
import { handleResources,handleJQuery } from './src/sever/routes/resources.js';

const app = express();

app.disable('x-powered-by');
app.use(compression());

const cacheControl = 'public, max-age=300, stale-while-revalidate=60';

app.use((req, res, next) => {
    res.setHeader('Cache-Control', cacheControl);
    next();
});

app.get('/index.html', handleIndex);
app.get(/\/qui-sommes-nous\//, handlePage('qui-sommes-nous'));
app.get(/\/eco-conception-de-la-prise-en-charge-des-patients\//, handlePage('eco-conception-de-la-prise-en-charge-des-patients'));
app.get(/.*jquery.min.js$/, handleJQuery);
app.get(/^\/.*\.(css|js)$/i, handleResources);

app.get(/.*\/$/, handleRoot);

// // Serve all other static files
app.use(express.static(ROOT, {
    extensions: ['html'],
    cacheControl: false,
}));

app.use(express.static(path.join(import.meta.dirname, 'public'), {
    cacheControl: false,
}));
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