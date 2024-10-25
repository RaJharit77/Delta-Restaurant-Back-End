import alasql from 'alasql';
import cors from 'cors';
import express from 'express';
import fs from 'fs-extra';
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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'UPDATE', 'OPTIONS'],
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

app.options('*', cors());

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

        db.run(`CREATE TABLE IF NOT EXISTS commandes (
            orderNumber INTEGER PRIMARY KEY AUTOINCREMENT,
            mealName TEXT,
            softDrink TEXT,
            quantity INTEGER,
            tableNumber TEXT,
            date TEXT
        );`);
    }
});

// Initialiser la base de données en mémoire
/*alasql('CREATE TABLE commandes (orderNumber STRING, mealName STRING, softDrink STRING, quantity INT, tableNumber STRING, date STRING)');*/

// Routes
// Menus
app.get('/api/menus', async (req, res) => {
    try {
        const data = await fs.readFile(path.resolve(__dirname, './data/data.json'), 'utf8');
        console.log('File read successfully:', data);

        const menuItems = JSON.parse(data);

        const query = `SELECT * FROM ?`;
        const result = alasql(query, [menuItems]);

        res.json(result);
    } catch (error) {
        console.error('Error processing menu data:', error.message);
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

// Fonction pour générer un numéro de commande unique
const generateOrderNumber = async () => {
    try {
        const data = await fs.readFile(ordersFilePath, 'utf8');
        const orders = JSON.parse(data);
        const lastOrderNumber = orders.length > 0 ? parseInt(orders[orders.length - 1].orderNumber) : 0;
        return (lastOrderNumber + 1).toString().padStart(6, '0');
    } catch (error) {
        console.error('Erreur lors de la génération du numéro de commande:', error.message);
        return null;
    }
};

//generate order number
app.get('/api/generateOrderNumber', (req, res) => {
    const lastOrder = alasql('SELECT * FROM commandes ORDER BY orderNumber DESC LIMIT 1')[0];
    const lastOrderNumber = lastOrder ? parseInt(lastOrder.orderNumber) : 0;
    const newOrderNumber = (lastOrderNumber + 1).toString().padStart(6, '0');
    
    res.status(200).json({ orderNumber: newOrderNumber });
});

//Commandes
app.post('/api/commandes', (req, res) => {
    const { mealName, softDrink, quantity, tableNumber } = req.body;
    const date = new Date().toISOString();

    if (!mealName || !softDrink || !quantity || !tableNumber) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    const orderNumber = alasql('SELECT * FROM commandes ORDER BY orderNumber DESC LIMIT 1')[0] ? (parseInt(alasql('SELECT * FROM commandes ORDER BY orderNumber DESC LIMIT 1')[0].orderNumber) + 1).toString().padStart(6, '0') : '000001';

    const newOrder = { mealName, softDrink, quantity, tableNumber, orderNumber, date };
    alasql('INSERT INTO commandes VALUES (?, ?, ?, ?, ?, ?)', [orderNumber, mealName, softDrink, quantity, tableNumber, date]);

    res.status(200).json({ message: 'Commande créée avec succès.', orderNumber });
    res.status(201).json({ message: 'Commande créée avec succès.', orderNumber });
});

// Réinitialiser les commandes
const resetOrders = () => {
    alasql('DELETE FROM commandes');
    console.log('Toutes les commandes ont été réinitialisées.');
};

// Tâche cron pour réinitialiser les commandes tous les jours à minuit
cron.schedule('0 0 * * *', () => {
    console.log('Réinitialisation des commandes à minuit.');
    resetOrders();
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});