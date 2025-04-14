import express from "express";
import auth from "../middleware/auth.js";
import userCtrl from "../controllers/userCtrl.js";
import { adminRole } from "../middleware/checkRole.js";

const userRouter = express.Router();

userRouter.get("/user/:id", auth, userCtrl.getUser);
userRouter.get('/users', auth, adminRole, userCtrl.getAllUsers);
userRouter.post('/user', auth, adminRole, userCtrl.addUser); 
userRouter.patch('/user/:id', auth, userCtrl.updateUser);
userRouter.delete('/user/:id', auth, adminRole, userCtrl.deleteUser);

export default userRouter;