import mongoose from "mongoose";
const { Schema, Types, model } = mongoose;

const maintenanceRequestSchema = new Schema(
  {
    estate: { type: Types.ObjectId, ref: "estate", required: true },
    tenant: { type: Types.ObjectId, ref: "user", required: true },
    landlord: { type: Types.ObjectId, ref: "user", required: true },
    description: { type: String, required: true },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    images: {
      type: Array,
      default: [],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "in_progress", "completed"],
      default: "pending",
    },
    landlordNotes: { type: String, default: "" },
    rejectionReason: { type: String, default: "" },
    maintenanceType: {
      type: String,
      enum: ["self_repair", "contractor"],
      required: function () {
        return this.status === "approved";
      },
    },
    estimatedCost: {
      type: Number,
      required: function () {
        return this.status === "approved";
      },
    },
    actualCost: { type: Number, default: 0 },
    invoiceImages: {
      type: Array,
      default: [],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      validate: {
        validator: function (v) {
          return v === null || v === undefined || (v >= 1 && v <= 5);
        },
        message: "Rating must be between 1 and 5",
      },
      default: undefined,
    },
    tenantFeedback: { type: String, default: "" },
    completionDate: { type: Date },
  },
  {
    timestamps: true,
  }
);

export default model("maintenanceRequest", maintenanceRequestSchema);
