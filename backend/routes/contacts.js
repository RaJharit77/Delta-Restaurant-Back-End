import express from 'express';
import { prisma } from '../lib/prisma.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

router.post('/', async (req, res) => {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
        return res.status(400).json({ message: 'Tous les champs sont requis.' });
    }

    try {
        const contact = await prisma.contact.create({
            data: {
                id: uuidv4(),
                name,
                email,
                subject,
                message
            }
        });
        res.status(200).json({ message: 'Message envoyé avec succès.', contactId: contact.id });
    } catch (error) {
        console.error('Erreur lors de l\'envoi du message:', error);
        res.status(500).json({ message: 'Erreur lors de l\'envoi du message.' });
    }
});

export default router;
