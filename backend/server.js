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

// Configuration CORS
const allowedOrigins = [
    'https://delta-restaurant-madagascar.vercel.app',
    'https://delta-restaurant-madagascar.onrender.com',
    'http://localhost:5173'
];

const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.includes(origin) || !origin) {
            callback(null, true);
        } else {
            console.error('Not allowed by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// Middleware pour gérer les erreurs
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// SQLite database setup
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erreur lors de l\'ouverture de la base de données:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        db.run(`
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                email TEXT,
                subject TEXT,
                message TEXT
            );
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS reservations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                firstname TEXT NOT NULL,
                name TEXT,
                email TEXT,
                phone TEXT,
                dateTime TEXT,
                guests INTEGER
            );
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS commandes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mealName TEXT,
                quantity INTEGER,
                tableNumber INTEGER,
                orderNumber TEXT
            );
        `);
    }
});

// Routes

// Menus
app.get('/api/menus', async (req, res) => {
    try {
        const data = await fs.readFile(path.resolve(__dirname, './data/data.json'), 'utf8');
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
    if (!name || !email || !message) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    try {
        const result = await db.run(
            'INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)',
            [name, email, subject, message]
        );
        res.status(200).json({ message: 'Message envoyé avec succès.', contactId: result.lastID });
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
        res.status(500).json({ message: 'Erreur lors de l\'envoi du message.' });
    }
});

// Réservations
app.post('/api/reservations', async (req, res) => {
    const { firstname, name, email, phone, dateTime, guests } = req.body;
    if (!firstname || !dateTime || !guests) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    try {
        const result = await db.run(
            'INSERT INTO reservations (firstname, name, email, phone, dateTime, guests) VALUES (?, ?, ?, ?, ?, ?)',
            [firstname, name, email, phone, dateTime, guests]
        );
        res.status(200).json({ message: 'Réservation effectuée avec succès.', reservationId: result.lastID });
    } catch (error) {
        console.error('Erreur lors de la réservation:', error);
        res.status(500).json({ message: 'Erreur lors de la réservation.' });
    }
});

// Génération de numéro de commande
const generateFormattedOrderNumber = (id) => {
    return id.toString().padStart(6, '0');
};

app.get('/api/generateOrderNumber', async (req, res) => {
    try {
        await db.run('INSERT INTO commandes (mealName, quantity, tableNumber, orderNumber) VALUES (?, ?, ?, ?)', ['', 0, 0, '']);
        const orderNumber = generateFormattedOrderNumber(this.lastID);
        
        // Mettez à jour le numéro de commande et gérez les erreurs
        db.run('UPDATE commandes SET orderNumber = ? WHERE id = ?', [orderNumber, this.lastID], (updateErr) => {
            if (updateErr) {
                return res.status(500).json({ message: 'Erreur lors de la mise à jour du numéro de commande.', error: updateErr.message });
            }
            res.status(200).json({ orderNumber });
        });
    } catch (error) {
        console.error('Erreur lors de la génération du numéro de commande:', error.message);
        res.status(500).json({ message: 'Erreur interne lors de la génération du numéro de commande.', error: error.message });
    }
});

// Commandes
app.post('/api/commandes', async (req, res) => {
    const { mealName, quantity, tableNumber } = req.body;
    if (!mealName || !quantity || !tableNumber) {
        return res.status(400).json({ message: 'Veuillez remplir tous les champs.' });
    }

    const orderNumber = generateFormattedOrderNumber(Date.now()); // Un numéro de commande basé sur l'heure

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('INSERT INTO commandes (mealName, quantity, tableNumber, orderNumber) VALUES (?, ?, ?, ?)', [mealName, quantity, tableNumber, orderNumber], function(err) {
            if (err) {
                console.error('Erreur lors de l\'insertion de la commande:', err.message);
                return res.status(500).json({ message: 'Erreur interne lors de la création de la commande.' });
            }

            db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                    console.error('Erreur lors de la validation de la transaction:', commitErr.message);
                    return res.status(500).json({ message: 'Erreur lors de la validation de la commande.' });
                }
                res.status(200).json({ message: 'Commande reçue avec succès!', order: { mealName, quantity, tableNumber, orderNumber } });
            });
        });
    });
});

// Réinitialisation des numéros de commande quotidiennement
const resetOrderNumbers = async () => {
    await db.run('DELETE FROM commandes');
    console.log('Numéros de commandes réinitialisés pour la nouvelle journée');
};

// Planifie la tâche pour se déclencher tous les jours à minuit
cron.schedule('0 0 * * *', () => {
    resetOrderNumbers();
});

// Démarrage du serveur
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});