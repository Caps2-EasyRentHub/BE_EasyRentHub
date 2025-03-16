import RentalHistory from "../models/rentalHistoryModel.js";
import Estate from "../models/estateModel.js";
import Users from "../models/userModel.js";

const rentalHistoryCtrl = {
  createRentalHistory: async (req, res) => {
    try {
      const { estateId, tenantId, startDate, rentalPrice, notes } = req.body;

      if (req.user.role !== "Landlord") {
        return res
          .status(403)
          .json({ msg: "Only landlords can create rental histories." });
      }

      if (!estateId || !tenantId || !startDate || !rentalPrice) {
        return res
          .status(400)
          .json({ msg: "Please provide all required fields." });
      }

      const estate = await Estate.findById(estateId);
      if (!estate) {
        return res.status(404).json({ msg: "Estate not found." });
      }

      const landlord = await Users.findById(estate.user);
      if (!landlord || landlord.role !== "Landlord") {
        return res.status(404).json({ msg: "Landlord not found or invalid." });
      }

      const tenant = await Users.findById(tenantId);
      if (!tenant || tenant.role !== "Tenant") {
        return res.status(404).json({ msg: "Tenant not found or invalid." });
      }

      const newRentalHistory = new RentalHistory({
        estate: estateId,
        tenant: tenantId,
        landlord: req.user._id,
        estateName: estate.name,
        address: estate.address,
        property: estate.property,
        images: estate.images,
        startDate,
        rentalPrice,
        notes,
        status: "approved",
      });

      await newRentalHistory.save();

      res.json({
        msg: "Rental history created successfully!",
        rentalHistory: newRentalHistory,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  approveRentalRequest: async (req, res) => {
    try {
      const { rentalHistoryId } = req.params;

      if (req.use.role !== "Landlord") {
        return res
          .status(403)
          .json({ msg: "Only landlords can approve rental requests." });
      }

      const rentalHistory = await RentalHistory.findById(rentalHistoryId);
      if (!rentalHistory) {
        return res.status(404).json({ msg: "Rental request not found." });
      }

      if (rentalHistory.landlord.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          msg: "You are not authorized to approve this rental request.",
        });
      }

      if (rentalHistory.status !== "pending") {
        return res.status(400).json({
          msg: `Cannot approve a request that is already ${rentalHistory.status}.`,
        });
      }

      rentalHistory.status = "approved";
      await rentalHistory.save();

      res.json({
        msg: "Rental request approved successfully",
        rentalHistory,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  rejectRentalRequest: async (req, res) => {
    try {
      const { rentalHistoryId } = req.params;

      if (req.use.role !== "Landlord") {
        return res
          .status(403)
          .json({ msg: "Only landlords can approve rental requests." });
      }

      const rentalHistory = await RentalHistory.findById(rentalHistoryId);
      if (!rentalHistory) {
        return res.status(404).json({ msg: "Rental request not found." });
      }

      if (rentalHistory.landlord.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          msg: "You are not authorized to reject this rental request.",
        });
      }

      if (rentalHistory.status !== "pending") {
        return res.status(400).json({
          msg: `Cannot reject a request that is already ${rentalHistory.status}.`,
        });
      }

      rentalHistory.status = "rejected";
      rentalHistory.notes = reason || rentalHistory.notes;
      await rentalHistory.save();

      res.json({
        msg: "Rental request rejected successfully",
        rentalHistory,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  completeRentalRequest: async (req, res) => {
    try {
      const { rentalHistoryId } = req.params;

      // Kiểm tra vai trò của người dùng
      if (req.user.role !== "Landlord") {
        return res
          .status(403)
          .json({ msg: "Only landlords can complete rental contracts." });
      }

      const rentalHistory = await RentalHistory.findById(rentalHistoryId);
      if (!rentalHistory) {
        return res.status(404).json({ msg: "Rental history not found." });
      }

      // Kiểm tra xem người dùng hiện tại có phải là landlord của bất động sản này không
      if (rentalHistory.landlord.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          msg: "You are not authorized to complete this rental contract.",
        });
      }

      // Kiểm tra xem yêu cầu có đang ở trạng thái "approved" không
      if (rentalHistory.status !== "approved") {
        return res
          .status(400)
          .json({ msg: "Only approved rental contracts can be completed." });
      }

      // Cập nhật trạng thái của yêu cầu thuê
      rentalHistory.status = "completed";
      await rentalHistory.save();

      res.json({
        msg: "Rental contract completed successfully!",
        rentalHistory,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  getAllRentalHistory: async (req, res) => {
    try {
      const filter = {};

      if (req.user.role === "Landlord") {
        filter.landlord = req.user._id;
      } else {
        return res
          .status(403)
          .json({ msg: "You do not have permission to access this resource." });
      }

      const rentalHistories = await RentalHistory.find(filter)
        .populate("tenant", "full_name email avatar mobile")
        .populate("landlord", "full_name email avatar mobile")
        .populate("estate", "name address images property")
        .sort({ createAt: -1 });

      res.json({
        msg: "All rental histories retrieved successfully!",
        rentalHistories,
        count: rentalHistories.length,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

export default rentalHistoryCtrl;
