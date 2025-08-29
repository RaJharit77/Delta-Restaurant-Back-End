import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { resetOrders } from './utils/orderUtils.js';

import menusRouter from './routes/menus.js';
import contactsRouter from './routes/contacts.js';
import reservationsRouter from './routes/reservations.js';
import commandesRouter from './routes/commandes.js';

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
    'https://delta-restaurant-madagascar.vercel.app',
    'https://delta-restaurant-madagascar.onrender.com',
    'http://localhost:5173'
];

const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.includes(origin) || !origin) callback(null, true);
        else callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'UPDATE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => res.send('Welcome to the Delta Restaurant API'));
app.use('/api/menus', menusRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/reservations', reservationsRouter);
app.use('/api/commandes', commandesRouter);

cron.schedule('0 0 * * *', () => resetOrders());

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Erreur interne du serveur.' });
});

app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});
