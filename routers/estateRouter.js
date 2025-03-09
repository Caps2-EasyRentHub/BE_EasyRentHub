import express from "express";
import estateCtrl from "../controllers/estateCtrl.js";
import auth from "../middleware/auth.js";

const estateRouter = express.Router();
estateRouter.route("/estates").post(auth, estateCtrl.createEstate);

estateRouter
  .route("/estate/:id")
  .patch(auth, estateCtrl.updateEstate)
  .get(auth, estateCtrl.getEstate)
  .delete(auth, estateCtrl.deleteEstate);

export default estateRouter;
