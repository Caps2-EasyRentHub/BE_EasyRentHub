import mongoose from "mongoose";
const { Schema, Types, model } = mongoose;

const userActivitySchema = new Schema(
  {
    user: {
      type: Types.ObjectId,
      ref: "user",
      required: true,
    },
    activityType: {
      type: String,
      enum: ["login", "logout", "create", "update", "delete"],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    ipAddress: {
      type: String,
      default: "",
    },
    userAgent: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

export default model("userActivity", userActivitySchema);
