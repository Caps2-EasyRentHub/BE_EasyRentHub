import Users from "../models/userModel.js";
import Estates from "../models/estateModel.js";
import bcrypt from "bcrypt";

const userCtrl = {
  getUser: async (req, res) => {
    try {
      const user = await Users.findById(req.params.id).select("-password");
      const estates = await Estates.find({ user: req.params.id });
      if (!user) return res.status(400).json({ msg: "User does not exist." });
      res.json({ user, lengthEstates: estates.length });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  
  getAllUsers: async (req, res) => {
    try {
      // Check if the requesting user is an admin (middleware should handle this)
      if (req.user.role !== "Admin") {
        return res.status(401).json({
          title: "Không đủ quyền",
          message: "Chỉ dành cho Admin"
        });
      }
      
      // Get all users, excluding their passwords
      const users = await Users.find().select("-password");
      
      // Return the users as a response
      res.json({ users });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  updateUser: async (req, res) => {
    try {
      const { fullname, email, phone, avatar, role, password } = req.body;
      
      // Check if user exists
      const user = await Users.findById(req.params.id);
      if (!user) return res.status(404).json({ msg: "User not found" });
      
      // Check permission - only admin can change roles or admin can edit any user
      // Regular users can only edit their own profiles
      if (req.user.role !== "Admin" && req.user._id.toString() !== req.params.id) {
        return res.status(401).json({
          title: "Không đủ quyền",
          message: "Bạn không có quyền chỉnh sửa thông tin của người dùng khác"
        });
      }
      
      // Build update object with provided fields
      const updateData = {};
      if (fullname) updateData.fullname = fullname;
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;
      if (avatar) updateData.avatar = avatar;
      
      // Only admin can change user roles and only to valid role types
      if (role && req.user.role === "Admin") {
        // Validate that role is one of the allowed values
        const validRoles = ["Tenant", "Admin", "Landlord"];
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            title: "Vai trò không hợp lệ",
            message: "Vai trò phải là một trong: Tenant, Admin, Landlord"
          });
        }
        updateData.role = role;
      }
      
      // Handle password update if provided
      if (password) {
        const passwordHash = await bcrypt.hash(password, 12);
        updateData.password = passwordHash;
      }
      
      // Update the user
      const updatedUser = await Users.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      ).select("-password");
      
      res.json({ 
        msg: "Cập nhật thông tin người dùng thành công",
        user: updatedUser 
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  
  deleteUser: async (req, res) => {
    try {
      // Only admin can delete users
      if (req.user.role !== "Admin") {
        return res.status(401).json({
          title: "Không đủ quyền",
          message: "Chỉ Admin mới có quyền xóa người dùng"
        });
      }
      
      // Find the user to delete
      const user = await Users.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }
      
      // Don't allow deleting your own admin account
      if (req.user._id.toString() === req.params.id) {
        return res.status(400).json({
          title: "Không thể thực hiện",
          message: "Bạn không thể xóa tài khoản của chính mình"
        });
      }
      
      // Delete the user
      await Users.findByIdAndDelete(req.params.id);
      
      // Find and delete or reassign related data if needed
      // For example, you might want to delete their estates or reassign them
      // await Estates.deleteMany({ user: req.params.id });
      
      res.json({ 
        msg: "Xóa người dùng thành công"
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  }
};

export default userCtrl;