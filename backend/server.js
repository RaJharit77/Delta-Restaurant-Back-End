import cors from 'cors';
import express from 'express';
import fs from 'fs/promises';
import { JSONFile, Low } from 'lowdb';
import cron from 'node-cron';
import path from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const dbFile = path.resolve(__dirname, './data/db.json');
const adapter = new JSONFile(dbFile);
const dbs = new Low(adapter);

const PORT = process.env.PORT || 5000;
const dbPath = process.env.DB_PATH || './database.db';

// CORS setup
const allowedOrigins = [
    'https://delta-restaurant-madagascar.vercel.app',
    'https://delta-restaurant-madagascar.onrender.com'
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

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
});

const initDbs = async () => {
    await db.read();
    dbs.data = dbs.data || { commandes: [] };
    await db.write();
};

initDbs().then(() => console.log('Lowdb initialized.'));

// SQLite Database Initialization
let db;
const initDb = async () => {
    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            subject TEXT,
            message TEXT
        );
    `);

    await db.exec(`
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
};

initDb().then(() => console.log('SQLite database initialized.'));

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
app.post('/api/commandes', async (req, res) => {
    const { mealName, softDrink, quantity, tableNumber } = req.body;
    if (!mealName || !softDrink || !quantity || !tableNumber) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }
    try {
        const newOrder = { id: Date.now(), mealName, softDrink, quantity, tableNumber };
        db.data.commandes.push(newOrder);
        await db.write();
        res.status(200).json({ order: newOrder });
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la commande:', error);
        res.status(500).json({ message: 'Erreur lors de la commande.' });
    }
});

// Réinitialisation quotidienne des commandes
const resetOrderNumbers = async () => {
    try {
        db.data.commandes = [];
        await db.write();
        console.log('Commandes réinitialisées pour la nouvelle journée');
    } catch (error) {
        console.error('Erreur lors de la réinitialisation des commandes:', error.message);
    }
};

// Planifie la réinitialisation quotidienne à minuit
cron.schedule('0 0 * * *', () => {
    resetOrderNumbers();
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});