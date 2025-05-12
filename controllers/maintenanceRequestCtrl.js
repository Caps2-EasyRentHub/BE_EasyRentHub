import Estate from "../models/estateModel.js";
import User from "../models/userModel.js";
import MaintenanceRequest from "../models/maintenanceRequestModel.js";
import Notify from "../models/notifyModel.js";

const maintenanceRequestCtrl = {
  // request for tenant
  createRequest: async (req, res) => {
    try {
      const { estateId, description, priority, images } = req.body;
      const tenantId = req.user._id;

      const estate = await Estate.findById(estateId);
      if (!estate) return res.status(404).json({ msg: "Estate not found" });

      const landlordId = estate.user;

      console.log(images);
      const imageArray = Array.isArray(images)
        ? images
        : images
        ? [images]
        : [];
      console.log("landlordId:", landlordId);
      console.log("images:", imageArray);

      const newRequest = new MaintenanceRequest({
        estate: estateId,
        tenant: tenantId,
        landlord: landlordId,
        description,
        priority,
        images: imageArray,
      });

      await newRequest.save();

      const newNotify = new Notify({
        user: tenantId,
        recipients: [landlordId],
        url: `/maintenance/${newRequest._id}`,
        text: "Yêu cầu bảo trì mới",
        content: `Yêu cầu bảo trì mới cho ${estate.name}`,
        image: images.length > 0 ? images[0] : "",
        isRead: false,
      });
      await newNotify.save();

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

      if (req.io) {
        req.io.to(`user_${tenantId}`).emit("markMaintenanceNotificationsRead", {
          userId: tenantId,
        });

        await Notify.updateMany(
          {
            recipients: tenantId,
            content: { $regex: "maintenance|bảo trì|sửa chữa", $options: "i" },
            isRead: false,
          },
          { isRead: true }
        );
      }

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

      if (req.io) {
        req.io
          .to(`user_${landlordId}`)
          .emit("markMaintenanceNotificationsRead", {
            userId: landlordId,
          });

        await Notify.updateMany(
          {
            recipients: landlordId,
            content: { $regex: "maintenance|bảo trì|sửa chữa", $options: "i" },
            isRead: false,
          },
          { isRead: true }
        );
      }

      return res.status(200).json({ requests });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },

  getAllRequests: async (req, res) => {
    try {
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

      const estate = await Estate.findById(request.estate);
      const estateName = estate ? estate.name : "property";
      const estateImage =
        estate && estate.images && estate.images.length > 0
          ? estate.images[0]
          : "";

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

      const tenantNotify = new Notify({
        user: landlordId,
        recipients: [request.tenant],
        url: `/maintenance/${request._id}`,
        text: `Yêu cầu bảo trì ${status === "approved" ? "đã chấp nhận" : ""}`,
        content: `Yêu cầu bảo trì của bạn cho ${estateName} đã được ${
          status === "approved" ? "đã chấp nhận" : ""
        }`,
        image: estateImage,
        isRead: false,
      });
      await tenantNotify.save();

      if (status === "pending" && estimatedCost > 5000000) {
        const adminUsers = await User.find({ role: "admin" }).select("_id");
        const adminNotify = new Notify({
          user: landlordId,
          recipients: adminUsers.map((admin) => admin._id),
          url: `/maintenance/${request._id}`,
          text: `High-cost maintenance approval needed`,
          content: `A high-cost maintenance request (${estimatedCost.toLocaleString()} VND) needs approval`,
          image: estateImage,
          isRead: false,
        });
        await adminNotify.save();
      }

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

      const landlordNotify = new Notify({
        user: adminId,
        recipients: [request.landlord],
        url: `/maintenance/${request._id}`,
        text: `Cập nhật của quản trị viên về yêu cầu bảo trì`,
        content: `Quản trị viên có ${
          adminApproval || status || "updated"
        } yêu cầu bảo trì của bạn cho ${estateName}`,
        isRead: false,
      });
      await landlordNotify.save();

      const tenantNotify = new Notify({
        user: adminId,
        recipients: [request.tenant],
        url: `/maintenance/${request._id}`,
        text: `Cập nhật của quản trị viên về yêu cầu bảo trì`,
        content: `Quản trị viên có ${
          adminApproval || status || "updated"
        } yêu cầu bảo trì của bạn cho ${estateName}`,
        isRead: false,
      });
      await tenantNotify.save();

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

      const estate = await Estate.findById(request.estate);
      const estateName = estate ? estate.name : "property";
      const estateImage =
        estate && estate.images && estate.images.length > 0
          ? estate.images[0]
          : "";

      const newNotify = new Notify({
        user: landlordId,
        recipients: [request.tenant],
        url: `/maintenance/${request._id}`,
        text: `Yêu cầu bảo trì ${
          status === "in_progress" ? "đang tiến hành xử lí" : ""
        }`,
        content: `Yêu cầu bảo trì của bạn cho ${estateName} hiện là ${
          status === "in_progress" ? "đang tiến hành xử lí" : ""
        }`,
        image: estateImage,
        isRead: false,
      });
      await newNotify.save();

      if (
        status === "completed" &&
        Math.abs(request.estimatedCost - actualCost) > 1000000
      ) {
        const adminUsers = await User.find({ role: "admin" }).select("_id");
        const adminNotify = new Notify({
          user: landlordId,
          recipients: [request.tenant],
          url: `/maintenance/${request._id}`,
          text: `Chi phí trong bảo trì khi đã hoàn thành.`,
          content: `Bảo trì hoàn thành với chi phí: Ước tính ${request.estimatedCost.toLocaleString()} so với Thực tế ${actualCost.toLocaleString()} VND`,
          image: estateImage,
          isRead: false,
        });
        await adminNotify.save();
      }

      // Notify
      const io = req.io;
      const tenantNotification = {
        recipient: request.tenant,
        type: "maintenance_progress",
        content: `Your maintenance request is now ${status}`,
        data: { requestId: request._id },
        image: estateImage,
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

      const estate = await Estate.findById(request.estate);
      const estateName = estate ? estate.name : "property";
      const estateImage =
        estate && estate.images && estate.images.length > 0
          ? estate.images[0]
          : "";

      const newNotify = new Notify({
        user: tenantId,
        recipients: [request.landlord],
        url: `/maintenance/${request._id}`,
        text: `Phản hồi nhận được về bảo trì`,
        content: `${estateName} đã gửi phản hồi ${rating} sao về việc bảo trì`,
        image: estateImage,
        isRead: false,
      });
      await newNotify.save();

      const io = req.io;
      if (io) {
        const landlordNotification = {
          recipient: request.landlord,
          type: "maintenance_feedback",
          content: `Người thuê nhà đã gửi phản hồi ${rating}-star về công việc bảo trì của bạn`,
          data: { requestId: request._id },
          image: estateImage,
          read: false,
          createdAt: new Date(),
        };
        io.to(`user_${request.landlord}`).emit(
          "newNotification",
          landlordNotification
        );
      }

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
