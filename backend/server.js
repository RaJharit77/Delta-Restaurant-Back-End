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

// SQLite database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erreur lors de l\'ouverture de la base de données:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS commandes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mealName TEXT,
            softDrink TEXT,
            quantity INTEGER,
            tableNumber TEXT
        );`, (err) => {
            if (err) {
                console.error('Erreur lors de la création de la table commandes:', err.message);
            }
        });
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            subject TEXT,
            message TEXT
        );`, (err) => {
            if (err) {
                console.error('Erreur lors de la création de la table contacts:', err.message);
            }
        });
        db.run(`CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            firstname TEXT NOT NULL,
            name TEXT,
            email TEXT,
            phone TEXT,
            dateTime TEXT,
            guests INTEGER
        );`, (err) => {
            if (err) {
                console.error('Erreur lors de la création de la table reservations:', err.message);
            }
        });
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

// Commandes
app.post('/api/commandes', (req, res) => {
    const { mealName, softDrink, quantity, tableNumber } = req.body;
    const query = `INSERT INTO commandes (mealName, softDrink, quantity, tableNumber) VALUES (?, ?, ?, ?)`;
    db.run(query, [mealName, softDrink, quantity, tableNumber], function (err) {
        if (err) {
            console.error('Erreur lors de l\'ajout de la commande:', err.message);
            res.status(500).json({ error: 'Failed to save order' });
            return;
        }
        res.json({ order: { mealName, softDrink, quantity, tableNumber } });
    });
});

// Réinitialisation quotidienne des commandes
const resetOrderNumbers = async () => {
    db.run('DELETE FROM commandes', (err) => {
        if (err) {
            console.error('Erreur lors de la réinitialisation des commandes:', err.message);
        } else {
            console.log('Commandes réinitialisées pour la nouvelle journée');
        }
    });
};

// Planifie la réinitialisation quotidienne à minuit
cron.schedule('0 0 * * *', () => {
    resetOrderNumbers();
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});