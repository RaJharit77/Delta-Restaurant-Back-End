// routes/menuRoutes.js
import express from 'express';
import MenuItem from '../models/Menu.js';

const router = express.Router();

// GET tous les éléments du menu
router.get('/', async (req, res) => {
    try {
        const menuItems = await MenuItem.find();
        res.json(menuItems);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// POST un nouvel élément de menu
router.post('/', async (req, res) => {
    const { name, description, price, image } = req.body;

    const menuItem = new MenuItem({
        name,
        description,
        price,
        image,
    });

    try {
        const savedMenuItem = await menuItem.save();
        res.status(201).json(savedMenuItem);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

export default router;
