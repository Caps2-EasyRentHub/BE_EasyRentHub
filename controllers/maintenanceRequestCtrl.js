import Estate from "../models/estateModel.js";
import User from "../models/userModel.js";
import MaintenanceRequest from "../models/maintenanceRequestModel.js";

const maintenanceRequestCtrl = {
  // request for tenant
  createRequest: async (req, res) => {
    try {
      const { estateId, description, priority, images } = req.body;
      const tenantId = req.user._id;

      const estate = await Estate.findById(estateId);
      if (!estate) return res.status(404).json({ msg: "Estate not found" });

      const landlordId = estate.user;

      const newRequest = new MaintenanceRequest({
        estate: estateId,
        tenant: tenantId,
        landlord: landlordId,
        description,
        priority,
        images: images || [],
      });

      await newRequest.save();

      const io = req.io;
      const notification = {
        recipient: landlordId,
        type: "maintenance_request",
        content: `New maintenance request for ${estate.name}`,
        data: { requestId: newRequest._id },
        read: false,
        createdAt: new Date(),
      };

      io.to(`user_${landlordId}`).emit("newNotification", notification);

      return res.status(201).json({
        msg: "Maintenance request created successfully",
        request: newRequest,
      });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },

  getTenantRequests: async (req, res) => {
    try {
      const tenantId = req.user._id;
      const requests = await MaintenanceRequest.find({ tenant: tenantId })
        .populate("estate", "name images")
        .populate("landlord", "username avatar")
        .sort("-createdAt");

      return res.status(200).json({ requests });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },

  getLandlordRequests: async (req, res) => {
    try {
      const landlordId = req.user._id;
      const requests = await MaintenanceRequest.find({ landlord: landlordId })
        .populate("estate", "name images")
        .populate("tenant", "username avatar")
        .sort("-createdAt");

      return res.status(200).json({ requests });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },

  getAllRequests: async (req, res) => {
    try {
      if (req.user._id !== "Admin")
        return res.status(403).json({ msg: "Access denied" });

      const requests = await MaintenanceRequest.find({})
        .populate("estate", "name images")
        .populate("tenant", "username avatar")
        .populate("landlord", "username avatar")
        .sort("-createdAt");

      return res.status(200).json({ requests });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },

  getRequestById: async (req, res) => {
    try {
      const { id } = req.params;
      const request = await MaintenanceRequest.findById(id)
        .populate("estate", "name images address")
        .populate("tenant", "username avatar email phone")
        .populate("landlord", "username avatar email phone");

      if (!request) {
        return res.status(404).json({ msg: "Maintenance request not found" });
      }

      if (
        req.user.role !== "admin" &&
        request.tenant._id.toString() !== req.user._id.toString() &&
        request.landlord._id.toString() !== req.user._id.toString()
      ) {
        return res.status(403).json({ msg: "Access denied" });
      }

      return res.status(200).json({ request });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  updateRequestByLandlord: async (req, res) => {
    try {
      const { id } = req.params;
      const {
        status,
        maintenanceType,
        estimatedCost,
        landlordNotes,
        rejectionReason,
      } = req.body;
      const landlordId = req.user._id;

      const request = await MaintenanceRequest.findById(id);
      if (!request)
        return res.status(404).json({ msg: "Maintenance request not found" });

      if (request.landlord.toString() !== landlordId.toString())
        return res
          .status(403)
          .json({ msg: "You are not authorized to update this request" });

      if (request.status !== "pending")
        return res.status(400).json({
          msg: `Cannot update request that is a already ${request.status}`,
        });

      if (status === "approved") {
        if (!maintenanceType || !estimatedCost) {
          return res.status(400).json({
            msg: "Maintenance type and estimated cost are required for approval",
          });
        }

        request.status = "approved";
        request.maintenanceType = maintenanceType;
        request.estimatedCost = estimatedCost;
        request.landlordNotes = landlordNotes || "";

        if (estimatedCost > 5000000) {
          request.adminApproval = "pending";
        }
      } else if (status === "rejected") {
        if (!rejectionReason) {
          return res.status(400).json({ msg: "Rejection reason is required" });
        }

        request.status = "rejected";
        request.rejectionReason = rejectionReason;
      } else {
        return res.status(400).json({ msg: "Invalid status update" });
      }

      await request.save();

      // Notify
      const io = req.io;

      const tenantNotification = {
        recipient: request.tenant,
        type: "maintenance_update",
        content: `Your maintenance request has been ${status}`,
        data: { requestId: request._id },
        read: false,
        createdAt: new Date(),
      };
      io.to(`user_${request.tenant}`).emit(
        "newNotification",
        tenantNotification
      );

      const adminUsers = await User.find({ role: "admin" }).select("_id");
      adminUsers.forEach((admin) => {
        const adminNotification = {
          recipient: admin._id,
          type: "maintenance_update",
          content: `A maintenance request has been ${status} by landlord`,
          data: { requestId: request._id },
          read: false,
          createdAt: new Date(),
        };
        io.to(`user_${admin._id}`).emit("newNotification", adminNotification);
      });

      return res.status(200).json({
        msg: `Maintenance request ${status} successfully`,
        request,
      });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },

  updateRequestByAdmin: async (req, res) => {
    try {
      const { id } = req.params;
      const { adminApproval, adminNotes, status } = req.body;

      if (req.user.role !== "admin") {
        return res.status(403).json({ msg: "Access denied" });
      }

      const request = await MaintenanceRequest.findById(id);
      if (!request) {
        return res.status(404).json({ msg: "Maintenance request not found" });
      }

      if (adminApproval) {
        request.adminApproval = adminApproval;
      }

      if (adminNotes) {
        request.adminNotes = adminNotes;
      }

      if (status) {
        request.status = status;
      }

      await request.save();

      const io = req.io;

      const landlordNotification = {
        recipient: request.landlord,
        type: "maintenance_admin_update",
        content: `Admin has ${
          adminApproval || status
        } your maintenance request`,
        data: { requestId: request._id },
        read: false,
        createdAt: new Date(),
      };
      io.to(`user_${request.landlord}`).emit(
        "newNotification",
        landlordNotification
      );

      const tenantNotification = {
        recipient: request.tenant,
        type: "maintenance_admin_update",
        content: `Admin has ${
          adminApproval || status
        } your maintenance request`,
        data: { requestId: request._id },
        read: false,
        createdAt: new Date(),
      };
      io.to(`user_${request.tenant}`).emit(
        "newNotification",
        tenantNotification
      );

      return res.status(200).json({
        msg: "Maintenance request updated successfully by admin",
        request,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  updateMaintenanceProgress: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, actualCost, invoiceImages } = req.body;
      const landlordId = req.user._id;

      const request = await MaintenanceRequest.findById(id);
      if (!request) {
        return res.status(404).json({ msg: "Maintenance request not found" });
      }

      if (request.landlord.toString() !== landlordId.toString()) {
        return res
          .status(403)
          .json({ msg: "You are not authorized to update this request" });
      }

      if (request.status !== "approved" && request.status !== "in_progress") {
        return res.status(400).json({
          msg: `Cannot update progress for request in ${request.status} state`,
        });
      }

      if (status === "in_progress") {
        request.status = "in_progress";
      } else if (status === "completed") {
        request.status = "completed";
        request.completionDate = new Date();

        if (actualCost) {
          request.actualCost = actualCost;
        }

        if (invoiceImages && invoiceImages.length > 0) {
          request.invoiceImages = invoiceImages;
        }
      } else {
        return res.status(400).json({ msg: "Invalid status update" });
      }

      await request.save();

      // Notify
      const io = req.io;
      const tenantNotification = {
        recipient: request.tenant,
        type: "maintenance_progress",
        content: `Your maintenance request is now ${status}`,
        data: { requestId: request._id },
        read: false,
        createdAt: new Date(),
      };
      io.to(`user_${request.tenant}`).emit(
        "newNotification",
        tenantNotification
      );

      return res.status(200).json({
        msg: `Maintenance request updated to ${status} successfully`,
        request,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  submitTenantFeedback: async (req, res) => {
    try {
      const { id } = req.params;
      const { rating, tenantFeedback } = req.body;
      const tenantId = req.user._id;

      const request = await MaintenanceRequest.findById(id);
      if (!request) {
        return res.status(404).json({ msg: "Maintenance request not found" });
      }

      if (request.tenant.toString() !== tenantId.toString()) {
        return res.status(403).json({
          msg: "You are not authorized to submit feedback for this request",
        });
      }

      if (request.status !== "completed") {
        return res.status(400).json({
          msg: "Can only submit feedback for completed maintenance requests",
        });
      }

      request.rating = rating;
      request.tenantFeedback = tenantFeedback || "";
      await request.save();

      return res.status(200).json({
        msg: "Feedback submitted successfully",
        request,
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
};

export default maintenanceRequestCtrl;
