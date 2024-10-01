import { Router } from 'express';
import { getMenu } from '../controllers/menuController.js';

const router = Router();

router.get('/', getMenu);

export default router;
