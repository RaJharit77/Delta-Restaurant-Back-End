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
const orderDbPath = process.env.COMMANDES_DB_PATH || './commandes.db';

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

const orderDb = new sqlite3.Database(orderDbPath, (err) => {
    if (err) {
        console.error('Erreur lors de l\'ouverture de la base de données des commandes:', err.message);
    } else {
        console.log('Connected to SQLite orders database.');
        orderDb.run(`CREATE TABLE IF NOT EXISTS commandes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mealName TEXT NOT NULL,
            softDrink TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            tableNumber INTEGER NOT NULL,
            orderNumber TEXT NOT NULL UNIQUE,
            date TEXT NOT NULL
        );`, (err) => {
            if (err) {
                console.error('Erreur lors de la création de la table des commandes:', err.message);
            } else {
                initializeInitialOrderNumber();
            }
        });
    }
});

// Function to initialize the first order number
const initializeInitialOrderNumber = () => {
    orderDb.get('SELECT COUNT(*) as count FROM commandes', (err, row) => {
        if (err) {
            console.error('Erreur lors de la vérification des commandes:', err.message);
            return;
        }
        if (row.count === 0) {
            // Insert the initial order with number "000001"
            const initialOrderNumber = "000001";
            const initialDate = new Date().toISOString();
            orderDb.run(
                'INSERT INTO commandes (mealName, softDrink, quantity, tableNumber, orderNumber, date) VALUES (?, ?, ?, ?, ?, ?)',
                ['Initial Meal', 'Initial Drink', 1, 1, initialOrderNumber, initialDate],
                (err) => {
                    if (err) {
                        console.error('Erreur lors de l\'insertion de la commande initiale:', err.message);
                    } else {
                        console.log('Commande initiale insérée avec succès avec le numéro:', initialOrderNumber);
                    }
                }
            );
        }
    });
};

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

// Function to generate a new order number
const generateOrderNumber = (callback) => {
    orderDb.get('SELECT orderNumber FROM commandes ORDER BY id DESC LIMIT 1', (err, row) => {
        if (err) {
            console.error('Erreur lors de la génération du numéro de commande:', err.message);
            callback(null);
        } else {
            const lastOrderNumber = row ? parseInt(row.orderNumber) : 0;
            const newOrderNumber = (lastOrderNumber + 1).toString().padStart(6, '0');
            callback(newOrderNumber);
        }
    });
};

// Example for creating a new order
app.post('/api/commandes', (req, res) => {
    const { mealName, softDrink, quantity, tableNumber } = req.body;
    const date = new Date().toISOString();

    if (!mealName || !softDrink || !quantity || !tableNumber) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    generateOrderNumber((orderNumber) => {
        if (!orderNumber) {
            return res.status(500).json({ message: 'Erreur lors de la génération du numéro de commande.' });
        }

        orderDb.run(
            'INSERT INTO commandes (mealName, softDrink, quantity, tableNumber, orderNumber, date) VALUES (?, ?, ?, ?, ?, ?)',
            [mealName, softDrink, quantity, tableNumber, orderNumber, date],
            function (err) {
                if (err) {
                    console.error('Erreur lors de la création de la commande:', err.message);
                    return res.status(500).json({ message: 'Erreur lors de la création de la commande.' });
                }
                res.status(201).json({ message: 'Commande créée avec succès.', orderNumber });
            }
        );
    });
});

// Réinitialiser les commandes
const resetOrders = () => {
    orderDb.run('DELETE FROM commandes', (err) => {
        if (err) {
            console.error('Erreur lors de la réinitialisation des commandes:', err.message);
        } else {
            console.log('Toutes les commandes ont été réinitialisées.');
            initializeInitialOrderNumber();
        }
    });
};

// Cron job for resetting orders every day at midnight
cron.schedule('0 0 * * *', resetOrders);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
