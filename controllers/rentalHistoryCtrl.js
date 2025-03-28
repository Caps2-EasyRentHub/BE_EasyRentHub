import RentalTransaction from "../models/rentalTransactionModel.js";
import Estate from "../models/estateModel.js";

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

      const rental = await RentalTransaction.find(filter)
        .populate("tenant", "full_name email avatar mobile")
        .populate("landlord", "full_name email avatar mobile")
        .populate("estate", "name address images property")
        .sort({ createAt: -1 });

      res.json({
        msg: "All rental histories retrieved successfully!",
        rental,
        count: rental.length,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  getTenantBookingsHistory: async (req, res) => {
    try {
      if (req.user.role !== "Tenant") {
        return res.status(403).json({
          msg: "You do not have permission to access this resource.",
        });
      }

      const bookings = await RentalTransaction.find({
        tenant: req.user._id,
      })
        .populate("landlord", "full_name email avatar mobile")
        .populate("estate", "name address images property")
        .sort({ createdAt: -1 });

      res.json({
        msg: "Tenant bookings retrieved successfully",
        bookings,
        count: bookings.length,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

export default rentalHistoryCtrl;
