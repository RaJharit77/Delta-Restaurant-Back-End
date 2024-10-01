import express from 'express';
import menuRoutes from './routes/menuRoutes.js';

const app = express();

// Middleware
app.use(express.json());

// Routes
app.use('/api/menu', menuRoutes);

export default app;
