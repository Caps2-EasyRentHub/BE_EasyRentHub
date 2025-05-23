import Payment from "../models/paymentModel.js";
import Subscription from "../models/subscriptionPaymentModel.js";
import RentalTransaction from "../models/rentalTransactionModel.js";
import Users from "../models/userModel.js";
import crypto from "crypto";
import axios from "axios";

const paymentCtrl = {
  createPaymentRequest: async (req, res) => {
    try {
      const { planType } = req.body;
      const userId = req.user._id;

      if (!planType || !["FREE", "WEEKLY"].includes(planType)) {
        return res.status(400).json({ msg: "Invalid plan type" });
      }

      const user = await Users.findById(userId);
      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }

      const amount = planType === "FREE" ? 0 : 19000;

      if (planType === "FREE") {
        const existingSubscription = await Subscription.findOne({ userId });
        
        if (existingSubscription && 
            existingSubscription.planType === "WEEKLY" && 
            existingSubscription.endDate > new Date()) {
          return res.status(400).json({ 
            msg: "You already have an active weekly plan. Wait for it to expire before switching to free plan.",
            subscription: existingSubscription
          });
        }
        
        if (existingSubscription) {
          existingSubscription.planType = "FREE";
          existingSubscription.postsRemaining = 5;
          existingSubscription.startDate = new Date();
          existingSubscription.endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
          await existingSubscription.save();
        } else {
          const newSubscription = new Subscription({
            userId,
            planType: "FREE",
            postsRemaining: 5,
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          });
          await newSubscription.save();
        }
        
        const freePayment = new Payment({
          userId,
          amount: 0,
          planType: "FREE",
          paymentMethod: "PAYOS",
          status: "COMPLETED",
          transactionId: `FREE_${Date.now()}`,
          orderInfo: "Free plan activation"
        });
        await freePayment.save();
        
        return res.status(200).json({
          msg: "Free plan activated successfully",
          subscription: existingSubscription || newSubscription
        });
      }

      const orderCode = Date.now();
      const orderDescription = "Weekly plan payment";
      const returnUrl = "https://example.com/success";
      const cancelUrl = "https://example.com/cancel";

      const internalReference = `ORDER_${orderCode}_${userId}`;

      const payosUrl = "https://api-merchant.payos.vn/v2/payment-requests";
      const clientId = process.env.PAYOS_CLIENT_ID || "3876cab7-0901-4202-849d-06f334406bf1";
      const apiKey = process.env.PAYOS_API_KEY || "81177b66-f6d5-466f-9f80-5e5c69a25b9a";
      const checksumKey = process.env.PAYOS_CHECKSUM_KEY || "4185e914a71354a002ce3dc24ca96790d47d9db03b906a3a85adc55908586103";

      const rawSignString = `amount=${amount}&cancelUrl=${cancelUrl}&description=${orderDescription}&orderCode=${orderCode}&returnUrl=${returnUrl}`;
      
      const signature = crypto
        .createHmac("sha256", checksumKey)
        .update(rawSignString)
        .digest("hex");

      const payload = {
        orderCode: orderCode,
        amount: amount,
        description: orderDescription,
        cancelUrl,
        returnUrl,
        signature
      };

      try {
        const response = await axios.post(payosUrl, payload, {
          headers: {
            "Content-Type": "application/json",
            "x-client-id": clientId,
            "x-api-key": apiKey
          }
        });
        
        if (response.data && response.data.code === "00" && response.data.data && response.data.data.checkoutUrl) {
          const newPayment = new Payment({
            userId,
            amount,
            planType,
            paymentMethod: "PAYOS",
            transactionId: String(orderCode),
            orderInfo: orderDescription,
            internalReference
          });

          await newPayment.save();

          return res.json({
            msg: "Payment request created",
            paymentUrl: response.data.data.checkoutUrl,
            paymentId: newPayment._id
          });
        } else {
          return res.status(400).json({
            msg: "Payment request failed",
            details: response.data
          });
        }
      } catch (error) {
        console.error("PayOS error:", error.response?.data || error.message);
        return res.status(400).json({
          msg: "Payment request failed",
          error: error.response?.data || error.message
        });
      }
    } catch (err) {
      console.error("Payment error:", err);
      return res.status(500).json({ msg: err.message || "Payment request failed" });
    }
  },

  paymentWebhook: async (req, res) => {
    try {
      const { data } = req.body;
      
      if (!data || !data.orderCode) {
        return res.status(400).json({ msg: "Invalid webhook data" });
      }

      const { orderCode, status, amount } = data;
      
      const payment = await Payment.findOne({ transactionId: String(orderCode) });
      
      if (!payment) {
        return res.status(404).json({ msg: "Payment not found" });
      }
      
      payment.status = status === "PAID" ? "COMPLETED" : "FAILED";
      payment.paymentResponse = data;
      await payment.save();

      if (status === "PAID") {
        const existingSubscription = await Subscription.findOne({ userId: payment.userId });
        const currentDate = new Date();
        
        if (existingSubscription) {
          existingSubscription.planType = payment.planType;
          existingSubscription.startDate = currentDate;
          
          if (payment.planType === "WEEKLY") {
            existingSubscription.endDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            existingSubscription.postsRemaining = 0;
            existingSubscription.postsUsedToday = 0;
            
            const tomorrow = new Date(currentDate);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(0, 0, 0, 0);
            existingSubscription.postCountResetDate = tomorrow;
          } else {
            existingSubscription.endDate = new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000);
            existingSubscription.postsRemaining = 5;
          }
          
          await existingSubscription.save();
        } else {
          const tomorrow = new Date(currentDate);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(0, 0, 0, 0);
          
          const newSubscription3 = new Subscription({
            userId: payment.userId,
            planType: payment.planType,
            startDate: currentDate,
            endDate: payment.planType === "WEEKLY" 
              ? new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000)
              : new Date(currentDate.getTime() + 30 * 24 * 60 * 60 * 1000),
            postsRemaining: payment.planType === "FREE" ? 5 : 0,
            postsUsedToday: 0,
            postCountResetDate: tomorrow
          });
          
          await newSubscription3.save();
        }
      }

      res.status(200).json({ msg: "Webhook processed successfully" });
    } catch (err) {
      console.error("Webhook error:", err);
      return res.status(500).json({ msg: err.message });
    }
  },

  getUserSubscription: async (req, res) => {
    try {
      const userId = req.user._id;
      
      let subscription = await Subscription.findOne({ userId });
      
      if (!subscription) {
        subscription = new Subscription({
          userId,
          planType: "FREE",
          postsRemaining: 5,
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        
        await subscription.save();
      }

      const now = new Date();
      if (subscription.postCountResetDate && now >= subscription.postCountResetDate) {
        subscription.postsUsedToday = 0;

        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);
        subscription.postCountResetDate = tomorrow;

        await subscription.save();
      }
      
      if (subscription.endDate && subscription.endDate < now) {
        subscription.planType = "FREE";
        subscription.postsRemaining = 5;
        subscription.postsUsedToday = 0;
        subscription.startDate = now;
        subscription.endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await subscription.save();
      }

      let canPost = false;
      let dailyPostLimit = 0;

      if (subscription.planType === "WEEKLY") {
        const daysFromStart = Math.floor((now - subscription.startDate) / (24 * 60 * 60 * 1000));
        
        if (daysFromStart < 4) {
          canPost = true;
          dailyPostLimit = Infinity;
        } else {
          dailyPostLimit = 5;
          canPost = subscription.postsUsedToday < dailyPostLimit;
        }
      } else {
        dailyPostLimit = 5;
        canPost = subscription.postsRemaining > 0;
      }

      res.json({
        subscription,
        canPost,
        dailyPostLimit,
        postsRemaining: subscription.planType === "FREE" 
        ? subscription.postsRemaining 
        : dailyPostLimit === Infinity ? "Unlimited" : dailyPostLimit - subscription.postsUsedToday
    });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  recordPostUsage: async (req, res) => {
    try {
      const userId = req.user._id;
      
      const subscription = await Subscription.findOne({ userId });
      
      if (!subscription) {
        return res.status(404).json({ msg: "Subscription not found" });
      }
      
      const now = new Date();
      
      if (subscription.postCountResetDate && now >= subscription.postCountResetDate) {
        subscription.postsUsedToday = 0;
        
        const tomorrow = new Date();
        tomorrow.setHours(0, 0, 0, 0);
        tomorrow.setDate(tomorrow.getDate() + 1);
        subscription.postCountResetDate = tomorrow;
      }
      
      let canPost = false;
      
      if (subscription.planType === "WEEKLY") {
        const daysFromStart = Math.floor((now - subscription.startDate) / (24 * 60 * 60 * 1000));
        
        if (daysFromStart < 4) {
          canPost = true;
        } else {
          canPost = subscription.postsUsedToday < 3;
        }
        
        if (canPost) {
          subscription.postsUsedToday += 1;
          subscription.lastPostDate = now;
          await subscription.save();
        } else {
          return res.status(403).json({ 
            msg: "Daily post limit reached for your plan",
            subscription
          });
        }
      } else {
        if (subscription.postsRemaining > 0) {
          subscription.postsRemaining -= 1;
          subscription.postsUsedToday += 1;
          subscription.lastPostDate = now;
          await subscription.save();
          canPost = true;
        } else {
          return res.status(403).json({ 
            msg: "Post limit reached for your free plan",
            subscription
          });
        }
      }
      
      res.json({ 
        msg: "Post usage recorded successfully",
        subscription
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  getPaymentHistory: async (req, res) => {
    try {
      const userId = req.user._id;
      
      const payments = await Payment.find({ userId })
        .sort({ createdAt: -1 });
      
      res.json({ payments });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  debugPayos: async (req, res) => {
    try {
      const { planType, returnUrl, cancelUrl } = req.body;
      const userId = req.user._id;
      const amount = planType === "WEEKLY" ? 19000 : 0;
      
      const orderCode = `ORDER_${Date.now()}_${userId}`;
      const orderDescription = `Payment for ${planType} plan`;
      
      const payosUrl = "https://api-merchant.payos.vn/v2/payment-requests";
      const clientId = process.env.PAYOS_CLIENT_ID;
      const apiKey = process.env.PAYOS_API_KEY;
      const checksumKey = process.env.PAYOS_CHECKSUM_KEY;
      
      const payload = {
        orderCode,
        amount,
        description: orderDescription,
        cancelUrl,
        returnUrl,
        expiredAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      };
      
      const signatureData = {};
      signatureData.amount = amount;
      signatureData.cancelUrl = cancelUrl;
      signatureData.description = orderDescription;
      signatureData.orderCode = orderCode;
      signatureData.returnUrl = returnUrl;

      const keys = Object.keys(signatureData).sort();
      const signatureItems = [];

      for (const key of keys) {
        const value = key === 'description' ? encodeURIComponent(signatureData[key]) : signatureData[key];
        signatureItems.push(`${key}=${value}`);
      }

      const dataToSign = signatureItems.join('&');
      const signature = crypto
        .createHmac("sha256", checksumKey)
        .update(dataToSign)
        .digest("hex");
      
      payload.signature = signature;
      
      return res.json({
        debug: {
          payload,
          headers: {
            "x-client-id": clientId,
            "x-api-key": apiKey
          },
          signatureData: dataToSign,
          signature: signature,
          payosUrl
        }
      });
    } catch (error) {
      console.error("Debug error:", error);
      return res.status(500).json({ msg: error.message });
    }
  },

  getDashboardStats: async (req, res) => {
    try {
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      
      const firstDayOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      
      const monthlyRevenue = await Payment.aggregate([
        { 
          $match: { 
            status: "COMPLETED",
            createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
          }
        },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      
      const lastMonthRevenue = await Payment.aggregate([
        { 
          $match: { 
            status: "COMPLETED",
            createdAt: { $gte: firstDayOfLastMonth, $lte: lastDayOfLastMonth }
          }
        },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]);
      
      const monthlyTransactions = await Payment.countDocuments({
        createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
      });
      
      const successfulTransactions = await Payment.countDocuments({
        status: "COMPLETED",
        createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
      });
      
      const failedTransactions = await Payment.countDocuments({
        status: "FAILED",
        createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
      });
      
      const dailyRevenue = await Payment.aggregate([
        {
          $match: {
            status: "COMPLETED",
            createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            amount: { $sum: "$amount" }
          }
        },
        { $sort: { _id: 1 } }
      ]);
      
      const revenueByPlanType = await Payment.aggregate([
        {
          $match: {
            status: "COMPLETED",
            createdAt: { $gte: firstDayOfMonth, $lte: lastDayOfMonth }
          }
        },
        {
          $group: {
            _id: "$planType",
            amount: { $sum: "$amount" }
          }
        }
      ]);

      const currentMonthTotal = monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0;
      const previousMonthTotal = lastMonthRevenue.length > 0 ? lastMonthRevenue[0].total : 0;
      
      let revenueGrowth = 0;
      if (previousMonthTotal > 0) {
        revenueGrowth = ((currentMonthTotal - previousMonthTotal) / previousMonthTotal) * 100;
      }

      return res.status(200).json({
        revenue: {
          currentMonth: currentMonthTotal,
          previousMonth: previousMonthTotal,
          growth: revenueGrowth.toFixed(2)
        },
        transactions: {
          total: monthlyTransactions,
          successful: successfulTransactions,
          failed: failedTransactions,
          successRate: monthlyTransactions > 0 ? (successfulTransactions / monthlyTransactions * 100).toFixed(2) : 0
        },
        charts: {
          dailyRevenue,
          revenueByPlanType
        }
      });
    } catch (err) {
      console.error("Admin dashboard error:", err);
      return res.status(500).json({ msg: err.message });
    }
  },
  
  getTransactionHistory: async (req, res) => {
    try {
      const { page = 1, limit = 10, search = '', startDate, endDate, status } = req.query;
      const skip = (page - 1) * limit;
      
      let dateFilter = {};
      if (startDate && endDate) {
        dateFilter.createdAt = {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        };
      }
      
      let statusFilter = {};
      if (status) {
        statusFilter.status = status;
      }
      
      let searchFilter = {};
      if (search) {
        searchFilter = {
          $or: [
            { transactionId: { $regex: search, $options: 'i' } },
            { orderInfo: { $regex: search, $options: 'i' } }
          ]
        };
      }
      
      const payments = await Payment.find({
        ...dateFilter,
        ...statusFilter,
        ...searchFilter
      })
      .populate('userId', 'full_name email avatar role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
      
      const total = await Payment.countDocuments({
        ...dateFilter,
        ...statusFilter,
        ...searchFilter
      });
      
      const totalSuccessfulAmount = await Payment.aggregate([
        {
          $match: {
            status: "COMPLETED",
            ...dateFilter,
            ...searchFilter
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$amount" }
          }
        }
      ]);

      return res.status(200).json({
        transactions: payments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total
        },
        stats: {
          totalAmount: totalSuccessfulAmount.length > 0 ? totalSuccessfulAmount[0].total : 0
        }
      });
    } catch (err) {
      console.error("Admin transaction history error:", err);
      return res.status(500).json({ msg: err.message });
    }
  },
  
  getTransactionDetail: async (req, res) => {
    try {
      const { id } = req.params;
      
      const payment = await Payment.findById(id)
        .populate('userId', 'full_name email avatar mobile address role');
      
      if (!payment) {
        return res.status(404).json({ msg: "Không tìm thấy giao dịch" });
      }

      return res.status(200).json({ transaction: payment });
    } catch (err) {
      console.error("Admin transaction detail error:", err);
      return res.status(500).json({ msg: err.message });
    }
  }
};

export default paymentCtrl;