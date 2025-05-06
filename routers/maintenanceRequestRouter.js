import express from "express";
import maintenanceRequestCtrl from "../controllers/maintenanceRequestCtrl.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Tenant routes
router.post("/maintenance", auth, maintenanceRequestCtrl.createRequest);
router.get(
  "/maintenance/tenant",
  auth,
  maintenanceRequestCtrl.getTenantRequests
);
router.post(
  "/maintenance/:id/feedback",
  auth,
  maintenanceRequestCtrl.submitTenantFeedback
);

// Landlord routes
router.get(
  "/maintenance/landlord",
  auth,
  maintenanceRequestCtrl.getLandlordRequests
);
router.patch(
  "/maintenance/landlord/:id",
  auth,
  maintenanceRequestCtrl.updateRequestByLandlord
);
router.patch(
  "/maintenance/progress/:id",
  auth,
  maintenanceRequestCtrl.updateMaintenanceProgress
);

// Admin routes
router.get("/maintenance/all", auth, maintenanceRequestCtrl.getAllRequests);
router.patch(
  "/maintenance/admin/:id",
  auth,
  maintenanceRequestCtrl.updateRequestByAdmin
);

// Common routes
router.get("/maintenance/:id", auth, maintenanceRequestCtrl.getRequestById);

export default router;
