const express = require('express');
const path = require('path');
const compression = require('compression');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware pour la compression (important pour les gros GeoJSON)
app.use(compression({
    level: 6,
    threshold: 1024, // Compresser les fichiers > 1KB
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// CORS pour permettre les requêtes cross-origin
app.use(cors());

// Cache statique pour les fichiers (important pour les performances)
app.use(express.static('.', {
    maxAge: '1d', // Cache 1 jour pour les fichiers statiques
    etag: true,
    setHeaders: (res, path) => {
        // Cache plus long pour les GeoJSON (ils changent rarement)
        if (path.endsWith('.geojson')) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h
        }
        // Cache plus court pour les fichiers JS/CSS
        if (path.endsWith('.js') || path.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1h
        }
    }
}));

// Route pour servir index.html à la racine
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Gestion des erreurs 404
app.use((req, res) => {
    res.status(404).send('Page non trouvée');
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`📊 Compression activée pour les gros fichiers`);
    console.log(`⚡ Cache optimisé pour les performances`);
});

// Gestion gracieuse de l'arrêt
process.on('SIGTERM', () => {
    console.log('🛑 Arrêt du serveur...');
    process.exit(0);
});

