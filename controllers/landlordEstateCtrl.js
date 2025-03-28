import Estate from "../models/estateModel.js";
import rentalTransactionModel from "../models/rentalTransactionModel.js";

const landlordEstateCtrl = {
  getMyEstates: async (req, res) => {
    try {
      // Lấy tất cả phòng của chủ nhà
      if (req.user.role !== "Landlord") {
        return res.status(403).json({
          msg: "Bạn không có quyền truy câp vào tài nguyên này.",
        });
      }

      const estates = await Estate.find({ user: req.user._id }).sort({
        createAt: -1,
      });

      res.json({
        msg: "Lấy danh sách phòng thành công!",
        estates,
        count: estates.length,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  trackMonthlyRevenue: async (req, res) => {
    try {
      if (req.user.role !== "Landlord") {
        return res.status(403).json({
          msg: "Bạn không có quyền truy cập vào tài nguyên này.",
        });
      }

      const currentYear = new Date().getFullYear();
      const monthlyRevenue = [];

      for (let month = 0; month < 12; month++) {
        const startOfMonth = new Date(currentYear, month, 1);
        const endOfMonth = new Date(currentYear, month + 1, 0);

        const totalRevenue = await rentalTransactionModel.aggregate([
          {
            $match: {
              landlord: req.user._id,
              status: "approved",
              startDate: {
                $gte: startOfMonth,
                $lte: endOfMonth,
              },
            },
          },
          {
            $group: {
              _id: null,
              total: {
                $sum: "$rentalPrice",
              },
            },
          },
        ]);

        monthlyRevenue.push(
          totalRevenue.length > 0 ? totalRevenue[0].total : 0
        );
      }

      res.json({
        msg: "Doanh thu hàng tháng đã được tính toán thành công!",
        monthlyRevenue,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

export default landlordEstateCtrl;
