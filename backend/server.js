import cors from 'cors';
import express from 'express';
import cron from 'node-cron';
import path from 'path';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = process.env.PORT || 5000;
const dbPath = process.env.DB_PATH || './database.db';
const orderDbPath = './commandes.db' || process.env.COMMANDES_DB_PATH;

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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

// Erreur du serveur
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
});

// Connexion à la base de données principale
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erreur lors de l\'ouverture de la base de données:', err.message);
    } else {
        console.log('Connecté à SQLite database.');
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

// Connexion à la base de données des commandes
const dbs = new sqlite3.Database(orderDbPath, (err) => {
    if (err) {
        console.error('Erreur lors de la connexion à SQLite:', err.message);
    } else {
        console.log('Connecté à la base de données SQLite des commandes.');
        dbs.run(`CREATE TABLE IF NOT EXISTS commandes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            mealName TEXT NOT NULL,
            softDrink TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            tableNumber INTEGER NOT NULL,
            orderNumber TEXT NOT NULL,
            date TEXT NOT NULL
        );`);
    }
});

// Générer un numéro de commande
const generateOrderNumber = async () => {
    try {
        const lastOrderNumber = await getLastOrderNumber();
        return (lastOrderNumber + 1).toString().padStart(6, '0');
    } catch (error) {
        console.error('Erreur dans generateOrderNumber:', error);
        throw error;
    }
};

// Écrire une commande dans la base de données
const writeOrder = (order) => {
    return new Promise((resolve, reject) => {
        dbs.run(
            'INSERT INTO commandes (mealName, softDrink, quantity, tableNumber, orderNumber, date) VALUES (?, ?, ?, ?, ?, ?)', 
            [order.mealName, order.softDrink, order.quantity, order.tableNumber, order.orderNumber, order.date], 
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            }
        );
    });
};

// Obtenir le dernier numéro de commande
const getLastOrderNumber = () => {
    return new Promise((resolve, reject) => {
        dbs.get('SELECT orderNumber FROM commandes ORDER BY id DESC LIMIT 1', (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row ? parseInt(row.orderNumber, 10) : 0);
            }
        });
    });
};

// Endpoint pour générer un numéro de commande
app.get('/api/generateOrderNumber', async (req, res) => {
    try {
        const orderNumber = await generateOrderNumber();  
        res.status(200).json({ orderNumber });
    } catch (error) {
        console.error('Erreur lors de la génération du numéro de commande:', error.message);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

// Endpoint pour créer une commande
app.post('/api/commandes', async (req, res) => {
    const { mealName, softDrink, quantity, tableNumber, orderNumber } = req.body;
    const date = new Date().toISOString();

    if (!mealName || !softDrink || !quantity || !tableNumber || !orderNumber) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    try {
        await writeOrder({ mealName, softDrink, quantity, tableNumber, orderNumber, date });
        res.status(201).json({ message: 'Commande créée avec succès.', orderNumber }); 
    } catch (error) {
        console.error('Erreur lors de la création de la commande:', error);
        res.status(500).json({ message: 'Erreur lors de la création de la commande.' });
    }
});

// Fonction pour réinitialiser les commandes chaque jour à minuit
const resetOrders = () => {
    dbs.run('DELETE FROM commandes', (err) => {
        if (err) {
            console.error('Erreur lors de la réinitialisation des commandes:', err.message);
        } else {
            console.log('Commandes réinitialisées.');
        }
    });
};

// Planification de la réinitialisation quotidienne à 23h59
cron.schedule('59 23 * * *', resetOrders);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
