import fs from 'fs';

const dbPath = './database.db';

fs.stat(dbPath, (err, stats) => {
    if (err) {
        console.error('Erreur lors de la vérification de la taille du fichier:', err);
        return;
    }
    console.log(`Taille du fichier: ${(stats.size / (1024 * 1024)).toFixed(2)} Mo`);
});
