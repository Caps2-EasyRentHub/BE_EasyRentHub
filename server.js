import dotenv from "dotenv";
import express, { json } from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ExpressPeerServer } from "peer";
import http from "http";
import { Server } from "socket.io";
import authRouter from "./routers/authRouter.js";
import userRouter from "./routers/userRouter.js";
import estateRouter from "./routers/estateRouter.js";
import rentalHistoryRouter from "./routers/rentalHistoryRouter.js";
import bookingRouter from "./routers/bookingRouter.js";
import landlordEstateRouter from "./routers/landLordEstateRouter.js";
import favoriteRouter from "./routers/favoriteRouter.js";
import reviewRouter from "./routers/reviewRouter.js";
import notifyRouter from "./routers/notifyRouter.js";
import { SocketServer } from "./utils/socketServer.js";
import socketMiddleware from "./middleware/socketMiddleware.js";
import maintenanceRequestRouter from "./routers/maintenanceRequestRouter.js";
import messageRouter from "./routers/messageRouter.js";
import uploadRouter from "./routers/uploadRouter.js";
import { chatSocketHandler } from "./utils/chatSocket.js";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import paymentRouter from "./routers/paymentRouter.js";
import faceAuthRouter from "./routers/faceAuthRouter.js";
import FaceRecognitionService from "./services/faceRecognition.service.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
app.use(json());
app.use(cors());
app.use(cookieParser());

// Socket
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

SocketServer(io);
app.use(socketMiddleware(io));
chatSocketHandler(io);

// Peer server
ExpressPeerServer(http, { path: "/" });

// Routes
app.use("/api", authRouter);
app.use("/api", userRouter);
app.use("/api", estateRouter);
app.use("/api", reviewRouter);
app.use("/api", notifyRouter);
app.use("/api", rentalHistoryRouter);
app.use("/api", bookingRouter);
app.use("/api", maintenanceRequestRouter);
app.use("/api/landlord", landlordEstateRouter);
app.use("/api/favorite", favoriteRouter);
app.use("/api/upload", uploadRouter);
app.use("/uploads", express.static("uploads"));
app.use("/api/messages", messageRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/face-auth", faceAuthRouter);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
};

async function initializeServices() {
  try {
    console.log("Initializing AWS Rekognition collection...");
    await FaceRecognitionService.createCollection();
    console.log("AWS resources initialized successfully");
  } catch (error) {
    console.error("Failed to initialize AWS resources:", error);
  }
}

await initializeServices();

const PORT = process.env.PORT || 5000;

server.listen(PORT, process.env.IP_ADDRESS, () => {
  console.log(`Server running at http://${process.env.IP_ADDRESS}:${PORT}`);
});

connectDB();
