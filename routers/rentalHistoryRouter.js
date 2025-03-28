import express from "express";
import rentalHistoryCtrl from "../controllers/rentalHistoryCtrl.js";
import auth from "../middleware/auth.js";

const rentalHistoryRouter = express.Router();

rentalHistoryRouter.get(
  "/create-rental-history",
  auth,
  rentalHistoryCtrl.createRentalHistory
);

rentalHistoryRouter.get(
  "/rental-history/all",
  auth,
  rentalHistoryCtrl.getAllRentalHistory
);

rentalHistoryRouter.get(
  "/booking-history",
  auth,
  rentalHistoryCtrl.getTenantBookingsHistory
);

export default rentalHistoryRouter;
