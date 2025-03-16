import mongoose from "mongoose";
const { Schema, Types, model } = mongoose;

const rentalHistorySchema = new Schema(
  {
    estate: {
      type: Types.ObjectId,
      ref: "estate",
      required: true,
    },
    tenant: {
      type: Types.ObjectId,
      ref: "users",
      required: true,
    },
    landlord: {
      type: Types.ObjectId,
      ref: "users",
      required: true,
    },
    estateName: {
      type: String,
      required: true,
    },
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
    property: {
      bedroom: { type: Number },
      bathroom: { type: Number },
      floors: { type: Number },
    },
    images: {
      type: Array,
      default: [],
    },
    startDate: {
      type: Date,
      required: true,
    },
    rentalPrice: {
      type: Number,
      required: true,
    },
    notes: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending'
    },
  },
  {
    timestamps: true,
  }
);

export default model("rentalHistory", rentalHistorySchema);
