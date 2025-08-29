import express from 'express';
import { prisma } from '../lib/prisma.js';
import { v4 as uuidv4 } from 'uuid';
import { generateOrderNumber } from '../utils/orderUtils.js';

const router = express.Router();

router.get('/generateOrderNumber', async (req, res) => {
    try {
        const newOrderNumber = await generateOrderNumber(prisma);
        res.status(200).json({ orderNumber: newOrderNumber });
    } catch (error) {
        console.error('Erreur lors de la génération du numéro de commande:', error);
        res.status(500).json({ message: 'Erreur lors de la génération du numéro de commande.' });
    }
});

router.post('/', async (req, res) => {
    const { mealName, softDrink, quantity, tableNumber, orderNumber } = req.body;

    if (!mealName || !softDrink || !quantity || !tableNumber || !orderNumber) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    try {
        const commande = await prisma.commande.create({
            data: {
                id: uuidv4(),
                orderNumber,
                mealName,
                softDrink,
                quantity: parseInt(quantity),
                tableNumber,
                date: new Date()
            }
        });

        res.status(201).json({ message: 'Commande créée avec succès.', orderNumber: commande.orderNumber });
    } catch (error) {
        console.error('Erreur lors de la création de la commande:', error);
        res.status(500).json({ message: 'Erreur lors de la création de la commande.' });
    }
});

export default router;
