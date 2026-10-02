import express from 'express';
import { chatWithAi, getSummary } from '../controllers/chatbotController.js';

const router = express.Router();

router.post('/', chatWithAi);
router.get('/summary', getSummary);

export default router;
