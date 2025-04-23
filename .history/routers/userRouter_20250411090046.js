import express from "express";
import auth from "../middleware/auth.js";
import userCtrl from "../controllers/userCtrl.js";

const userRouter = express.Router();

userRouter.get("/user/:id", auth, userCtrl.getUser);
userRouter.get("/users", userCtrl.getAllUsers);
export default userRouter;
