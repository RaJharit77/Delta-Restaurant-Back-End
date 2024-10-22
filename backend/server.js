import cors from 'cors';
import express from 'express';
import fs from 'fs/promises';
import { JSONFile, Low } from 'lowdb';
import cron from 'node-cron';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const dbFile = path.resolve(__dirname, './db.json');
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'UPDATE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    console.log(`${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
});

// Initialize LowDB
const initLowDB = async () => {
    const file = path.join(__dirname, 'db.json');
    const adapter = new JSONFile(file);
    const lowdb = new Low(adapter);
    await lowdb.read();
    lowdb.data = lowdb.data || { commandes: [] }; // Initialiser avec une collection vide si le fichier est vide
    await lowdb.write();
    return lowdb;
};

const lowdb = await initLowDB();

// SQLite Database Initialization
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erreur lors de l\'ouverture de la base de données:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            subject TEXT,
            message TEXT
        );`);

        db.run(`CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            firstname TEXT NOT NULL,
            name TEXT,
            email TEXT,
            phone TEXT,
            dateTime TEXT,
            guests INTEGER
        );`);
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

app.post('/api/commandes', async (req, res) => {
    const { mealName, softDrink, quantity, tableNumber } = req.body;

    if (!mealName || !softDrink || !quantity || !tableNumber) {
        return res.status(400).json({ message: 'Veuillez remplir tous les champs.' });
    }

    try {
        await lowdb.read(); // Lire les données actuelles
        const newOrderId = lowdb.data.commandes.length + 1;

        const newOrder = {
            id: newOrderId,
            mealName,
            softDrink,
            quantity,
            tableNumber,
        };

        lowdb.data.commandes.push(newOrder); // Ajouter la nouvelle commande
        await lowdb.write(); // Sauvegarder dans le fichier JSON

        res.status(200).json({
            message: 'Commande reçue avec succès!',
            orderId: newOrderId,
            order: newOrder,
        });
    } catch (error) {
        console.error('Erreur lors de la commande:', error.message);
        res.status(500).json({ message: 'Erreur lors de la commande', error: error.message });
    }
});

// Réinitialisation quotidienne des commandes
const resetOrderNumbers = async () => {
    await initLowDB(); // Réinitialiser la base de données lowdb pour les commandes
    lowdb.data.commandes = [];
    await lowdb.write();
    console.log('Commandes réinitialisées pour la nouvelle journée');
};

// Planifie la réinitialisation quotidienne à minuit
cron.schedule('0 0 * * *', () => {
    resetOrderNumbers();
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
