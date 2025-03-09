import dotenv from 'dotenv'
import express, { json } from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ExpressPeerServer } from "peer";
import http from 'http';
import authRouter from './routers/authRouter.js';

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

const connectDB = async () => {
  try {
      await mongoose.connect(process.env.MONGODB_URL);
      console.log("Connected to MongoDB");
  } catch (error) {
      console.error("Failed to connect to MongoDB:", error);
      process.exit(1); // Thoát chương trình nếu kết nối thất bại
  }
};

const port = process.env.PORT || 5000;
server.listen(port, () => {
  console.log("Server is running on port", port);
});

connectDB();
