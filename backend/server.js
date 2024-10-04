import cors from 'cors';
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/menu', async (req, res) => {
    try {
        const data = await fs.readFile(path.resolve(__dirname, './data/data.json'), 'utf8');
        const menuItems = JSON.parse(data);
        res.json(menuItems);
    } catch (error) {
        console.error('Error reading menu data:', error.message);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
