import express from "express";
import auth from "../middleware/auth.js";
import userCtrl from "../controllers/userCtrl.js";
import { adminRole } from "../middleware/checkRole.js";
import manageAccountStatus from "../middleware/manageAccountStatus.js";

const userRouter = express.Router();

userRouter.get("/user/:id", auth, userCtrl.getUser);
userRouter.get("/users", auth, adminRole, userCtrl.getAllUsers);
userRouter.post("/user", auth, adminRole, userCtrl.addUser);
userRouter.patch("/user/:id", auth, userCtrl.updateUser);
userRouter.delete("/user/:id", auth, adminRole, userCtrl.deleteUser);

// User management
userRouter.get("/user-stats", auth, adminRole, userCtrl.getUserStats);
userRouter.get("/user-activity", auth, adminRole, userCtrl.getUserActivity);
userRouter.patch(
  "/user-status/:id",
  auth,
  manageAccountStatus,
  userCtrl.updateUserStatus
);

export default userRouter;
