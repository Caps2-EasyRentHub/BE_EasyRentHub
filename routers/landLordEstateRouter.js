import express from "express";
import auth from "../middleware/auth.js";
import landlordEstateCtrl from "../controllers/landlordEstateCtrl.js";

const estateRouter = express.Router();

estateRouter.get("/my-estates", auth, landlordEstateCtrl.getMyEstates);

estateRouter.get(
  "/track-monthly-revenue",
  auth,
  landlordEstateCtrl.trackMonthlyRevenue
);

export default estateRouter;
