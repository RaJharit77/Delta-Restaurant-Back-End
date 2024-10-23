import cors from 'cors';
import express from 'express';
import fs from 'fs/promises';
import cron from 'node-cron';
import path from 'path';
import { DataTypes, Sequelize } from 'sequelize';
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
    origin: '*',
    origin: allowedOrigins,
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

// Initialize Sequelize
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: orderDbPath,
});

// Define Commandes model
const Commande = sequelize.define('Commande', {
    mealName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    softDrink: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    tableNumber: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    orderNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    date: {
        type: DataTypes.DATE,
        allowNull: false,
    },
}, {
    tableName: 'commandes',
});

// Sync the database
sequelize.sync().then(() => {
    console.log('La table Commandes a été créée.');
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

// Function to generate a new order number
const generateOrderNumber = async () => {
    const lastOrder = await Commande.findOne({ order: [['id', 'DESC']] });
    const newOrderNumber = lastOrder ? (parseInt(lastOrder.orderNumber) + 1).toString().padStart(6, '0') : '000001';
    return newOrderNumber;
};

// Example for creating a new order
app.post('/api/commandes', async (req, res) => {
    const { mealName, softDrink, quantity, tableNumber } = req.body;
    const date = new Date();

    if (!mealName || !softDrink || !quantity || !tableNumber) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    try {
        const orderNumber = await generateOrderNumber();
        const newOrder = await Commande.create({ mealName, softDrink, quantity, tableNumber, orderNumber, date });
        res.status(201).json({ message: 'Commande créée avec succès.', orderNumber: newOrder.orderNumber });
    } catch (error) {
        console.error('Erreur lors de la création de la commande:', error);
        res.status(500).json({ message: 'Erreur lors de la création de la commande.' });
    }
});

// Réinitialiser les commandes
const resetOrders = async () => {
    try {
        await Commande.destroy({ where: {} }); // Supprime toutes les commandes
        console.log('Commandes réinitialisées avec succès.');
    } catch (error) {
        console.error('Erreur lors de la réinitialisation des commandes:', error.message);
    }
};

// Planifier la réinitialisation quotidienne à minuit
cron.schedule('0 0 * * *', resetOrders);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});