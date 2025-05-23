import mongoose from "mongoose";
const { Schema, Types, model } = mongoose;

const paymentSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "user", required: true },
  amount: { type: Number, required: true },
  planType: {
    type: String,
    enum: ["FREE", "WEEKLY"],
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ["PAYOS"],
    required: true,
  },
  status: {
    type: String,
    enum: ["PENDING", "COMPLETED", "FAILED"],
    default: "PENDING",
  },
  transactionId: { type: String },
  orderInfo: { type: String },
  paymentResponse: { type: Object },
  createdAt: { type: Date, default: Date.now },
});

export default model("payment", paymentSchema);
