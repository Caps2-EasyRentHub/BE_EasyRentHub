import Message from '../models/messageModel.js';
import Conversation from '../models/conversationModel.js';

const getMediaPlaceholder = (type) => {
  switch (type) {
    case 'image': return '📷 Photo';
    case 'video': return '🎬 Video';
    case 'audio': return '🔊 Audio';
    case 'application': return '📎 File';
    default: return '📎 Media';
  }
};

export const getMessagesByConversation = async (req, res) => {
  const { conversationId } = req.params;
  try {
    const messages = await Message.find({ conversationId }).sort('-createdAt');
    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving messages', error: err.message });
  }
};

export const getConversationsByUser = async (req, res) => {
  const { userId } = req.params;
  try {
    const conversations = await Conversation.find({ members: { $in: [userId] } })
      .sort('-lastUpdated');
    res.status(200).json(conversations);
  } catch (err) {
    res.status(500).json({ message: 'Error retrieving conversations', error: err.message });
  }
};

export const sendMessage = async (req, res) => {
  const { senderId, receiverId, text, mediaUrl, mediaType } = req.body;

  try {
    let conversation = await Conversation.findOne({
      members: { $all: [senderId, receiverId] }
    });

    if (!conversation) {
      conversation = await Conversation.create({
        members: [senderId, receiverId],
        lastMessage: text || getMediaPlaceholder(mediaType),
        lastMessageType: mediaType || 'text'
      });
    } else {
      conversation.lastMessage = text || getMediaPlaceholder(mediaType);
      conversation.lastMessageType = mediaType || 'text';
      conversation.lastUpdated = new Date();
      await conversation.save();
    }

    const message = await Message.create({
      conversationId: conversation._id,
      senderId,
      receiverId,
      text,
      mediaUrl,
      mediaType
    });

    res.status(200).json(message);
  } catch (err) {
    res.status(500).json({ message: 'Error sending message', error: err.message });
  }
};
