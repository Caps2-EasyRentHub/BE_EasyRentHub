import express from "express";
import paymentCtrl from "../controllers/paymentCtrl.js";
import auth from "../middleware/auth.js";
import { adminRole } from "../middleware/checkRole.js";

const router = express.Router();

router.post("/create-payment", auth, paymentCtrl.createPaymentRequest);
router.get("/subscription-payment", auth, paymentCtrl.getUserSubscription);
router.get("/history-payment", auth, paymentCtrl.getPaymentHistory);
router.post("/webhook-payment", paymentCtrl.paymentWebhook);
router.post("/record-usage-payment", auth, paymentCtrl.recordPostUsage);

router.post("/debug-payos-payment", auth, paymentCtrl.debugPayos);

// Admin routes
router.get('/dashboard', auth, adminRole, paymentCtrl.getDashboardStats);
router.get('/transactions', auth, adminRole, paymentCtrl.getTransactionHistory);
router.get('/transactions/:id', auth, adminRole, paymentCtrl.getTransactionDetail);

export default router;