import { readFile } from 'fs/promises';
import path from 'path';

export const getMenu = async (req, res) => {
    try {
        const data = await readFile(path.resolve('src/data/menu.json'), 'utf-8');
        const menu = JSON.parse(data);
        res.json(menu);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching menu' });
    }
};
/*
import express from 'express';
import { getMenu } from '../controllers/menuController.js';

const router = express.Router();

router.get('/menu', getMenu);

export default router;*/