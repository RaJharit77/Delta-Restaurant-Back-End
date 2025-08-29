import express from 'express';
import { prisma } from '../lib/prisma.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const menus = await prisma.menu.findMany();
        res.json(menus);
    } catch (error) {
        console.error('Error fetching menus:', error.message);
        res.status(500).json({ message: 'Internal server error' });
    }
});

export default router;
