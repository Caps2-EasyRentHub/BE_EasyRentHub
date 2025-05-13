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

export const chatSocketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join', (userId) => {
      socket.join(userId);
    });

    socket.on('send_message', async (data) => {
      const { senderId, receiverId, text, mediaUrl, mediaType } = data;

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

      io.to(receiverId).emit('receive_message', message);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });
};
