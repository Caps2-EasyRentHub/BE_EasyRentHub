import Users from "../models/userModel.js";
import RentalTransaction from "../models/rentalTransactionModel.js";
import Estate from "../models/estateModel.js";

const bookingCtrl = {
  createBookingRequest: async (req, res) => {
    try {
      const { estateId, startDate, notes } = req.body;

      if (req.user.role != "Tenant") {
        return res
          .status(403)
          .json({ msg: "Only tenants can create booking request." });
      }

      const recentCancellation = await RentalTransaction.findOne({
        tenant: req.user._id,
        status: "cancelled",
        cancelledAt: { $gte: new Date(Date.now() - 0.1 * 60 * 1000) },
      });

      if (recentCancellation) {
        return res.status(403).json({
          msg: "You cannot create a new booking request within 15 minutes of canceling a previous booking.",
        });
      }

      if (!estateId || !startDate || !notes) {
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

      if (estate.status !== "available") {
        return res.status(400).json({
          msg: "This property is currently not available for booking. Another tenant has already sent a request.",
        });
      }

      const newBooking = new RentalTransaction({
        estate: estateId,
        tenant: req.user._id,
        landlord: estate.user,
        estateName: estate.name,
        address: estate.address,
        property: estate.property,
        images: estate.images,
        startDate,
        rentalPrice: estate.price,
        notes,
        status: "pending",
        isBooked: true,
      });

      await newBooking.save();

      estate.status = "pending";
      estate.user = req.user._id;
      await estate.save();

      res.json({
        msg: "Booking request created successfully! Waiting for landlord approval.",
        booking: newBooking,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  approveRequest: async (req, res) => {
    try {
      const { rentalHistoryId } = req.params;

      if (req.user.role !== "Landlord") {
        return res
          .status(403)
          .json({ msg: "Only landlords can approve rental requests." });
      }

      const rental = await RentalTransaction.findById(rentalHistoryId);
      if (!rental) {
        return res.status(404).json({ msg: "Rental request not found." });
      }

      if (rental.landlord.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          msg: "You are not authorized to approve this rental request.",
        });
      }

      if (rental.status !== "pending") {
        return res.status(400).json({
          msg: `Cannot approve a request that is already ${rental.status}.`,
        });
      }

      rental.status = "approved";
      await rental.save();

      const estate = await Estate.findById(rental.estate);
      if (estate) {
        estate.status = "booked";
        await estate.save();
      }

      res.json({
        msg: "Rental request approved successfully",
        rental,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  cancelBookingRequest: async (req, res) => {
    try {
      const { rentalHistoryId } = req.params;

      if (req.user.role !== "Tenant") {
        return res
          .status(403)
          .json({ msg: "Only tenants can cancel booking request." });
      }

      const rental = await RentalTransaction.findById(rentalHistoryId);
      if (!rental) {
        return res
          .status(404)
          .json({ msg: "Only tenants can cancel booking requests." });
      }

      if (rental.tenant.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          msg: "You are not authorized to cancel this booking request.",
        });
      }

      if (rental.status !== "pending") {
        return res.status(400).json({
          msg: "Only pending booking requests can be cancelled.",
        });
      }

      rental.status = "cancelled";
      rental.isBooked = false;
      rental.cancelledAt = new Date();
      await rental.save();

      const estate = await Estate.findById(rental.estate);
      if (estate) {
        estate.status = "available";
        await estate.save();
      }

      res.json({
        msg: "Booking request cancelled successfully",
        rental,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  getTenantBookings: async (req, res) => {
    try {
      if (req.user.role !== "Landlord") {
        return res.status(403).json({
          msg: "You do not have permission to access this resource.",
        });
      }

      const bookings = await RentalTransaction.find({
        landlord: req.user._id,
        status: { $in: ["pending", "approved", "rejected", "cancelled"] },
      })
        .populate("tenant", "full_name email avatar mobile")
        .populate("estate", "name address images property status")
        .sort({ createAt: -1 });

      res.json({
        msg: "Landlord bookings retrieved successfully!",
        bookings,
        count: bookings.length,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

export default bookingCtrl;
