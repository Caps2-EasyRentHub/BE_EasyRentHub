import mongoose from "mongoose";
const { Schema, Types, model } = mongoose;

const subscriptionPaymentSchema = new Schema({
  userId: { 
    type: Types.ObjectId, 
    ref: "user", 
    required: true,
    unique: true
  },
  planType: {
    type: String,
    enum: ["FREE", "WEEKLY"],
    default: "FREE",
    required: true,
  },
  startDate: { 
    type: Date, 
    default: Date.now 
  },
  endDate: { 
    type: Date,
    default: function() {
      return this.planType === "FREE" 
        ? new Date(8640000000000000)
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
  },
  postsRemaining: {
    type: Number,
    default: function() {
      return this.planType === "FREE" ? 5 : 0;
    }
  },
  postsUsedToday: {
    type: Number,
    default: 0
  },
  lastPostDate: {
    type: Date,
    default: null
  },
  postCountResetDate: {
    type: Date,
    default: function() {
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }
  }
}, {
  timestamps: true
});

export default model("subscriptionPayment", subscriptionPaymentSchema);