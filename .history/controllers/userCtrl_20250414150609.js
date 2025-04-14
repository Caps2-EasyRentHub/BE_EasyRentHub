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

      if (req.user.role !== "Admin") {
        return res.status(401).json({
          title: "Insufficient permissions",
          message: "Only Admin users can access this resource"
        });
      }

      const users = await Users.find().select("-password");
      res.json({ users });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },

  updateUser: async (req, res) => {
    try {
      const { fullname, email, phone, avatar, role, password } = req.body;
      

      const user = await Users.findById(req.params.id);
      if (!user) return res.status(404).json({ msg: "User not found" });
      

      if (req.user.role !== "Admin" && req.user._id.toString() !== req.params.id) {
        return res.status(401).json({
          title: "Insufficient permissions",
          message: "You don't have permission to edit other users' information"
        });
      }

      const updateData = {};
      if (fullname) updateData.fullname = fullname;
      if (email) updateData.email = email;
      if (phone) updateData.phone = phone;
      if (avatar) updateData.avatar = avatar;

      if (role && req.user.role === "Admin") {
        const validRoles = ["Tenant", "Admin", "Landlord"];
        if (!validRoles.includes(role)) {
          return res.status(400).json({
            title: "Invalid role",
            message: "Role must be one of: Tenant, Admin, Landlord"
          });
        }
        updateData.role = role;
      }

      if (password) {
        const passwordHash = await bcrypt.hash(password, 12);
        updateData.password = passwordHash;
      }

      const updatedUser = await Users.findByIdAndUpdate(
        req.params.id,
        updateData,
        { new: true }
      ).select("-password");
      
      res.json({ 
        msg: "User information updated successfully",
        user: updatedUser 
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  },
  
  deleteUser: async (req, res) => {
    try {
      if (req.user.role !== "Admin") {
        return res.status(401).json({
          title: "Insufficient permissions",
          message: "Only Admin users can delete accounts"
        });
      }

      const user = await Users.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ msg: "User not found" });
      }

      if (req.user._id.toString() === req.params.id) {
        return res.status(400).json({
          title: "Action not allowed",
          message: "You cannot delete your own account"
        });
      }
 
      if (user.role === "Admin") {
        const adminCount = await Users.countDocuments({ role: "Admin" });
        if (adminCount <= 1) {
          return res.status(400).json({
            title: "Action not allowed",
            message: "Cannot delete the last admin account in the system"
          });
        }
      }
   
      await Users.findByIdAndDelete(req.params.id);
      
      res.json({ 
        msg: "User deleted successfully"
      });
    } catch (err) {
      return res.status(500).json({ msg: err.message });
    }
  }
};

export default userCtrl;