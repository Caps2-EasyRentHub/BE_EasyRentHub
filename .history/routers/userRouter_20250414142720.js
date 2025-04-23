import express from "express";
import auth from "../middleware/auth.js";
import userCtrl from "../controllers/userCtrl.js";
import { adminRole } from "../middleware/checkRole.js";

const userRouter = express.Router();

userRouter.get("/user/:id", auth, userCtrl.getUser);
userRouter.get('/users', auth, adminRole, userCtrl.getAllUsers);

export default userRouter;