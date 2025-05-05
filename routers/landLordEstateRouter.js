import express from "express";
import auth from "../middleware/auth.js";
import landlordEstateCtrl from "../controllers/landlordEstateCtrl.js";

const estateRouter = express.Router();

estateRouter.get("/my-estates", auth, landlordEstateCtrl.getMyEstates);

estateRouter.get(
  "/track-revenue",
  auth,
  landlordEstateCtrl.trackMonthlyRevenue
);

estateRouter.get(
  "/revenue-details",
  auth,
  landlordEstateCtrl.getRevenueDetailsByTimeRange
);

export default estateRouter;
