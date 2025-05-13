import express from 'express';
import {
  getMessagesByConversation,
  getConversationsByUser,
  sendMessage
} from '../controllers/messageCtrl.js';

const router = express.Router();

router.get('/:conversationId', getMessagesByConversation);
router.get('/conversations/:userId', getConversationsByUser);
router.post('/send', sendMessage);

export default router;
