import express from "express";
import auth from "../middleware/auth.js";
import userCtrl from "../controllers/userCtrl.js";

const userRouter = express.Router();

userRouter.get("/user/:id", auth, userCtrl.getUser);

export default userRouter;
