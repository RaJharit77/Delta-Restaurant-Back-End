import express from 'express';
import { prisma } from '../lib/prisma.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.post('/', async (req, res) => {
    const { firstname, name, email, phone, dateTime, guests } = req.body;
    if (!firstname || !dateTime || !guests) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    try {
        const reservation = await prisma.reservation.create({
            data: {
                id: uuidv4(),
                firstname,
                name,
                email,
                phone,
                dateTime: new Date(dateTime),
                guests: parseInt(guests)
            }
        });
        res.status(200).json({ message: 'Réservation effectuée avec succès.', reservationId: reservation.id });
    } catch (error) {
        console.error('Erreur lors de la réservation:', error);
        res.status(500).json({ message: 'Erreur lors de la réservation.' });
    }
});

export default router;
