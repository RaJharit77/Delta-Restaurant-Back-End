import cors from 'cors';
import express from 'express';
import fs from 'fs/promises';
import Datastore from 'nedb';
import cron from 'node-cron';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = process.env.PORT || 5000;
const dbPath = process.env.DB_PATH || './database.db';
const orderDb = new Datastore({ filename: './orders.db', autoload: true });

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

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
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
        try {
            const menuItems = JSON.parse(data);
            res.json(menuItems);
        } catch (parseError) {
            console.error('Erreur lors de l\'analyse JSON :', parseError.message);
            res.status(500).json({ message: 'Erreur de format JSON.' });
        }
    } catch (error) {
        console.error('Error reading menu data:', error.message);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

// Contacts
app.post('/api/contacts', (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    db.run(
        'INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)',
        [name, email, subject, message],
        function (err) {
            if (err) {
                console.error('Erreur lors de l\'envoi du message:', err.message);
                return res.status(500).json({ message: 'Erreur lors de l\'envoi du message.' });
            }
            res.status(200).json({ message: 'Message envoyé avec succès.', contactId: this.lastID });
        }
    );
});

// Réservations
app.post('/api/reservations', (req, res) => {
    const { firstname, name, email, phone, dateTime, guests } = req.body;
    if (!firstname || !dateTime || !guests) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    db.run(
        'INSERT INTO reservations (firstname, name, email, phone, dateTime, guests) VALUES (?, ?, ?, ?, ?, ?)',
        [firstname, name, email, phone, dateTime, guests],
        function (err) {
            if (err) {
                console.error('Erreur lors de la réservation:', err.message);
                return res.status(500).json({ message: 'Erreur lors de la réservation.' });
            }
            res.status(200).json({ message: 'Réservation effectuée avec succès.', reservationId: this.lastID });
        }
    );
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

// Route pour générer un numéro de commande
app.get('/api/generateOrderNumber', (req, res) => {
    generateOrderNumber((orderNumber) => {
        if (!orderNumber) {
            return res.status(500).json({ message: 'Erreur lors de la génération du numéro de commande.' });
        }
        // Vérifiez que le numéro de commande est une chaîne
        if (typeof orderNumber !== 'string') {
            return res.status(500).json({ message: 'Numéro de commande non valide.' });
        }
        console.log('Numéro de commande renvoyé:', orderNumber);
        res.status(200).json({ orderNumber });
    });
});

app.post('/api/commandes', async (req, res) => {
    const { mealName, softDrink, quantity, tableNumber } = req.body;
    const date = new Date().toISOString();

    if (!mealName || !softDrink || !quantity || !tableNumber) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    const orderNumber = await generateOrderNumber();
    if (!orderNumber) {
        return res.status(500).json({ message: 'Erreur lors de la génération du numéro de commande.' });
    }

    const newOrder = { mealName, softDrink, quantity, tableNumber, orderNumber, date };

    try {
        const data = await fs.readFile(ordersFilePath, 'utf8');
        const orders = JSON.parse(data);
        orders.push(newOrder);
        await fs.writeFile(ordersFilePath, JSON.stringify(orders, null, 2));
        res.status(201).json({ message: 'Commande créée avec succès.', orderNumber });
    } catch (error) {
        console.error('Erreur lors de la création de la commande:', error.message);
        res.status(500).json({ message: 'Erreur lors de la création de la commande.' });
    }
});

// Réinitialiser les commandes
const resetOrders = () => {
    orderDb.remove({}, { multi: true }, (err, numRemoved) => {
        if (err) {
            console.error('Erreur lors de la réinitialisation des commandes:', err.message);
        } else {
            console.log(`Toutes les commandes (${numRemoved}) ont été réinitialisées.`);
            initializeInitialOrderNumber();
            console.log('Le numéro de commande initial a été réinitialisé.');
        }
    });
};

// Tâche cron pour réinitialiser les commandes tous les jours à minuit
cron.schedule('0 0 * * *', () => {
    console.log('Réinitialisation des commandes à minuit.');
    resetOrders();
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
