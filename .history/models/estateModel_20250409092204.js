import mongoose from "mongoose";
const { Schema, Types, model } = mongoose;
const estateSchema = new Schema(
  {
    name: { type: String, required: true },
    address: {
      house_number: {
        type: Number,
        default: "",
      },
      road: {
        type: String,
        default: "",
      },
      quarter: {
        type: String,
        default: "",
      },
      city: {
        type: String,
        default: "",
      },
      country: {
        type: String,
        default: "",
      },
      lat: {
        type: String,
        default: "",
      },
      lng: {
        type: String,
        default: "",
      },
    },
    images: {
      type: Array,
      required: true,
    },
    rating_star: Number,
    price: { type: Number, required: true },
    rental: {
      type: Boolean,
    },
    property: {
      bedroom: { type: Number },
      bathroom: { type: Number },
      floors: { type: Number },
    },
    status: {
      type: String,
      enum: ["available", "pending", "booked"],
      default: "available",
    },
    likes: [{ type: Types.ObjectId, ref: "user" }],
    reviews: [{ type: Types.ObjectId, ref: "review" }],
    user: { type: Types.ObjectId, ref: "user" },
    distance: Number,
  },
  {
    timestamps: true,
  }
);

export default model("estate", estateSchema);
