import cors from 'cors';
import express from 'express';
import path from 'path';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

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
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

const dbPromise = open({
    filename: path.join(__dirname, 'database.db'),
    driver: sqlite3.Database
});

(async () => {
    const db = await dbPromise;
    await db.exec(`
        CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT,
            subject TEXT,
            message TEXT
        );

        CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            firstname TEXT,
            email TEXT,
            phone TEXT,
            dateTime TEXT,
            guests INTEGER
        );

        CREATE TABLE IF NOT EXISTS commandes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mealName TEXT,
            quantity INTEGER,
            tableNumber INTEGER,
            orderNumber TEXT
        );
    `);
})();

// api
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
    const { name, email, message } = req.body;
    try {
        const db = await dbPromise;
        await db.run('INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)', [name, email, message]);
        res.status(200).json({ message: 'Message envoyé avec succès.' });
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
        res.status(500).json({ message: 'Erreur lors de l\'envoi du message.' });
    }
});

// Réservations
app.post('/api/reservations', async (req, res) => {
    const { name, email, date, tableNumber } = req.body;
    try {
        const db = await dbPromise;
        await db.run('INSERT INTO reservations (name, email, date, tableNumber) VALUES (?, ?, ?, ?)', [name, email, date, tableNumber]);
        res.status(200).json({ message: 'Réservation effectuée avec succès.' });
    } catch (error) {
        console.error('Erreur lors de la réservation:', error);
        res.status(500).json({ message: 'Erreur lors de la réservation.' });
    }
});

// Générer un numéro de commande
const generateOrderNumber = async () => {
    const db = await dbPromise;
    const lastOrder = await db.get('SELECT orderNumber FROM commandes ORDER BY id DESC LIMIT 1');
    const lastOrderNumber = lastOrder ? parseInt(lastOrder.orderNumber, 10) : 0;
    return (lastOrderNumber + 1).toString().padStart(6, '0');
};

// Commandes
app.post('/api/commandes', async (req, res) => {
    const { mealName, quantity, tableNumber } = req.body;

    if (!mealName || !quantity || !tableNumber) {
        return res.status(400).json({ message: 'Veuillez remplir tous les champs.' });
    }

    try {
        const db = await dbPromise;
        const orderNumber = await generateOrderNumber();

        await db.run('INSERT INTO commandes (mealName, quantity, tableNumber, orderNumber, date) VALUES (?, ?, ?, ?, ?)', 
            [mealName, quantity, tableNumber, orderNumber, new Date().toISOString()]);

        res.status(200).json({ message: 'Commande reçue avec succès!', order: { mealName, quantity, tableNumber, orderNumber } });
    } catch (error) {
        console.error('Erreur lors du traitement de la commande:', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});