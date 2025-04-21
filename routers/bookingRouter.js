import express from "express";
import bookingCtrl from "../controllers/bookingCtrl.js";
import auth from "../middleware/auth.js";

const bookingRouter = express.Router();

bookingRouter.post("/rental/request", auth, bookingCtrl.createBookingRequest);

bookingRouter.patch(
  "/rental/approve/:rentalHistoryId",
  auth,
  bookingCtrl.approveRequest
);

bookingRouter.patch(
  "/rental/cancel/:rentalHistoryId",
  auth,
  bookingCtrl.cancelBookingRequest
);

bookingRouter.get(
  "/rental/tenant-bookings",
  auth,
  bookingCtrl.getTenantBookings
);

bookingRouter.get(
  "/rental/tenant-bookings/:id",
  auth,
  bookingCtrl.getUserBookings
);

bookingRouter.get("/rental/all-bookings", auth, bookingCtrl.getAllBookings);

export default bookingRouter;
