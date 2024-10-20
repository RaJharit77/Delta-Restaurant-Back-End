import cors from 'cors';
import express from 'express';
import fs from 'fs/promises';
import cron from 'node-cron';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const dbPath = process.env.DB_PATH || './database.db';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erreur lors de l\'ouverture de la base de données:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        db.run(`
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL
        );`
        );

        db.run(`CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            firstname TEXT NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            dateTime TEXT NOT NULL,
            guests INTEGER NOT NULL
        );
        `);

        db.run(`CREATE TABLE IF NOT EXISTS commandes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mealName TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            tableNumber INTEGER NOT NULL,
            orderNumber TEXT NOT NULL UNIQUE
        );
        `);
    }
});

const allowedOrigins = [
    'https://delta-restaurant-madagascar.vercel.app',
    'https://delta-restaurant-madagascar.onrender.com',
    'http://localhost:5173'
];

const corsOptions = {
    origin: (origin, callback) => {
        console.log('Request origin:', origin);
        if (allowedOrigins.includes(origin) || !origin) {
            callback(null, true);
        } else {
            console.error('Not allowed by CORS', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// api
// Menus
app.get('/api/menus', async (req, res) => {
    try {
        const data = await fs.readFile(path.resolve(__dirname, './data/data.json'), 'utf8');
        console.log('Raw menu data:', data);
        const menuItems = JSON.parse(data);
        res.json(menuItems);
    } catch (error) {
        console.error('Error reading menu data:', error.message);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Contacts
app.post('/api/contacts', async (req, res) => {
    const { name, email, subject, message } = req.body;
    try {
        const db = await dbPromise;
        await db.run('INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)', [name, email, subject, message]);
        res.status(200).json({ message: 'Message envoyé avec succès.' });
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
        res.status(500).json({ message: 'Erreur lors de l\'envoi du message.' });
    }
});

// Réservations
app.post('/api/reservations', async (req, res) => {
    const { firstname, name, email, phone, dateTime, guests } = req.body;
    try {
        const db = await dbPromise;
        await db.run('INSERT INTO reservations (firstname, name, email, phone, dateTime, guests) VALUES (?, ?, ?, ?, ?, ?)', [firstname, name, email, phone, dateTime, guests]);
        res.status(200).json({ message: 'Réservation effectuée avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la réservation:', error);
        res.status(500).json({ message: 'Erreur lors de la réservation.' });
    }
});

//Gérer automatiquement le commande
const generateFormattedOrderNumber = (id) => {
    return id.toString().padStart(6, '0'); // Format de 6 chiffres
};

// Générer un numéro de commande unique et l'envoyer au frontend
app.get('/api/generateOrderNumber', async (req, res) => {
    try {
        const db = await dbPromise;
        // Créer une nouvelle commande temporaire pour obtenir l'ID auto-incrémenté
        const result = await db.run('INSERT INTO commandes (mealName, quantity, tableNumber, orderNumber) VALUES (?, ?, ?, ?)',
            ['', 0, 0, '']); // Valeurs temporaires

        // Utiliser l'ID pour générer un numéro de commande formaté
        const orderNumber = generateFormattedOrderNumber(result.lastID);

        // Mettre à jour la commande avec le numéro formaté
        await db.run('UPDATE commandes SET orderNumber = ? WHERE id = ?', [orderNumber, result.lastID]);

        res.status(200).json({ orderNumber });
    } catch (error) {
        console.error('Erreur lors de la génération du numéro de commande:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.post('/api/commandes', async (req, res) => {
    const { mealName, quantity, tableNumber } = req.body;

    if (!mealName || !quantity || !tableNumber) {
        return res.status(400).json({ message: 'Veuillez remplir tous les champs.' });
    }

    try {
        const db = await dbPromise;

        // Insérer la commande sans numéro
        const result = await db.run('INSERT INTO commandes (mealName, quantity, tableNumber, orderNumber) VALUES (?, ?, ?, ?)',
            [mealName, quantity, tableNumber, '']); // Order number temporaire

        // Utiliser l'ID auto-incrémenté pour générer un numéro de commande formaté
        const orderNumber = generateFormattedOrderNumber(result.lastID);

        // Mettre à jour la commande avec le numéro formaté
        await db.run('UPDATE commandes SET orderNumber = ? WHERE id = ?', [orderNumber, result.lastID]);

        res.status(200).json({
            message: 'Commande reçue avec succès!',
            order: { mealName, quantity, tableNumber, orderNumber }
        });
    } catch (error) {
        console.error('Erreur lors du traitement de la commande:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

const resetOrderNumbers = async () => {
    const db = await dbPromise;
    await db.run('DELETE FROM commandes');  // Supprime les commandes de la journée passée
    console.log('Numéros de commandes réinitialisés pour la nouvelle journée');
};

// Planifie la tâche pour se déclencher tous les jours à minuit
cron.schedule('0 0 * * *', () => {
    resetOrderNumbers();
});


app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});