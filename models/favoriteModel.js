import mongoose from "mongoose";
const { Schema, Types, model } = mongoose;

const favoriteRoomSchema = new Schema(
  {
    user: {
      type: Types.ObjectId,
      ref: "user",
      required: true,
    },
    rooms: [
      {
        type: Types.ObjectId,
        ref: "estate",
      },
    ],
  },
  {
    timestamps: true,
  }
);

favoriteRoomSchema.index({ user: 1 }, { unique: true });

export default model("favorite", favoriteRoomSchema);
