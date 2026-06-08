import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
// Log incoming requests
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});
// Serve static assets from Vite build output 'dist'
app.use(express.static(path.join(__dirname, 'dist')));
// Fallback to React index.html for SPA client-side routing
app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});
app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`  WORLD CUP PREDICTOR GAME IS RUNNING`);
    console.log(`  Local Address: http://localhost:${PORT}`);
    console.log(`  Environment:   ${process.env.NODE_ENV || 'development'}`);
    console.log(`=========================================`);
});
