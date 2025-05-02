import express from "express";
import auth from "../middleware/auth.js";
import notifyCtrl from "../controllers/notifyCtrl.js";

const notifyRouter = express.Router();

notifyRouter.post("/notify", auth, notifyCtrl.createNotify);

notifyRouter.delete("/notify/:id", auth, notifyCtrl.removeNotify);

notifyRouter.get("/notifies", auth, notifyCtrl.getNotifies);

notifyRouter.patch("/isReadNotify/:id", auth, notifyCtrl.isReadNotify);

notifyRouter.delete("/deleteAllNotify", auth, notifyCtrl.deleteAllNotifies);

export default notifyRouter;
