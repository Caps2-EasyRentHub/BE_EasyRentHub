import dotenv from "dotenv";
import express, { json } from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ExpressPeerServer } from "peer";
import http from "http";
import authRouter from "./routers/authRouter.js";
import userRouter from './routers/userRouter.js'
import estateRouter from "./routers/estateRouter.js";
import rentalHistoryRouter from "./routers/rentalHistoryRouter.js";
import bookingRouter from "./routers/bookingRouter.js";
import landlordEstateRouter from "./routers/landLordEstateRouter.js";

const app = express();
dotenv.config();
app.use(json());
app.use(cors());
app.use(cookieParser());

// Socket
const server = http.createServer(app);

// Create peer server
ExpressPeerServer(http, { path: "/" });

// Routes
app.use("/api", authRouter);
app.use("/api", userRouter)
app.use("/api", estateRouter);
app.use("/api", rentalHistoryRouter);
app.use("/api", bookingRouter);
app.use("/api/landlord", landlordEstateRouter);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
};

const port = process.env.PORT || 5000;
server.listen(port, '0.0.0.0', () => {
  console.log("Server is running on port", port);
});

connectDB();
