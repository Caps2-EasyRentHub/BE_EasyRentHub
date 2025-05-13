import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema({
  members: {
    type: [String],
    required: true,
  },
  lastMessage: {
    type: String,
    default: "",
  },
  lastMessageType: {
    type: String,
    default: "text",
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model("conversation", conversationSchema);
