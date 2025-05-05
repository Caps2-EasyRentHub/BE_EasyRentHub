import { reverse } from "dns/promises";
import Estate from "../models/estateModel.js";
import rentalTransactionModel from "../models/rentalTransactionModel.js";

const landlordEstateCtrl = {
  getMyEstates: async (req, res) => {
    try {
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
      const { year = new Date().getFullYear(), type = "monthth" } = req.query;
      const yearNum = parseInt(year);

      if (isNaN(yearNum))
        return res.status(400).json({ msg: "Năm không hợp lệ" });

      let result = {};

      switch (type) {
        case "monthly": {
          const monthlyRevenue = [];
          const monthlyDetails = [];

          for (let month = 0; month < 12; month++) {
            const startOfMonth = new Date(yearNum, month, 1);
            const endOfMonth = new Date(yearNum, month + 1, 0);

            const transactions = await rentalTransactionModel
              .find({
                landlord: req.user._id,
                status: "approved",
                startDate: {
                  $gte: startOfMonth,
                  $lte: endOfMonth,
                },
              })
              .populate("estate", "name")
              .populate("tenant", "full_name");

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
                  count: { $sum: 1 },
                },
              },
            ]);

            const monthRevenue =
              totalRevenue.length > 0 ? totalRevenue[0].total : 0;
            const transactionCount =
              totalRevenue.lenth > 0 ? totalRevenue[0].count : 0;

            monthlyRevenue.push(monthRevenue);
            monthlyDetails.push({
              month: month + 1,
              monthName: new Date(yearNum, month, 1).toLocaleString("vi-VN", {
                month: "long",
              }),
              revenue: monthRevenue,
              transactionCount,
              transactions: transactions.map((t) => ({
                id: t._id,
                estateName: t.estateName,
                tenant: t.tenant?.full_name || "Không có thông tin",
                startDate: t.startDate,
                endDate: t.endDate,
                rentalPrice: t.rentalPrice,
              })),
            });
          }

          const totalYearlyRevenue = monthlyRevenue.reduce(
            (sum, current) => sum + current,
            0
          );

          result = {
            type: "monthly",
            year: yearNum,
            totalRevenue: totalYearlyRevenue,
            monthlyRevenue,
            details: monthlyDetails,
          };
          break;
        }

        case "quarterly": {
          const quarterlyRevenue = [0, 0, 0, 0];
          const quarterlyDetails = [];

          // Define quarters
          const quarters = [
            { name: "Quý 1", months: [0, 1, 2] },
            { name: "Quý 2", months: [3, 4, 5] },
            { name: "Quý 3", months: [6, 7, 8] },
            { name: "Quý 4", months: [9, 10, 11] },
          ];

          for (let q = 0; q < 4; q++) {
            const startOfQuarter = new Date(yearNum, quarters[q].months[0], 1);
            const endOfQuarter = new Date(
              yearNum,
              quarters[q].months[2] + 1,
              0
            );

            const transactions = await rentalTransactionModel
              .find({
                landlord: req.user._id,
                status: "approved",
                startDate: {
                  $gte: startOfQuarter,
                  $lte: endOfQuarter,
                },
              })
              .populate("estate", "name")
              .populate("tenant", "full_name");

            const totalRevenue = await rentalTransactionModel.aggregate([
              {
                $match: {
                  landlord: req.user._id,
                  status: "approved",
                  startDate: {
                    $gte: startOfQuarter,
                    $lte: endOfQuarter,
                  },
                },
              },
              {
                $group: {
                  _id: null,
                  total: {
                    $sum: "$rentalPrice",
                  },
                  count: { $sum: 1 },
                },
              },
            ]);

            const quarterRevenue =
              totalRevenue.length > 0 ? totalRevenue[0].total : 0;
            const transactionCount =
              totalRevenue.length > 0 ? totalRevenue[0].count : 0;

            quarterlyRevenue[q] = quarterRevenue;
            quarterlyDetails.push({
              quarter: q + 1,
              name: quarters[q].name,
              revenue: quarterRevenue,
              transactionCount,
              transactions: transactions.map((t) => ({
                id: t._id,
                estateName: t.estateName,
                tenant: t.tenant?.full_name || "Không có thông tin",
                startDate: t.startDate,
                endDate: t.endDate,
                rentalPrice: t.rentalPrice,
              })),
            });
          }

          const totalYearlyRevenue = quarterlyRevenue.reduce(
            (sum, current) => sum + current,
            0
          );

          result = {
            type: "quarterly",
            year: yearNum,
            totalRevenue: totalYearlyRevenue,
            quarterlyRevenue,
            details: quarterlyDetails,
          };
          break;
        }

        case "yearly": {
          const startOfYear = new Date(yearNum, 0, 1);
          const endOfYear = new Date(yearNum, 11, 31, 23, 59, 59);

          const transactions = await rentalTransactionModel
            .find({
              landlord: req.user._id,
              status: "approved",
              startDate: {
                $gte: startOfYear,
                $lte: endOfYear,
              },
            })
            .populate("estate", "name")
            .populate("tenant", "full_name");

          const totalRevenue = await rentalTransactionModel.aggregate([
            {
              $match: {
                landlord: req.user._id,
                status: "approved",
                startDate: {
                  $gte: startOfYear,
                  $lte: endOfYear,
                },
              },
            },
            {
              $group: {
                _id: null,
                total: {
                  $sum: "$rentalPrice",
                },
                count: { $sum: 1 },
              },
            },
          ]);

          const yearlyRevenue =
            totalRevenue.length > 0 ? totalRevenue[0].total : 0;
          const transactionCount =
            totalRevenue.length > 0 ? totalRevenue[0].count : 0;

          result = {
            type: "yearly",
            year: yearNum,
            totalRevenue: yearlyRevenue,
            transactionCount,
            transactions: transactions.map((t) => ({
              id: t._id,
              estateName: t.estateName,
              tenant: t.tenant?.full_name || "Không có thông tin",
              startDate: t.startDate,
              endDate: t.endDate,
              rentalPrice: t.rentalPrice,
            })),
          };
          break;
        }

        default:
          return res.status(400).json({
            msg: "Loại thống kê không hợp lệ. Vui lòng chọn: monthly, quarterly, hoặc yearly",
          });
      }

      // Calculate overall stats
      const startOfAllTime = new Date(2000, 0, 1);
      const endOfAllTime = new Date();

      const overallStats = await rentalTransactionModel.aggregate([
        {
          $match: {
            landlord: req.user._id,
            status: "approved",
            startDate: {
              $gte: startOfAllTime,
              $lte: endOfAllTime,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: "$rentalPrice",
            },
            transactionCount: { $sum: 1 },
          },
        },
      ]);

      const allTimeStats =
        overallStats.length > 0
          ? {
              totalRevenue: overallStats[0].totalRevenue,
              transactionCount: overallStats[0].transactionCount,
            }
          : {
              totalRevenue: 0,
              transactionCount: 0,
            };

      res.json({
        msg: "Thống kê doanh thu đã được tính toán thành công!",
        result,
        allTimeStats,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  getRevenueDetailsByTimeRange: async (req, res) => {
    try {
      if (req.user.role !== "Landlord") {
        return res.status(403).json({
          msg: "Bạn không có quyền truy cập vào tài nguyên này.",
        });
      }

      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          msg: "Vui lòng cung cấp ngày bắt đầu và ngày kết thúc.",
        });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          msg: "Định dạng ngày không hợp lệ. Vui lòng nhập định dạng YYYY-MM-DD.",
        });
      }

      if (start > end) {
        return res.status(400).json({
          msg: "Ngày bắt đầu phải trước ngày kết thúc.",
        });
      }

      const transactions = await rentalTransactionModel
        .find({
          landlord: req.user._id,
          status: "approved",
          startDate: {
            $gte: start,
            $lte: end,
          },
        })
        .populate("estate", "name address images")
        .populate("tenant", "full_name email avatar mobile")
        .sort({ startDate: -1 });

      const summary = await rentalTransactionModel.aggregate([
        {
          $match: {
            landlord: req.user._id,
            status: "approved",
            startDate: {
              $gte: start,
              $lte: end,
            },
          },
        },
        {
          $group: {
            _id: null,
            totalRevenue: {
              $sum: "$rentalPrice",
            },
            avgRevenue: {
              $avg: "$rentalPrice",
            },
            maxRevenue: {
              $max: "$rentalPrice",
            },
            minRevenue: {
              $min: "$rentalPrice",
            },
            transactionCount: { $sum: 1 },
          },
        },
      ]);

      res.json({
        msg: "Lấy chi tiết doanh thu theo khoảng thời gian thành công!",
        transactions,
        summary:
          summary.length > 0
            ? summary[0]
            : {
                totalRevenue: 0,
                avgRevenue: 0,
                maxRevenue: 0,
                minRevenue: 0,
                transactionCount: 0,
              },
        timeRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

export default landlordEstateCtrl;
