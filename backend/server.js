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
    }
});

// Routes
// Menus
app.get('/api/menus', async (req, res) => {
    try {
        const data = await fs.readFile(path.resolve(__dirname, './data/data.json'), 'utf8');
        console.log('File read successfully:', data);
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

const generateOrderNumber = (orders) => {
    const lastOrder = orders[orders.length - 1];
    const lastOrderNumber = lastOrder ? parseInt(lastOrder.orderNumber, 10) : 0;
    return (lastOrderNumber + 1).toString().padStart(6, '0');
};

const readOrders = async () => {
    try {
        const data = await fs.readFile(path.join(__dirname, './data/commandes.json'), 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Erreur lors de la lecture du fichier commande.json:', error.message);
        return [];
    }
};

const writeOrders = async (orders) => {
    try {
        await fs.writeFile(path.join(__dirname, './data/commandes.json'), JSON.stringify(orders, null, 2));
    } catch (error) {
        console.error('Erreur lors de l\'écriture dans le fichier commande.json:', error.message);
    }
};

app.get('/api/generateOrderNumber', async (req, res) => {
    try {
        const orders = await readOrders();  
        const orderNumber = generateOrderNumber(orders);
        res.status(200).json({ orderNumber });
    } catch (error) {
        console.error('Erreur lors de la génération du numéro de commande:', error.message);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Commandes
app.post('/api/commandes', async (req, res) => {
    const { mealName, softDrink, quantity, tableNumber } = req.body;

    if (!mealName || !softDrink || !quantity || !tableNumber) {
        return res.status(400).json({ message: 'Veuillez remplir tous les champs.' });
    }

    try {
        const orders = await readOrders();

        const orderNumber = generateOrderNumber(orders);

        const newOrder = {
            mealName,
            softDrink,
            quantity,
            tableNumber,
            orderNumber,
            date: new Date().toISOString(),
        };

        orders.push(newOrder);

        await writeOrders(orders);

        return res.status(200).json({ message: 'Commande reçue avec succès!', order: newOrder });
    } catch (error) {
        console.error('Erreur lors du traitement de la commande:', error.message);
        return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

const resetOrderNumber = async () => {
    const initialOrderNumber = '000001'; // Set your initial order number
    const orders = await readOrders();
    await writeOrders([]); // Clear the existing orders
    console.log(`Order number reset to ${initialOrderNumber}`);
};

// Schedule a job to run at 23:59 every day
cron.schedule('59 23 * * *', resetOrderNumber);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});