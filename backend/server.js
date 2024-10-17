import cors from 'cors';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
    origin: 'https://delta-restaurant-madagascar.vercel.app',  
    methods: 'GET,POST,PUT,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
    credentials: true
}));

app.use(express.json());

//api
//menus
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

//contacts
app.post('/api/contacts', async (req, res) => {
    const contactData = req.body;

    console.log('Données de contact reçues:', contactData);

    try {
        const dataPath = path.join(__dirname, './data/contacts.json');
        const existingData = await fs.readFile(dataPath, 'utf8');
        const contacts = JSON.parse(existingData || '[]');
        contacts.push(contactData);
        await fs.writeFile(dataPath, JSON.stringify(contacts, null, 2));
        res.status(200).json({ message: 'Message envoyé avec succès.'});
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
        res.status(500).json({ message: 'Erreur lors de l\'envoi du message.'});
    }
});

//reservations
app.post('/api/reservations', async (req, res) => {
    const reservationData = req.body;

    console.log('Réservation reçue:', req.body);

    try {
        const dataPath = path.join(__dirname, './data/reservations.json');
        const existingData = await fs.readFile(dataPath, 'utf8');
        const reservations = JSON.parse(existingData || '[]');
        reservations.push(reservationData);
        await fs.writeFile(dataPath, JSON.stringify(reservations, null, 2));
        res.status(200).json({ message: 'Réservation effectuée avec succès.' });
    } catch (error) {
        res.status(500).json({ message: 'Erreur lors de la réservation.' });
    }
});

//générer les numéros de commandes
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

// api génération des numéros de commande
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

//commandes
app.post('/api/commandes', async (req, res) => {
    const { mealName, quantity, tableNumber } = req.body;

    if (!mealName || !quantity || !tableNumber) {
        return res.status(400).json({ message: 'Veuillez remplir tous les champs.' });
    }

    try {
        const orders = await readOrders();

        const orderNumber = generateOrderNumber(orders);

        const newOrder = {
            mealName,
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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});